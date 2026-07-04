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

const signupSchema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "DoremonKing API" });
});

app.post("/api/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check signup details" });

  const db = readDb();
  const email = parsed.data.email.toLowerCase();
  if (db.users.some((user) => user.email === email)) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const user = {
    id: uuid(),
    name: parsed.data.name,
    email,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
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
    note: "Signup bonus demo coins",
    createdAt: new Date().toISOString()
  });
  writeDb(db);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Check login details" });

  const db = readDb();
  const user = db.users.find((item) => item.email === parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (user.blocked) return res.status(403).json({ message: "Account blocked" });

  res.json({ token: signToken(user), user: publicUser(user) });
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

app.post("/api/wallet/daily-reward", requireAuth, (req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyClaimed = db.dailyRewards.some((item) => item.userId === req.user.id && item.date === today);
  if (alreadyClaimed) return res.status(409).json({ message: "Daily reward already claimed" });

  const amount = 100;
  const wallet = db.wallets.find((item) => item.userId === req.user.id);
  wallet.coins += amount;
  db.dailyRewards.push({ userId: req.user.id, date: today });
  db.transactions.push({ id: uuid(), userId: req.user.id, type: "daily_reward", amount, note: "Daily demo reward", createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ amount, wallet });
});

app.get("/api/admin/overview", requireAuth, requireAdmin, (_req, res) => {
  const db = readDb();
  const activeUsers = db.users.filter((user) => !user.blocked).length;
  res.json({
    totals: {
      users: db.users.length,
      activeUsers,
      games: db.games.length,
      scores: db.scores.length,
      transactions: db.transactions.length
    },
    users: db.users.map(publicUser),
    transactions: db.transactions.slice(-50).reverse(),
    scores: db.scores.slice(-50).reverse()
  });
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
  console.log(`GamingPlatform API running on http://localhost:${port}`);
});
