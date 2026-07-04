import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { requireAdmin, requireAuth, signToken } from "./auth.js";
import { publicUser, readDb, writeDb } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "64kb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }));

const optionalEmail = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().email().max(120).optional()
);
const optionalContact = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(2).max(120).optional()
);

const signupSchema = z.object({
  name: z.string().trim().min(2).max(40),
  email: optionalEmail,
  phone: optionalContact,
  password: z.string().min(8).max(72)
}).refine((data) => data.email || data.phone, { message: "Email or mobile number required" });

const signupVerifySchema = z.object({
  identifier: z.string().trim().min(2).max(120).optional(),
  email: optionalContact,
  phone: optionalContact,
  otp: z.string().trim().regex(/^\d{6}$/)
}).refine((data) => data.identifier || data.email || data.phone, { message: "Identifier required" });

const loginSchema = z.object({
  identifier: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(1)
}).refine((data) => data.identifier || data.email, { message: "Identifier required" });

const passwordOtpSchema = z.object({
  identifier: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().min(2).max(120).optional()
}).refine((data) => data.identifier || data.email, { message: "Identifier required" });

const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().min(2).max(120).optional(),
  otp: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8).max(72)
}).refine((data) => data.identifier || data.email, { message: "Identifier required" });

const orderSchema = z.object({
  amount: z.number().min(1).max(100000),
  rate: z.number().min(0).max(20),
  method: z.enum(["Bank", "UPI"]),
  tier: z.enum(["Small", "Medium", "Large"])
});

const withdrawalSchema = z.object({
  amount: z.number().min(1).max(100000),
  method: z.enum(["Bank", "UPI"])
});

const paymentMethodSchema = z.object({
  type: z.enum(["Bank", "UPI"]),
  label: z.string().trim().min(2).max(60),
  accountRef: z.string().trim().min(3).max(80)
});

const matchSchema = z.object({
  gameId: z.enum(["ludo", "mines", "aviator", "cricket"]),
  entryAmount: z.number().min(1).max(10000)
});

const settleMatchSchema = z.object({
  winnerId: z.string().min(2),
  note: z.string().trim().max(200).optional()
});

const settingsSchema = z.object({
  manualRealMoneyMode: z.boolean(),
  complianceStatus: z.enum(["pending_written_legal_approval", "approved_manual_enable"])
});

const platformFeeRate = 0.08;
const tdsRate = 0.30;
const gstRate = 0.28;
const loginAliases = {
  "admin@gaming.demo": "admin@doremonking.app",
  "demo@gaming.demo": "member@doremonking.app"
};

function findWallet(db, userId) {
  return db.wallets.find((item) => item.userId === userId);
}

function normalizeLoginEmail(email) {
  const normalized = email.toLowerCase();
  return loginAliases[normalized] || normalized;
}

function normalizePhone(phone) {
  return phone.replace(/[^\d]/g, "");
}

function normalizeIdentifier(identifier) {
  const value = identifier.trim();
  const phone = normalizePhone(value);
  return phone.length >= 10 ? phone : value.toLowerCase();
}

function findUserByIdentifier(db, identifier) {
  const normalized = normalizeIdentifier(identifier);
  const emailCandidates = new Set([normalized, normalizeLoginEmail(normalized)]);
  Object.entries(loginAliases).forEach(([legacyEmail, currentEmail]) => {
    if (currentEmail === normalized) emailCandidates.add(legacyEmail);
  });
  return db.users.find((item) => {
    const userCode = item.userCode?.toLowerCase();
    return emailCandidates.has(item.email) || item.phone === normalized || item.id.toLowerCase() === normalized || userCode === normalized;
  });
}

function signupContact(signup) {
  return signup.email ? normalizeLoginEmail(signup.email) : normalizePhone(signup.phone);
}

function generateUserCode(db) {
  let code = "";
  do {
    code = `DK${Math.floor(100000 + Math.random() * 900000)}`;
  } while (db.users.some((user) => user.userCode === code));
  return code;
}

function requireWalletBalance(wallet, amount) {
  return wallet && wallet.coins >= amount;
}

function platformSettings(db) {
  db.settings ||= {
    manualRealMoneyMode: false,
    complianceStatus: "pending_written_legal_approval",
    updatedAt: new Date().toISOString()
  };
  return db.settings;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    return response.ok;
  } catch (error) {
    console.error("Telegram OTP failed", error);
    return false;
  }
}

function clearExpiredOtps(db) {
  db.otps ||= [];
  const now = Date.now();
  db.otps = db.otps.filter((item) => new Date(item.expiresAt).getTime() > now && item.attempts < 5);
}

async function createOtp(db, purpose, email, payload = {}) {
  clearExpiredOtps(db);
  const otp = generateOtp();
  const normalizedEmail = email.toLowerCase();
  db.otps = db.otps.filter((item) => !(item.email === normalizedEmail && item.purpose === purpose));
  const item = {
    id: uuid(),
    email: normalizedEmail,
    purpose,
    otpHash: await bcrypt.hash(otp, 10),
    payload,
    attempts: 0,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };
  db.otps.push(item);
  return { item, otp };
}

async function verifyOtp(db, purpose, email, otp) {
  clearExpiredOtps(db);
  const normalizedEmail = email.toLowerCase();
  const item = db.otps.find((entry) => entry.email === normalizedEmail && entry.purpose === purpose);
  if (!item) return { ok: false, message: "OTP expired or not found" };
  const valid = await bcrypt.compare(otp, item.otpHash);
  if (!valid) {
    item.attempts += 1;
    return { ok: false, message: "Invalid OTP" };
  }
  db.otps = db.otps.filter((entry) => entry.id !== item.id);
  return { ok: true, item };
}

function createUserFromSignup(db, signup) {
  const user = {
    id: uuid(),
    userCode: generateUserCode(db),
    name: signup.name,
    email: signup.email ? signup.email.toLowerCase() : "",
    phone: signup.phone ? normalizePhone(signup.phone) : "",
    passwordHash: signup.passwordHash,
    role: "user",
    blocked: false,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  db.wallets.push({ userId: user.id, coins: 500 });
  db.transactions.push({
    id: uuid(),
    userId: user.id,
    type: "signup_bonus",
    amount: 500,
    note: "Signup bonus wallet units",
    createdAt: new Date().toISOString()
  });
  return user;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "DoremonKing API" });
});

app.post("/api/auth/signup/otp", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check signup details" });

  const db = readDb();
  const contact = signupContact(parsed.data);
  if (parsed.data.phone && normalizePhone(parsed.data.phone).length < 10) {
    return res.status(400).json({ message: "Enter a valid mobile number" });
  }
  if (db.users.some((user) => user.email === contact || user.phone === contact)) {
    return res.status(409).json({ message: "Account already registered" });
  }

  const signup = {
    name: parsed.data.name,
    email: parsed.data.email ? normalizeLoginEmail(parsed.data.email) : "",
    phone: parsed.data.phone ? normalizePhone(parsed.data.phone) : "",
    passwordHash: await bcrypt.hash(parsed.data.password, 10)
  };
  const { otp } = await createOtp(db, "signup", contact, signup);
  const telegramSent = await sendTelegramMessage(`DoremonKing signup OTP for ${contact}: ${otp}`);
  writeDb(db);

  res.json({
    message: telegramSent ? "Signup OTP sent to admin Telegram bot." : "Signup OTP created. Configure Telegram bot for live delivery.",
    delivery: telegramSent ? "telegram" : "setup",
    setupOtp: telegramSent ? undefined : otp
  });
});

app.post("/api/auth/signup/verify", async (req, res) => {
  const parsed = signupVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter valid 6 digit OTP" });

  const db = readDb();
  const contact = parsed.data.identifier
    ? normalizeIdentifier(parsed.data.identifier)
    : parsed.data.email
      ? normalizeLoginEmail(parsed.data.email)
      : normalizePhone(parsed.data.phone);
  if (db.users.some((user) => user.email === contact || user.phone === contact)) {
    return res.status(409).json({ message: "Account already registered" });
  }
  const verification = await verifyOtp(db, "signup", contact, parsed.data.otp);
  if (!verification.ok) {
    writeDb(db);
    return res.status(400).json({ message: verification.message });
  }
  const user = createUserFromSignup(db, verification.item.payload);
  writeDb(db);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/signup", async (req, res) => {
  return res.status(400).json({ message: "Use signup OTP verification" });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check login details" });

  const db = readDb();
  const user = findUserByIdentifier(db, parsed.data.identifier || parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (user.blocked) return res.status(403).json({ message: "Account blocked" });

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/password/otp", async (req, res) => {
  const parsed = passwordOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid email or user ID" });

  const db = readDb();
  const user = findUserByIdentifier(db, parsed.data.identifier || parsed.data.email);
  if (!user) return res.status(404).json({ message: "Account not registered" });

  const resetContact = user.email || user.phone;
  const { otp } = await createOtp(db, "password_reset", resetContact);
  const telegramSent = await sendTelegramMessage(`DoremonKing password reset OTP for ${resetContact}: ${otp}`);
  writeDb(db);
  res.json({
    message: telegramSent ? "Password reset OTP sent to admin Telegram bot." : "Password reset OTP created. Configure Telegram bot for live delivery.",
    delivery: telegramSent ? "telegram" : "setup",
    setupOtp: telegramSent ? undefined : otp
  });
});

app.post("/api/auth/password/reset", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check reset details" });

  const db = readDb();
  const user = findUserByIdentifier(db, parsed.data.identifier || parsed.data.email);
  if (!user) return res.status(404).json({ message: "Account not registered" });
  const verification = await verifyOtp(db, "password_reset", user.email || user.phone, parsed.data.otp);
  if (!verification.ok) {
    writeDb(db);
    return res.status(400).json({ message: verification.message });
  }
  user.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  user.passwordChangedAt = new Date().toISOString();
  writeDb(db);
  res.json({ message: "Password updated. Login with your new password." });
});

app.get("/api/me", requireAuth, (req, res) => {
  const db = readDb();
  const wallet = db.wallets.find((item) => item.userId === req.user.id) || { coins: 0 };
  const scores = db.scores.filter((item) => item.userId === req.user.id).slice(-10).reverse();
  res.json({ user: req.user, wallet, scores });
});

app.get("/api/games", (_req, res) => {
  res.json(readDb().games.filter((game) => game.active));
});

app.get("/api/settings", (_req, res) => {
  const settings = platformSettings(readDb());
  res.json({ settings });
});

app.post("/api/games/:gameId/score", requireAuth, (req, res) => {
  const score = Number(req.body.score || 0);
  if (!Number.isFinite(score) || score < 0 || score > 100000) {
    return res.status(400).json({ message: "Invalid score" });
  }

  const db = readDb();
  const game = db.games.find((item) => item.id === req.params.gameId && item.active);
  if (!game) return res.status(404).json({ message: "Game not found" });

  const reward = Math.min(75, Math.max(5, Math.floor(score / 10)));
  const wallet = db.wallets.find((item) => item.userId === req.user.id);
  wallet.coins += reward;
  db.scores.push({ id: uuid(), userId: req.user.id, gameId: game.id, score, reward, createdAt: new Date().toISOString() });
  db.transactions.push({ id: uuid(), userId: req.user.id, type: "game_score", amount: reward, note: `${game.name} reward`, createdAt: new Date().toISOString() });
  writeDb(db);

  res.json({ reward, wallet });
});

app.get("/api/wallet", requireAuth, (req, res) => {
  const db = readDb();
  const wallet = db.wallets.find((item) => item.userId === req.user.id) || { coins: 0 };
  const transactions = db.transactions.filter((item) => item.userId === req.user.id).slice(-30).reverse();
  res.json({ wallet, transactions });
});

app.get("/api/orders", requireAuth, (req, res) => {
  const db = readDb();
  const orders = (db.orders || []).filter((item) => item.userId === req.user.id).slice(-50).reverse();
  res.json({ orders });
});

app.post("/api/orders", requireAuth, (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid order details" });

  const db = readDb();
  db.orders ||= [];
  db.transactions ||= [];
  const income = Number((parsed.data.amount * parsed.data.rate / 100).toFixed(2));
  const order = {
    id: uuid(),
    userId: req.user.id,
    ...parsed.data,
    income,
    status: "completed_review",
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  db.transactions.push({
    id: uuid(),
    userId: req.user.id,
    type: "order_reward",
    amount: income,
    note: `${parsed.data.tier} order reward`,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.status(201).json({ order });
});

app.get("/api/matches", requireAuth, (req, res) => {
  const db = readDb();
  const matches = (db.matches || [])
    .filter((item) => item.status === "open" || item.players.includes(req.user.id) || req.user.role === "admin")
    .slice(-80)
    .reverse();
  res.json({ matches });
});

app.post("/api/matches", requireAuth, (req, res) => {
  const parsed = matchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid match details" });

  const db = readDb();
  db.matches ||= [];
  db.transactions ||= [];
  const wallet = findWallet(db, req.user.id);
  if (!requireWalletBalance(wallet, parsed.data.entryAmount)) {
    return res.status(400).json({ message: "Insufficient wallet balance" });
  }

  wallet.coins -= parsed.data.entryAmount;
  const match = {
    id: uuid(),
    gameId: parsed.data.gameId,
    entryAmount: parsed.data.entryAmount,
    players: [req.user.id],
    status: "open",
    escrowAmount: parsed.data.entryAmount,
    platformFeeRate,
    tdsRate,
    gstRate,
    createdAt: new Date().toISOString()
  };
  db.matches.push(match);
  db.transactions.push({
    id: uuid(),
    userId: req.user.id,
    type: "match_escrow_debit",
    amount: -parsed.data.entryAmount,
    note: `${parsed.data.gameId} match escrow`,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.status(201).json({ match });
});

app.post("/api/matches/:matchId/join", requireAuth, (req, res) => {
  const db = readDb();
  const match = (db.matches || []).find((item) => item.id === req.params.matchId);
  if (!match || match.status !== "open") return res.status(404).json({ message: "Open match not found" });
  if (match.players.includes(req.user.id)) return res.status(400).json({ message: "You already joined this match" });

  const wallet = findWallet(db, req.user.id);
  if (!requireWalletBalance(wallet, match.entryAmount)) {
    return res.status(400).json({ message: "Insufficient wallet balance" });
  }

  wallet.coins -= match.entryAmount;
  match.players.push(req.user.id);
  match.escrowAmount += match.entryAmount;
  match.status = "active";
  match.joinedAt = new Date().toISOString();
  db.transactions.push({
    id: uuid(),
    userId: req.user.id,
    type: "match_escrow_debit",
    amount: -match.entryAmount,
    note: `${match.gameId} match escrow`,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.json({ match });
});

app.post("/api/matches/:matchId/cancel", requireAuth, (req, res) => {
  const db = readDb();
  const match = (db.matches || []).find((item) => item.id === req.params.matchId);
  if (!match || match.status !== "open" || match.players[0] !== req.user.id) {
    return res.status(400).json({ message: "Only creator can cancel an open match" });
  }
  const wallet = findWallet(db, req.user.id);
  wallet.coins += match.entryAmount;
  match.status = "cancelled";
  match.cancelledAt = new Date().toISOString();
  db.transactions.push({
    id: uuid(),
    userId: req.user.id,
    type: "match_escrow_refund",
    amount: match.entryAmount,
    note: `${match.gameId} match refund`,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.json({ match });
});

app.get("/api/payment-methods", requireAuth, (req, res) => {
  const db = readDb();
  const methods = (db.paymentMethods || []).filter((item) => item.userId === req.user.id);
  res.json({ methods });
});

app.post("/api/payment-methods", requireAuth, (req, res) => {
  const parsed = paymentMethodSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payment method details" });
  const db = readDb();
  db.paymentMethods ||= [];
  const method = {
    id: uuid(),
    userId: req.user.id,
    ...parsed.data,
    status: "pending_review",
    createdAt: new Date().toISOString()
  };
  db.paymentMethods.push(method);
  writeDb(db);
  res.status(201).json({ method });
});

app.get("/api/withdrawals", requireAuth, (req, res) => {
  const db = readDb();
  const orders = (db.orders || []).filter((item) => item.userId === req.user.id);
  const orderVolume = orders.reduce((sum, item) => sum + item.amount, 0);
  const withdrawals = (db.withdrawals || []).filter((item) => item.userId === req.user.id).slice(-20).reverse();
  res.json({
    withdrawals,
    eligibility: {
      minimumOrderVolume: 5000,
      orderVolume,
      eligible: orderVolume >= 5000
    }
  });
});

app.post("/api/withdrawals", requireAuth, (req, res) => {
  const parsed = withdrawalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid withdrawal details" });
  const db = readDb();
  db.withdrawals ||= [];
  const orders = (db.orders || []).filter((item) => item.userId === req.user.id);
  const orderVolume = orders.reduce((sum, item) => sum + item.amount, 0);
  const locked = orderVolume < 5000;
  const withdrawal = {
    id: uuid(),
    userId: req.user.id,
    ...parsed.data,
    status: locked ? "locked_minimum_order_volume" : "pending_admin_review",
    orderVolume,
    createdAt: new Date().toISOString()
  };
  db.withdrawals.push(withdrawal);
  writeDb(db);
  res.status(201).json({ withdrawal });
});

app.post("/api/wallet/daily-reward", requireAuth, (req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyClaimed = db.dailyRewards.some((item) => item.userId === req.user.id && item.date === today);
  if (alreadyClaimed) return res.status(409).json({ message: "Daily reward already claimed" });

  const amount = 100;
  const wallet = db.wallets.find((item) => item.userId === req.user.id);
  wallet.coins += amount;
  db.dailyRewards.push({ userId: req.user.id, date: today });
  db.transactions.push({ id: uuid(), userId: req.user.id, type: "daily_reward", amount, note: "Daily reward", createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ amount, wallet });
});

app.get("/api/admin/overview", requireAuth, requireAdmin, (_req, res) => {
  const db = readDb();
  const settings = platformSettings(db);
  const activeUsers = db.users.filter((user) => !user.blocked).length;
  res.json({
    totals: {
      users: db.users.length,
      activeUsers,
      games: db.games.length,
      scores: db.scores.length,
      transactions: db.transactions.length,
      orders: (db.orders || []).length,
      withdrawals: (db.withdrawals || []).length,
      matches: (db.matches || []).length
    },
    users: db.users.map(publicUser),
    transactions: db.transactions.slice(-50).reverse(),
    scores: db.scores.slice(-50).reverse(),
    orders: (db.orders || []).slice(-50).reverse(),
    withdrawals: (db.withdrawals || []).slice(-50).reverse(),
    paymentMethods: (db.paymentMethods || []).slice(-50).reverse(),
    matches: (db.matches || []).slice(-50).reverse(),
    otps: (db.otps || []).map((item) => ({
      id: item.id,
      email: item.email,
      purpose: item.purpose,
      attempts: item.attempts,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt
    })).slice(-20).reverse(),
    settings
  });
});

app.patch("/api/admin/settings", requireAuth, requireAdmin, (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid settings" });
  if (parsed.data.manualRealMoneyMode && parsed.data.complianceStatus !== "approved_manual_enable") {
    return res.status(400).json({ message: "Written legal approval is required before enabling manual real-money mode" });
  }
  const db = readDb();
  db.settings = {
    ...platformSettings(db),
    ...parsed.data,
    updatedAt: new Date().toISOString()
  };
  writeDb(db);
  res.json({ settings: db.settings });
});

app.post("/api/admin/matches/:matchId/settle", requireAuth, requireAdmin, (req, res) => {
  const parsed = settleMatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid settlement details" });

  const db = readDb();
  const match = (db.matches || []).find((item) => item.id === req.params.matchId);
  if (!match || match.status !== "active") return res.status(404).json({ message: "Active match not found" });
  if (!match.players.includes(parsed.data.winnerId)) return res.status(400).json({ message: "Winner must be a match player" });

  const winnerWallet = findWallet(db, parsed.data.winnerId);
  const platformFee = Number((match.escrowAmount * platformFeeRate).toFixed(2));
  const grossPayout = Number((match.escrowAmount - platformFee).toFixed(2));
  const winnerEntry = match.entryAmount;
  const netWinnings = Math.max(0, grossPayout - winnerEntry);
  const tds = Number((netWinnings * tdsRate).toFixed(2));
  const netPayout = Number((grossPayout - tds).toFixed(2));
  const gstLiability = Number((match.escrowAmount * gstRate).toFixed(2));

  winnerWallet.coins += netPayout;
  Object.assign(match, {
    status: "settled",
    winnerId: parsed.data.winnerId,
    platformFee,
    grossPayout,
    netWinnings,
    tds,
    netPayout,
    gstLiability,
    adminNote: parsed.data.note || "Admin fair-play review completed",
    settledAt: new Date().toISOString()
  });
  db.transactions.push({
    id: uuid(),
    userId: parsed.data.winnerId,
    type: "match_winner_payout",
    amount: netPayout,
    note: `${match.gameId} winner payout after platform fee/TDS ledger`,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.json({ match });
});

app.patch("/api/admin/users/:userId/block", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.id === req.params.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role === "admin") return res.status(400).json({ message: "Admin cannot be blocked" });
  user.blocked = Boolean(req.body.blocked);
  writeDb(db);
  res.json({ user: publicUser(user) });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

app.listen(port, () => {
  console.log(`DoremonKing API running on http://localhost:${port}`);
});
