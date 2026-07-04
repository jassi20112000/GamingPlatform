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

  async function refresh() {
    if (!getToken()) return;
    try {
      setSession(await api("/api/me"));
    } catch {
      clearToken();
      setSession({ user: null, wallet: null, scores: [] });
    }
  }

  useEffect(() => {
    refresh();
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
            <p className="ticker">DoremonKing will never ask you to send money privately. Demo mode only.</p>
            <h1>{session.user ? `Hello, ${session.user.name}` : "Welcome to DoremonKing"}</h1>
          </div>
          <div className="top-actions">
            <button className="round-action" title="Notifications"><Bell size={18} /></button>
            {session.user && <button className="round-action" onClick={logout} title="Logout"><LogOut size={18} /></button>}
          </div>
        </header>

        {message && <div className="toast">{message}</div>}

        {!session.user && <AuthPage setSession={setSession} setPage={setPage} setMessage={setMessage} refresh={refresh} />}
        {session.user && page === "dashboard" && <Dashboard session={session} setPage={setPage} orders={orders} />}
        {session.user && page === "orders" && <OrdersPage orders={orders} setOrders={setOrders} setMessage={setMessage} />}
        {session.user && page === "games" && <GamesPage refresh={refresh} setMessage={setMessage} />}
        {session.user && page === "team" && <TeamPage />}
        {session.user && page === "profile" && <Profile session={session} logout={logout} />}
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

function Dashboard({ session, setPage, orders }) {
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
      <button className="promo outline" onClick={() => setPage("games")}>Play fair Mines, Aviator and Ludo demo</button>
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

function OrdersPage({ orders, setOrders, setMessage }) {
  const [mode, setMode] = useState("buy");
  const [tier, setTier] = useState("Small");
  const filtered = orderCards.filter((card) => card.tier === tier);

  function placeOrder(card) {
    const income = Number((card.amount * card.rate / 100).toFixed(2));
    setOrders((items) => [{ ...card, income, time: new Date().toLocaleTimeString() }, ...items]);
    setMessage(`Demo order completed: +${income.toFixed(2)} demo rupees.`);
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
        <div className="empty-state">Sell orders will appear after demo orders are completed.</div>
      )}
    </section>
  );
}

function GamesPage({ refresh, setMessage }) {
  const [selected, setSelected] = useState("mines");
  return (
    <section className="games-layout">
      <div className="game-tabs">
        {["mines", "aviator", "ludo", "cricket"].map((game) => (
          <button key={game} className={selected === game ? "active" : ""} onClick={() => setSelected(game)}>{game}</button>
        ))}
      </div>
      {selected === "mines" && <MinesGame refresh={refresh} setMessage={setMessage} />}
      {selected === "aviator" && <AviatorGame refresh={refresh} setMessage={setMessage} />}
      {selected === "ludo" && <LudoGame refresh={refresh} setMessage={setMessage} />}
      {selected === "cricket" && <CricketDemo />}
    </section>
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

function Profile({ session, logout }) {
  const rows = ["Bill detail", "Invite subline", "Email bind", "Login password", "Pin code", "Telegram bind", "UPI/Bank demo setup"];
  return (
    <section className="profile-card">
      <div className="profile-head">
        <div className="avatar"><User /></div>
        <div>
          <h3>{session.user?.name}</h3>
          <p>{session.user?.email}</p>
        </div>
      </div>
      {rows.map((row) => <button key={row} className="profile-row">{row}<span>›</span></button>)}
      <button className="profile-row logout-row" onClick={logout}>Logout<span>›</span></button>
    </section>
  );
}

function AdminPanel() {
  const [data, setData] = useState(null);
  async function load() {
    setData(await api("/api/admin/overview"));
  }
  useEffect(() => {
    load();
  }, []);
  if (!data) return <p className="muted">Loading admin panel...</p>;
  return (
    <section className="admin-layout">
      <div className="grid stats">
        <StatTile icon={User} label="Total Users" value={data.totals.users} />
        <StatTile icon={Activity} label="Active Users" value={data.totals.activeUsers} />
        <StatTile icon={Gamepad2} label="Game Activity" value={data.totals.scores} />
        <StatTile icon={Wallet} label="Wallet Logs" value={data.totals.transactions} />
      </div>
      <div className="panel">
        <h3>Compliance Notes</h3>
        <p className="notice">Real withdrawals, UPI collection, betting, and paid contests are disabled until licensed gateway, KYC, tax, and legal compliance are integrated.</p>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
