import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Ban,
  CircleDollarSign,
  Gamepad2,
  Home,
  LogOut,
  Medal,
  Shield,
  User,
  Wallet
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./lib/api.js";
import "./styles.css";

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "profile", label: "Profile", icon: User }
];

function App() {
  const [page, setPage] = useState("home");
  const [session, setSession] = useState({ user: null, wallet: null, scores: [] });
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!getToken()) return;
    try {
      const data = await api("/api/me");
      setSession(data);
    } catch {
      clearToken();
      setSession({ user: null, wallet: null, scores: [] });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const visibleNav = useMemo(() => {
    if (!session.user) return [{ id: "home", label: "Home", icon: Home }];
    return session.user.role === "admin" ? [...navItems, { id: "admin", label: "Admin", icon: Shield }] : navItems;
  }, [session.user]);

  function logout() {
    clearToken();
    setSession({ user: null, wallet: null, scores: [] });
    setPage("home");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Gamepad2 size={22} /></div>
          <div>
            <strong>GamingPlatform</strong>
            <span>Demo coins only</span>
          </div>
        </div>
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
            <p>{session.user ? `Welcome, ${session.user.name}` : "Play casually with demo coins"}</p>
            <h1>{titleFor(page)}</h1>
          </div>
          <div className="coin-pill">
            <CircleDollarSign size={18} />
            <span>{session.wallet?.coins ?? 0}</span>
          </div>
        </header>

        {message && <div className="toast">{message}</div>}

        {page === "home" && <HomePage session={session} setSession={setSession} setPage={setPage} setMessage={setMessage} refresh={refresh} />}
        {page === "dashboard" && <Dashboard session={session} />}
        {page === "wallet" && <WalletPage refresh={refresh} setMessage={setMessage} />}
        {page === "games" && <GamesPage refresh={refresh} setMessage={setMessage} />}
        {page === "profile" && <Profile session={session} />}
        {page === "admin" && <AdminPanel />}
      </section>
    </main>
  );
}

function titleFor(page) {
  return {
    home: "Home",
    dashboard: "Dashboard",
    wallet: "Demo Wallet",
    games: "Game Hub",
    profile: "Profile",
    admin: "Admin Panel"
  }[page];
}

function HomePage({ session, setSession, setPage, setMessage, refresh }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function submit(event) {
    event.preventDefault();
    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = mode === "signup" ? form : { email: form.email, password: form.password };
      const data = await api(path, { method: "POST", body: JSON.stringify(payload) });
      setToken(data.token);
      await refresh();
      setSession((current) => ({ ...current, user: data.user }));
      setPage("dashboard");
      setMessage(mode === "signup" ? "Signup bonus added." : "Logged in successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (session.user) {
    return (
      <section className="hero-panel">
        <div>
          <h2>Demo gaming dashboard ready hai.</h2>
          <p>No real betting, no deposit, no withdrawal. Sirf demo coins, game scores aur admin reporting.</p>
        </div>
        <button onClick={() => setPage("games")}>Open Game Hub</button>
      </section>
    );
  }

  return (
    <section className="home-grid">
      <div className="hero-panel">
        <div>
          <h2>Casual games, wallet coins, admin control.</h2>
          <p>Mobile responsive demo platform with login, secure backend, game history and wallet logs.</p>
        </div>
        <div className="feature-row">
          <span>JWT Auth</span>
          <span>Demo Wallet</span>
          <span>Admin Reports</span>
        </div>
      </div>
      <form className="auth-box" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
        </div>
        {mode === "signup" && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button>{mode === "signup" ? "Create Account" : "Login"}</button>
        <small>Admin: admin@gaming.demo / Admin@12345</small>
      </form>
    </section>
  );
}

function Dashboard({ session }) {
  return (
    <section className="grid two">
      <Metric icon={Wallet} label="Coins" value={session.wallet?.coins ?? 0} />
      <Metric icon={Medal} label="Recent Scores" value={session.scores?.length ?? 0} />
      <div className="panel span">
        <h3>Latest Activity</h3>
        <div className="list">
          {(session.scores || []).map((score) => (
            <div key={score.id} className="list-row">
              <span>{score.gameId}</span>
              <strong>{score.score} pts</strong>
              <em>+{score.reward} coins</em>
            </div>
          ))}
          {!session.scores?.length && <p className="muted">Play a game to start activity.</p>}
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WalletPage({ refresh, setMessage }) {
  const [data, setData] = useState({ wallet: { coins: 0 }, transactions: [] });

  async function load() {
    setData(await api("/api/wallet"));
  }

  useEffect(() => {
    load();
  }, []);

  async function claim() {
    try {
      const result = await api("/api/wallet/daily-reward", { method: "POST" });
      setMessage(`Daily reward +${result.amount} coins.`);
      await load();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="grid two">
      <div className="wallet-balance">
        <CircleDollarSign size={38} />
        <span>Available demo coins</span>
        <strong>{data.wallet.coins}</strong>
        <button onClick={claim}>Claim Daily Reward</button>
      </div>
      <div className="panel">
        <h3>Transaction History</h3>
        <div className="list">
          {data.transactions.map((txn) => (
            <div key={txn.id} className="list-row">
              <span>{txn.note}</span>
              <strong>+{txn.amount}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GamesPage({ refresh, setMessage }) {
  const [selected, setSelected] = useState("reaction");
  return (
    <section className="games-layout">
      <div className="game-tabs">
        {["reaction", "bingo", "ludo", "aviator"].map((game) => (
          <button key={game} className={selected === game ? "active" : ""} onClick={() => setSelected(game)}>{game}</button>
        ))}
      </div>
      {selected === "reaction" && <ReactionGame refresh={refresh} setMessage={setMessage} />}
      {selected === "bingo" && <BingoGame refresh={refresh} setMessage={setMessage} />}
      {selected === "ludo" && <LudoGame refresh={refresh} setMessage={setMessage} />}
      {selected === "aviator" && <AviatorGame refresh={refresh} setMessage={setMessage} />}
    </section>
  );
}

async function saveScore(gameId, score, refresh, setMessage) {
  const result = await api(`/api/games/${gameId}/score`, { method: "POST", body: JSON.stringify({ score }) });
  setMessage(`Score saved. Reward +${result.reward} demo coins.`);
  await refresh();
}

function ReactionGame({ refresh, setMessage }) {
  const colors = ["red", "blue", "green", "yellow"];
  const [target, setTarget] = useState("red");
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);

  useEffect(() => {
    const timer = setInterval(() => setTime((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  function tap(color) {
    if (time === 0) return;
    setScore((value) => value + (color === target ? 10 : -5));
    setTarget(colors[Math.floor(Math.random() * colors.length)]);
  }

  return (
    <div className="game-panel">
      <h3>Color Reaction</h3>
      <p>Target: <strong>{target}</strong> | Time: {time}s | Score: {score}</p>
      <div className="color-grid">
        {colors.map((color) => <button key={color} className={`color ${color}`} onClick={() => tap(color)} title={color} />)}
      </div>
      <button onClick={() => saveScore("reaction", Math.max(0, score), refresh, setMessage)}>Save Score</button>
    </div>
  );
}

function BingoGame({ refresh, setMessage }) {
  const [marked, setMarked] = useState([]);
  const numbers = Array.from({ length: 16 }, (_, index) => index + 1);
  const score = marked.length * 8;
  return (
    <div className="game-panel">
      <h3>Bingo Casual</h3>
      <div className="bingo-grid">
        {numbers.map((number) => (
          <button key={number} className={marked.includes(number) ? "marked" : ""} onClick={() => setMarked((items) => items.includes(number) ? items : [...items, number])}>{number}</button>
        ))}
      </div>
      <button onClick={() => saveScore("bingo", score, refresh, setMessage)}>Save Score</button>
    </div>
  );
}

function LudoGame({ refresh, setMessage }) {
  const [dice, setDice] = useState(1);
  const [steps, setSteps] = useState(0);
  function roll() {
    const next = Math.ceil(Math.random() * 6);
    setDice(next);
    setSteps((value) => value + next);
  }
  return (
    <div className="game-panel">
      <h3>Ludo Casual Demo</h3>
      <div className="dice">{dice}</div>
      <p>Total steps: {steps}</p>
      <button onClick={roll}>Roll Dice</button>
      <button onClick={() => saveScore("ludo", steps * 6, refresh, setMessage)}>Save Score</button>
    </div>
  );
}

function AviatorGame({ refresh, setMessage }) {
  const [multiplier, setMultiplier] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setMultiplier((value) => (value > 8 ? 1 : Number((value + 0.13).toFixed(2)))), 250);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="game-panel aviator">
      <h3>Aviator Animation Demo</h3>
      <div className="flight-line"><span style={{ left: `${Math.min(85, multiplier * 10)}%` }}>✈</span></div>
      <strong>{multiplier}x</strong>
      <button onClick={() => saveScore("aviator", Math.floor(multiplier * 100), refresh, setMessage)}>Save Score</button>
    </div>
  );
}

function Profile({ session }) {
  return (
    <section className="panel">
      <h3>Profile</h3>
      <div className="profile-lines">
        <p><span>Name</span><strong>{session.user?.name}</strong></p>
        <p><span>Email</span><strong>{session.user?.email}</strong></p>
        <p><span>Role</span><strong>{session.user?.role}</strong></p>
      </div>
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

  async function blockUser(userId, blocked) {
    await api(`/api/admin/users/${userId}/block`, { method: "PATCH", body: JSON.stringify({ blocked }) });
    await load();
  }

  if (!data) return <p className="muted">Loading admin panel...</p>;

  return (
    <section className="admin-layout">
      <div className="grid stats">
        <Metric icon={User} label="Total Users" value={data.totals.users} />
        <Metric icon={Activity} label="Active Users" value={data.totals.activeUsers} />
        <Metric icon={Gamepad2} label="Game Activity" value={data.totals.scores} />
        <Metric icon={Wallet} label="Wallet Logs" value={data.totals.transactions} />
      </div>
      <div className="panel">
        <h3>Users</h3>
        <div className="list">
          {data.users.map((user) => (
            <div key={user.id} className="list-row">
              <span>{user.name} · {user.email}</span>
              {user.role === "admin" ? <strong>Admin</strong> : (
                <button className="icon-btn" onClick={() => blockUser(user.id, !user.blocked)} title={user.blocked ? "Unblock user" : "Block user"}>
                  <Ban size={16} /> {user.blocked ? "Unblock" : "Block"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
