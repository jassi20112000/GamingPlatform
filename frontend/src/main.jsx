import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Banknote,
  Bell,
  Bomb,
  Crown,
  Gamepad2,
  Home,
  Landmark,
  ListChecks,
  LogOut,
  Plane,
  Shield,
  Trophy,
  User,
  Users,
  Wallet
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./lib/api.js";
import "./styles.css";

const navItems = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ListChecks },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "team", label: "Team", icon: Users },
  { id: "profile", label: "Profile", icon: User }
];

const orderCards = [
  { id: "small-1", amount: 320, rate: 8, method: "Bank", tier: "Small" },
  { id: "small-2", amount: 940, rate: 8, method: "Bank", tier: "Small" },
  { id: "mid-1", amount: 4500, rate: 8, method: "UPI", tier: "Medium" },
  { id: "mid-2", amount: 4600, rate: 8, method: "Bank", tier: "Medium" },
  { id: "large-1", amount: 14700, rate: 8, method: "Bank", tier: "Large" },
  { id: "large-2", amount: 15728, rate: 8, method: "UPI", tier: "Large" }
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState({ user: null, wallet: null, scores: [] });
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ manualRealMoneyMode: false, complianceStatus: "pending_written_legal_approval" });

  async function refresh() {
    const settingsData = await api("/api/settings");
    setSettings(settingsData.settings);
    if (!getToken()) return;
    try {
      setSession(await api("/api/me"));
      const orderData = await api("/api/orders");
      setOrders(orderData.orders || []);
    } catch {
      clearToken();
      setSession({ user: null, wallet: null, scores: [] });
      setOrders([]);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const visibleNav = useMemo(() => {
    if (!session.user) return [{ id: "dashboard", label: "Login", icon: Home }];
    return session.user.role === "admin" ? [...navItems, { id: "admin", label: "Admin", icon: Shield }] : navItems;
  }, [session.user]);

  function logout() {
    clearToken();
    setSession({ user: null, wallet: null, scores: [] });
    setPage("dashboard");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)} title={item.label}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {session.user && (
          <button className="ghost logout" onClick={logout} title="Logout">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        )}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="ticker">DoremonKing will never ask you to send money privately. {settings.manualRealMoneyMode ? "Manual mode enabled by admin." : "Manual real-money mode disabled."}</p>
            <h1>{session.user ? `Hello, ${session.user.name}` : "Welcome to DoremonKing"}</h1>
          </div>
          <div className="top-actions">
            <button className="round-action" title="Notifications"><Bell size={18} /></button>
            {session.user && <button className="round-action" onClick={logout} title="Logout"><LogOut size={18} /></button>}
          </div>
        </header>

        {message && <div className="toast">{message}</div>}

        {!session.user && <AuthPage setSession={setSession} setPage={setPage} setMessage={setMessage} refresh={refresh} />}
        {session.user && page === "dashboard" && <Dashboard session={session} setPage={setPage} orders={orders} settings={settings} />}
        {session.user && page === "orders" && <OrdersPage orders={orders} refresh={refresh} setMessage={setMessage} />}
        {session.user && page === "games" && <GamesPage refresh={refresh} setMessage={setMessage} settings={settings} />}
        {session.user && page === "team" && <TeamPage />}
        {session.user && page === "profile" && <Profile session={session} logout={logout} setMessage={setMessage} />}
        {session.user && page === "admin" && <AdminPanel />}
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <img src="/brand/doremonking-logo.png" alt="DoremonKing logo" />
      <div>
        <strong>DoremonKing</strong>
        <span>Fair demo gaming</span>
      </div>
    </div>
  );
}

function AuthPage({ setSession, setPage, setMessage, refresh }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!agree) return setMessage("Please accept the user agreement.");
    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = mode === "signup" ? form : { email: form.email, password: form.password };
      const data = await api(path, { method: "POST", body: JSON.stringify(payload) });
      setToken(data.token);
      await refresh();
      setSession((current) => ({ ...current, user: data.user }));
      setPage("dashboard");
      setMessage(mode === "signup" ? "Account created with demo bonus." : "Logged in successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="login-screen">
      <Brand />
      <h2>{mode === "signup" ? "Create account" : "Login"}</h2>
      <p>Use demo coins, fair games, and transparent order simulation.</p>
      <form className="auth-box" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
        </div>
        {mode === "signup" && <input placeholder="Username" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label className="checkline">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to user Privacy Agreement</span>
        </label>
        <button className="primary-btn">{mode === "signup" ? "Create Account" : "Login"}</button>
        <small>Demo: demo@gaming.demo / Demo@12345</small>
      </form>
    </section>
  );
}

function Dashboard({ session, setPage, orders, settings }) {
  const coins = session.wallet?.coins ?? 0;
  const todayProfit = orders.reduce((sum, order) => sum + order.income, 0);
  return (
    <section className="mobile-stack">
      <div className="balance-hero">
        <span>Demo Balance</span>
        <strong>{coins.toFixed(2)}</strong>
        <button onClick={() => setPage("orders")}>Bill Details</button>
      </div>
      <div className="mini-grid">
        <StatTile label="Today orders" value={orders.length} icon={ListChecks} />
        <StatTile label="Today profit estimated" value={`Rs ${todayProfit.toFixed(2)}`} icon={Activity} />
      </div>
      <div className="quick-actions">
        <button onClick={() => setPage("orders")}><Banknote />Buy</button>
        <button onClick={() => setPage("orders")}><Landmark />Sell</button>
        <button onClick={() => setPage("profile")}><Wallet />UPI</button>
        <button onClick={() => setPage("games")}><Gamepad2 />Games</button>
      </div>
      <section className="market-card">
        <div>
          <span>xCoin Price</span>
          <strong>108.61</strong>
          <small>1 xCoin = 1 demo rupee</small>
        </div>
        <svg viewBox="0 0 280 100" aria-hidden="true">
          <path d="M10 78 C40 42, 65 70, 92 40 S145 34, 170 58 220 75, 270 38" />
        </svg>
      </section>
      <button className="promo" onClick={() => setPage("orders")}>8% simulated return per completed demo order</button>
      <button className="promo outline" onClick={() => setPage("games")}>{settings.manualRealMoneyMode ? "Fair 1v1 manual mode active" : "Play fair demo games while manual mode is disabled"}</button>
    </section>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="stat-tile">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrdersPage({ orders, refresh, setMessage }) {
  const [mode, setMode] = useState("buy");
  const [tier, setTier] = useState("Small");
  const filtered = orderCards.filter((card) => card.tier === tier);

  async function placeOrder(card) {
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ amount: card.amount, rate: card.rate, method: card.method, tier: card.tier })
      });
      setMessage(`Demo order completed: +${result.order.income.toFixed(2)} demo rupees.`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="mobile-stack">
      <div className="tabs">
        <button className={mode === "buy" ? "active" : ""} onClick={() => setMode("buy")}>Buy ({orders.length})</button>
        <button className={mode === "sell" ? "active" : ""} onClick={() => setMode("sell")}>Sell</button>
      </div>
      <div className="tabs pill-tabs">
        {["Small", "Medium", "Large"].map((item) => (
          <button key={item} className={tier === item ? "active" : ""} onClick={() => setTier(item)}>{item}</button>
        ))}
      </div>
      <p className="notice">Order system is a demo simulator. Real payment/withdrawal requires licensed gateway integration.</p>
      {mode === "buy" ? (
        <div className="order-list">
          {filtered.map((card) => {
            const income = card.amount * card.rate / 100;
            return (
              <article className="order-card" key={card.id}>
                <div>
                  <span className="rupee">Rs</span>
                  <strong>{card.amount.toFixed(2)} INR</strong>
                  <em>{card.method}</em>
                  <p>{income.toFixed(2)} income ({card.rate}% demo)</p>
                </div>
                <div>
                  <strong>+{(card.amount + income).toFixed(2)}</strong>
                  <span>Wallet</span>
                  <button onClick={() => placeOrder(card)}>Buy</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="order-list">
          {orders.length ? orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div>
                <span className="rupee">Rs</span>
                <strong>{order.amount.toFixed(2)} INR</strong>
                <em>{order.method}</em>
                <p>{order.income.toFixed(2)} income ({order.rate}% demo)</p>
              </div>
              <div>
                <strong>{order.status.replaceAll("_", " ")}</strong>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
            </article>
          )) : <div className="empty-state">Sell orders will appear after demo orders are completed.</div>}
        </div>
      )}
    </section>
  );
}

function GamesPage({ refresh, setMessage, settings }) {
  const [selected, setSelected] = useState("matches");
  return (
    <section className="games-layout">
      <div className="game-tabs">
        {["matches", "mines", "aviator", "ludo", "cricket"].map((game) => (
          <button key={game} className={selected === game ? "active" : ""} onClick={() => setSelected(game)}>{game}</button>
        ))}
      </div>
      {selected === "matches" && <FairMatchPanel refresh={refresh} setMessage={setMessage} settings={settings} />}
      {selected === "mines" && <MinesGame refresh={refresh} setMessage={setMessage} />}
      {selected === "aviator" && <AviatorGame refresh={refresh} setMessage={setMessage} />}
      {selected === "ludo" && <LudoGame refresh={refresh} setMessage={setMessage} />}
      {selected === "cricket" && <CricketDemo />}
    </section>
  );
}

function FairMatchPanel({ refresh, setMessage, settings }) {
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState({ gameId: "ludo", entryAmount: 10 });

  async function loadMatches() {
    const data = await api("/api/matches");
    setMatches(data.matches || []);
  }

  useEffect(() => {
    loadMatches().catch((error) => setMessage(error.message));
  }, []);

  async function createMatch(event) {
    event.preventDefault();
    try {
      await api("/api/matches", { method: "POST", body: JSON.stringify({ ...form, entryAmount: Number(form.entryAmount) }) });
      setMessage("1v1 fair match created. Entry moved to escrow ledger.");
      await loadMatches();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function joinMatch(matchId) {
    try {
      await api(`/api/matches/${matchId}/join`, { method: "POST" });
      setMessage("Joined match. Admin settlement is required after fair-play review.");
      await loadMatches();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelMatch(matchId) {
    try {
      await api(`/api/matches/${matchId}/cancel`, { method: "POST" });
      setMessage("Open match cancelled and escrow refunded.");
      await loadMatches();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="game-panel">
      <h3>Fair 1v1 Skill Matches</h3>
      <p className="notice">Transparent escrow ledger: 8% platform fee, TDS/GST fields tracked, admin-only settlement. {settings.manualRealMoneyMode ? "Manual mode is enabled by admin." : "Manual real-money mode is disabled until written legal/gateway approval."}</p>
      <form className="tool-form inline-form" onSubmit={createMatch}>
        <select value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })}>
          <option value="ludo">Ludo</option>
          <option value="mines">Mines</option>
          <option value="aviator">Aviator</option>
          <option value="cricket">Cricket</option>
        </select>
        <input type="number" min="1" max="10000" value={form.entryAmount} onChange={(event) => setForm({ ...form, entryAmount: event.target.value })} />
        <button className="primary-btn">Create Match</button>
      </form>
      <div className="compact-list">
        {matches.map((match) => (
          <p key={match.id}>
            <strong>{match.gameId}</strong> Rs {match.entryAmount} - {match.status} - escrow {match.escrowAmount}
            {match.status === "open" && <span className="row-actions"><button onClick={() => joinMatch(match.id)}>Join</button><button onClick={() => cancelMatch(match.id)}>Cancel</button></span>}
            {match.status === "settled" && <span> winner payout {match.netPayout}</span>}
          </p>
        ))}
        {!matches.length && <p className="notice">No matches yet. Create one for another user to join.</p>}
      </div>
    </div>
  );
}

async function saveScore(gameId, score, refresh, setMessage) {
  const result = await api(`/api/games/${gameId}/score`, { method: "POST", body: JSON.stringify({ score }) });
  setMessage(`Fair demo score saved. Reward +${result.reward} coins.`);
  await refresh();
}

function MinesGame({ refresh, setMessage }) {
  const [bomb, setBomb] = useState(() => Math.floor(Math.random() * 9));
  const [opened, setOpened] = useState([]);
  const [lost, setLost] = useState(false);
  const score = opened.length * 18;
  function pick(index) {
    if (lost || opened.includes(index)) return;
    if (index === bomb) return setLost(true);
    setOpened((items) => [...items, index]);
  }
  function reset() {
    setBomb(Math.floor(Math.random() * 9));
    setOpened([]);
    setLost(false);
  }
  return (
    <div className="game-panel">
      <h3>Fair Mines Demo</h3>
      <p>One hidden bomb, equal chance on every new round. No rigging.</p>
      <div className="mines-grid">
        {Array.from({ length: 9 }, (_, index) => (
          <button key={index} className={opened.includes(index) ? "safe" : lost && index === bomb ? "boom" : ""} onClick={() => pick(index)}>
            {opened.includes(index) ? "Rs" : lost && index === bomb ? <Bomb size={22} /> : "?"}
          </button>
        ))}
      </div>
      <div className="game-actions">
        <button onClick={reset}>New Round</button>
        <button onClick={() => saveScore("mines", score, refresh, setMessage)}>Save Score</button>
      </div>
    </div>
  );
}

function AviatorGame({ refresh, setMessage }) {
  const [multiplier, setMultiplier] = useState(1);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return undefined;
    const crashAt = 2.2 + Math.random() * 4;
    const timer = setInterval(() => {
      setMultiplier((value) => {
        const next = Number((value + 0.09).toFixed(2));
        if (next >= crashAt) {
          setRunning(false);
          return next;
        }
        return next;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [running]);
  function restart() {
    setMultiplier(1);
    setRunning(true);
  }
  return (
    <div className="game-panel aviator">
      <h3>Aviator Fair Demo</h3>
      <div className="flight-line"><Plane style={{ left: `${Math.min(84, multiplier * 13)}%` }} /></div>
      <strong>{multiplier}x</strong>
      {!running && <p className="notice">Round ended. Start a new fair demo round.</p>}
      <div className="game-actions">
        <button onClick={restart}>New Round</button>
        <button onClick={() => saveScore("aviator", Math.floor(multiplier * 100), refresh, setMessage)}>Save Score</button>
      </div>
    </div>
  );
}

function LudoGame({ refresh, setMessage }) {
  const [dice, setDice] = useState(1);
  const [position, setPosition] = useState(0);
  const track = 24;
  function roll() {
    const next = Math.ceil(Math.random() * 6);
    setDice(next);
    setPosition((value) => Math.min(track, value + next));
  }
  return (
    <div className="game-panel">
      <h3>Ludo Race Demo</h3>
      <div className="ludo-track">
        {Array.from({ length: track + 1 }, (_, index) => <span key={index} className={index === position ? "token" : ""}>{index === position ? "K" : ""}</span>)}
      </div>
      <div className="dice">{dice}</div>
      <div className="game-actions">
        <button onClick={roll}>Roll Dice</button>
        <button onClick={() => saveScore("ludo", position * 10, refresh, setMessage)}>Save Score</button>
      </div>
    </div>
  );
}

function CricketDemo() {
  return (
    <div className="game-panel cricket">
      <h3>Cricket Live-Style Demo</h3>
      <div className="scoreboard">
        <strong>DK Kings 128/4</strong>
        <span>16.2 overs</span>
        <p>Projected score: 176</p>
      </div>
      <p className="notice">Real live cricket scores need an official sports data API subscription.</p>
    </div>
  );
}

function TeamPage() {
  return (
    <section className="mobile-stack">
      <div className="team-card">
        <h3>Total rebate <span>[Demo]</span></h3>
        <strong>0</strong>
        <div className="mini-grid">
          <StatTile label="Today deposit count" value="0" icon={Banknote} />
          <StatTile label="Today rebate" value="0" icon={Trophy} />
          <StatTile label="Total deposit count" value="0" icon={Activity} />
          <StatTile label="Total subline count" value="0" icon={Users} />
        </div>
      </div>
      <div className="invite-card">
        <h3>Invite subline</h3>
        <p>https://doremonking.demo/invite</p>
        <div className="share-row">
          <span>Telegram</span><span>Facebook</span><span>WhatsApp</span><span>QR code</span>
        </div>
      </div>
    </section>
  );
}

function Profile({ session, logout, setMessage }) {
  const [methods, setMethods] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [eligibility, setEligibility] = useState({ minimumOrderVolume: 5000, orderVolume: 0, eligible: false });
  const [methodForm, setMethodForm] = useState({ type: "UPI", label: "PhonePe", accountRef: "" });
  const [withdrawForm, setWithdrawForm] = useState({ amount: 100, method: "UPI" });

  async function loadProfileTools() {
    const [methodData, withdrawalData] = await Promise.all([
      api("/api/payment-methods"),
      api("/api/withdrawals")
    ]);
    setMethods(methodData.methods || []);
    setWithdrawals(withdrawalData.withdrawals || []);
    setEligibility(withdrawalData.eligibility);
  }

  useEffect(() => {
    loadProfileTools().catch((error) => setMessage(error.message));
  }, []);

  async function saveMethod(event) {
    event.preventDefault();
    try {
      await api("/api/payment-methods", { method: "POST", body: JSON.stringify(methodForm) });
      setMethodForm({ ...methodForm, accountRef: "" });
      setMessage("Demo payment method saved.");
      await loadProfileTools();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function requestWithdrawal(event) {
    event.preventDefault();
    try {
      const result = await api("/api/withdrawals", { method: "POST", body: JSON.stringify({ ...withdrawForm, amount: Number(withdrawForm.amount) }) });
      setMessage(result.withdrawal.status === "pending_admin_review" ? "Withdrawal request sent for admin review." : "Withdrawal locked until demo order volume reaches 5000.");
      await loadProfileTools();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const rows = ["Bill detail", "Invite subline", "Email bind", "Login password", "Pin code", "Telegram bind"];
  return (
    <section className="mobile-stack">
      <div className="profile-card">
        <div className="profile-head">
          <div className="avatar"><User /></div>
          <div>
            <h3>{session.user?.name}</h3>
            <p>{session.user?.email}</p>
          </div>
        </div>
        {rows.map((row) => <button key={row} className="profile-row">{row}<span>{">"}</span></button>)}
        <button className="profile-row logout-row" onClick={logout}>Logout<span>{">"}</span></button>
      </div>

      <div className="profile-card">
        <h3>Add UPI / Bank Demo Account</h3>
        <form className="tool-form" onSubmit={saveMethod}>
          <select value={methodForm.type} onChange={(event) => setMethodForm({ ...methodForm, type: event.target.value })}>
            <option>UPI</option>
            <option>Bank</option>
          </select>
          <input placeholder="Provider label" value={methodForm.label} onChange={(event) => setMethodForm({ ...methodForm, label: event.target.value })} />
          <input placeholder="UPI ID or masked account ref" value={methodForm.accountRef} onChange={(event) => setMethodForm({ ...methodForm, accountRef: event.target.value })} />
          <button className="primary-btn">Save Demo Method</button>
        </form>
        <div className="compact-list">
          {methods.map((method) => <p key={method.id}><strong>{method.type}</strong> {method.label} - {method.accountRef}</p>)}
          {!methods.length && <p className="notice">No demo payment methods saved.</p>}
        </div>
      </div>

      <div className="profile-card">
        <h3>Withdrawal Request</h3>
        <p className="notice">Demo-only request. Current order volume: {eligibility.orderVolume.toFixed(2)} / {eligibility.minimumOrderVolume}</p>
        <form className="tool-form" onSubmit={requestWithdrawal}>
          <input type="number" min="1" value={withdrawForm.amount} onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })} />
          <select value={withdrawForm.method} onChange={(event) => setWithdrawForm({ ...withdrawForm, method: event.target.value })}>
            <option>UPI</option>
            <option>Bank</option>
          </select>
          <button className="primary-btn">Request Review</button>
        </form>
        <div className="compact-list">
          {withdrawals.map((item) => <p key={item.id}><strong>{item.amount}</strong> {item.method} - {item.status.replaceAll("_", " ")}</p>)}
          {!withdrawals.length && <p className="notice">No withdrawal requests yet.</p>}
        </div>
      </div>
    </section>
  );
}

function AdminPanel() {
  const [data, setData] = useState(null);
  const [settleForms, setSettleForms] = useState({});
  const [settingsForm, setSettingsForm] = useState({ manualRealMoneyMode: false, complianceStatus: "pending_written_legal_approval" });
  const [adminMessage, setAdminMessage] = useState("");
  async function load() {
    const overview = await api("/api/admin/overview");
    setData(overview);
    setSettingsForm(overview.settings);
  }
  useEffect(() => {
    load();
  }, []);

  async function settleMatch(match) {
    try {
      const winnerId = settleForms[match.id] || match.players[0];
      await api(`/api/admin/matches/${match.id}/settle`, {
        method: "POST",
        body: JSON.stringify({ winnerId, note: "Admin fair-play review completed" })
      });
      setAdminMessage("Match settled and payout ledger updated.");
      await load();
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      const result = await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(settingsForm)
      });
      setSettingsForm(result.settings);
      setAdminMessage(result.settings.manualRealMoneyMode ? "Manual real-money mode enabled by admin." : "Manual real-money mode disabled.");
      await load();
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  if (!data) return <p className="muted">Loading admin panel...</p>;
  return (
    <section className="admin-layout">
      {adminMessage && <div className="toast">{adminMessage}</div>}
      <div className="grid stats">
        <StatTile icon={User} label="Total Users" value={data.totals.users} />
        <StatTile icon={Activity} label="Active Users" value={data.totals.activeUsers} />
        <StatTile icon={ListChecks} label="Fair Matches" value={data.totals.matches} />
        <StatTile icon={Wallet} label="Withdrawals" value={data.totals.withdrawals} />
      </div>
      <div className="panel">
        <h3>Compliance Notes</h3>
        <p className="notice">Real withdrawals, UPI collection, betting, and paid contests are disabled until licensed gateway, KYC, tax, and legal compliance are integrated.</p>
      </div>
      <div className="panel">
        <h3>Manual Real-Money Mode</h3>
        <p className="notice">Keep this disabled until written lawyer/CA/gateway approval is available. This switch is admin-only.</p>
        <form className="tool-form" onSubmit={saveSettings}>
          <label className="switch-line">
            <input
              type="checkbox"
              checked={settingsForm.manualRealMoneyMode}
              onChange={(event) => setSettingsForm({
                ...settingsForm,
                manualRealMoneyMode: event.target.checked,
                complianceStatus: event.target.checked ? "approved_manual_enable" : "pending_written_legal_approval"
              })}
            />
            <span>{settingsForm.manualRealMoneyMode ? "Enabled" : "Disabled"}</span>
          </label>
          <select value={settingsForm.complianceStatus} onChange={(event) => setSettingsForm({ ...settingsForm, complianceStatus: event.target.value })}>
            <option value="pending_written_legal_approval">Pending written legal approval</option>
            <option value="approved_manual_enable">Approved for manual enable</option>
          </select>
          <button className="primary-btn">Save Platform Mode</button>
        </form>
      </div>
      <div className="panel">
        <h3>Fair Match Settlement</h3>
        <div className="compact-list">
          {data.matches?.map((match) => (
            <p key={match.id}>
              <strong>{match.gameId}</strong> Rs {match.entryAmount} - {match.status} - escrow {match.escrowAmount}
              {match.status === "active" && (
                <span className="row-actions">
                  <select value={settleForms[match.id] || match.players[0]} onChange={(event) => setSettleForms({ ...settleForms, [match.id]: event.target.value })}>
                    {match.players.map((playerId) => <option key={playerId} value={playerId}>{playerId}</option>)}
                  </select>
                  <button onClick={() => settleMatch(match)}>Settle</button>
                </span>
              )}
              {match.status === "settled" && <span> payout {match.netPayout}, fee {match.platformFee}, TDS {match.tds}</span>}
            </p>
          ))}
          {!data.matches?.length && <p className="notice">No fair matches yet.</p>}
        </div>
      </div>
      <div className="panel">
        <h3>Recent Orders</h3>
        <div className="compact-list">
          {data.orders?.map((order) => <p key={order.id}>{order.tier} - {order.amount} via {order.method} - income {order.income}</p>)}
          {!data.orders?.length && <p className="notice">No demo orders yet.</p>}
        </div>
      </div>
      <div className="panel">
        <h3>Withdrawal Requests</h3>
        <div className="compact-list">
          {data.withdrawals?.map((item) => <p key={item.id}>{item.amount} via {item.method} - {item.status.replaceAll("_", " ")}</p>)}
          {!data.withdrawals?.length && <p className="notice">No withdrawal requests yet.</p>}
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
