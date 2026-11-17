"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { io, Socket } from "socket.io-client";
import {
  Gamepad2,
  ArrowUpRight,
  ArrowRight,
  Users,
  Trophy,
  Zap,
  Search,
  ChevronRight,
  Flag,
  Crosshair,
  Footprints,
  PartyPopper,
  Puzzle,
  Joystick,
  Volume2,
  Globe,
  Plus,
  Check,
  Copy,
} from "lucide-react";
const NeonDash = dynamic(() => import("../components/NeonDash"), {
  ssr: false,
  loading: () => <div className="modal">Loading game…</div>,
});
const categories = [
  ["All games", Gamepad2],
  ["Racing", Flag],
  ["Shooters", Crosshair],
  ["Parkour", Footprints],
  ["Party Games", PartyPopper],
  ["Puzzles", Puzzle],
  ["Arcade", Joystick],
] as const;
const games = [
  {
    title: "Neon Dash",
    category: "Arcade",
    type: "2D · SOLO",
    art: "neon",
    tag: "READY TO PLAY",
    desc: "One more jump. One more high score.",
  },
  {
    title: "Sunset Circuit",
    category: "Racing",
    type: "3D · MULTIPLAYER",
    art: "racing",
    tag: "IN DEVELOPMENT",
    desc: "A little drift. A lot of friendly rivalry.",
  },
  {
    title: "Cloudbound",
    category: "Parkour",
    type: "3D · SOLO",
    art: "cloud",
    tag: "IN DEVELOPMENT",
    desc: "The only way is up.",
  },
  {
    title: "Party Planet",
    category: "Party Games",
    type: "2D · MULTIPLAYER",
    art: "party",
    tag: "IN DEVELOPMENT",
    desc: "Small games. Big friendships.",
  },
];
type Party = {
  code: string;
  host: string;
  players: { id: string; name: string }[];
  session: string | null;
};
type RecordData = { best: number; runs: number; total: number };
export default function Home() {
  const [category, setCategory] = useState("All games"),
    [query, setQuery] = useState(""),
    [playing, setPlaying] = useState(false),
    [profile, setProfile] = useState(false),
    [name, setName] = useState("Player"),
    [records, setRecords] = useState<RecordData>({
      best: 0,
      runs: 0,
      total: 0,
    }),
    [socket, setSocket] = useState<Socket | null>(null),
    [online, setOnline] = useState<number | null>(null),
    [connection, setConnection] = useState("Connecting"),
    [party, setParty] = useState<Party | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("oa-records") || "null");
      if (
        saved &&
        Number.isFinite(saved.best) &&
        Number.isFinite(saved.runs) &&
        Number.isFinite(saved.total)
      )
        setRecords(saved);
      setName(localStorage.getItem("oa-name") || "Player");
    } catch {}
    const endpoint =
      process.env.NEXT_PUBLIC_MULTIPLAYER_URL ||
      (["localhost", "127.0.0.1"].includes(location.hostname)
        ? "http://localhost:3001"
        : null);
    if (!endpoint) {
      setConnection("Offline");
      return;
    }
    const s = io(endpoint, { reconnectionAttempts: 5 });
    setSocket(s);
    s.on("connect", () => setConnection("Connected"));
    s.on("connect_error", () => {
      setConnection("Offline");
      setOnline(null);
    });
    s.on("disconnect", () => {
      setConnection("Offline");
      setOnline(null);
      setParty(null);
    });
    s.on("presence", (p) => {
      if (Number.isInteger(p.online)) setOnline(p.online);
    });
    s.on("party", setParty);
    let timer: ReturnType<typeof setTimeout>;
    s.on("session", (data) => {
      clearTimeout(timer);
      setNotice(
        "Party run starts in 3 seconds. Each player runs independently.",
      );
      timer = setTimeout(
        () => {
          setPlaying(true);
          setNotice("");
        },
        Math.max(0, data.startsAt - Date.now()),
      );
    });
    return () => {
      clearTimeout(timer);
      s.disconnect();
    };
  }, []);
  function action(action: string) {
    if (!socket?.connected) {
      setError(
        "Multiplayer is offline. Start the server or check your connection.",
      );
      return;
    }
    setPending(true);
    setError("");
    socket
      .timeout(5000)
      .emit(
        "party:action",
        { action, name, code: code.toUpperCase() },
        (err: Error | null, result: { error?: string }) => {
          setPending(false);
          if (err) setError("Request timed out. Please try again.");
          else if (result?.error) setError(result.error);
        },
      );
  }
  function saveScore(score: number) {
    setRecords((prev) => {
      const next = {
        best: Math.max(prev.best, score),
        runs: prev.runs + 1,
        total: prev.total + score,
      };
      try {
        localStorage.setItem("oa-records", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const filtered = games.filter(
    (g) =>
      (category === "All games" || g.category === category) &&
      g.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <header>
        <a className="brand" href="#home">
          <span className="brand-icon">
            <Gamepad2 size={25} />
          </span>
          online<span>arcade</span>
          <i>®</i>
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#home">
            Home
          </a>
          <a href="#games">Games</a>
          <a href="#multiplayer">Multiplayer</a>
          <a href="#leaderboards">Leaderboards</a>
        </nav>
        <button className="profile" onClick={() => setProfile(true)}>
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span>My profile</span>
          <ChevronRight size={15} />
        </button>
      </header>
      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">
              <span className="dot" /> GOOD TIMES, JUST A CLICK AWAY
            </span>
            <h1>
              Welcome to
              <br />
              <em>OnlineArcade</em>
              <span className="spark">✳</span>
            </h1>
            <p>Your arcade. Your friends. Your games.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setPlaying(true)}>
                <Gamepad2 size={19} /> Play Now <ArrowUpRight size={18} />
              </button>
              <a className="secondary" href="#games">
                Browse Games <ArrowRight size={18} />
              </a>
            </div>
            <div className="hero-note">
              <span>
                <Check size={14} /> Free to play
              </span>
              <span>
                <Check size={14} /> No downloads
              </span>
              <span>
                <Check size={14} /> Just good games
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Original colorful arcade machine illustration"
            role="img"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="float-star star-one">✦</span>
            <span className="float-star star-two">✳</span>
            <div className="floating-label">
              <Zap size={16} fill="currentColor" /> INSERT GOOD TIMES
            </div>
            <div className="arcade-machine">
              <div className="machine-top">
                ONLINE<span>★</span>ARCADE
              </div>
              <div className="machine-screen">
                <div className="screen-sun" />
                <div className="screen-mountains" />
                <div className="screen-grid" />
                <div className="screen-text">
                  LET’S
                  <br />
                  PLAY<span>PRESS START ▸</span>
                </div>
              </div>
              <div className="machine-controls">
                <div className="stick" />
                <i />
                <i />
                <i />
              </div>
              <div className="machine-base">
                <span>✦</span>
                <div />
                <b>01</b>
              </div>
            </div>
            <div className="float-card">
              <span>✌</span>
              <div>
                Better together<small>Bring your favorite people.</small>
              </div>
            </div>
            <span className="art-caption">LESS SCROLLING. MORE PLAYING.</span>
          </div>
        </section>
        <div className="ticker">
          <span>
            <Zap size={17} /> INSTANT PLAY
          </span>
          <i>✦</i>
          <span>BIG FUN. ZERO DOWNLOADS.</span>
          <i>✦</i>
          <span>
            <Users size={18} /> YOUR NEXT HANGOUT
          </span>
          <i>✦</i>
          <span>MADE FOR ONE MORE ROUND</span>
          <i>✦</i>
        </div>
        <section id="games" className="library">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT FAVORITE</span>
              <h2>
                Pick your playground<span>.</span>
              </h2>
            </div>
            <label className="search">
              <Search size={17} />
              <input
                placeholder="Search games…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search games"
              />
              <kbd>⌕</kbd>
            </label>
          </div>
          <div className="categories">
            {categories.map(([label, Icon]) => (
              <button
                key={label}
                className={category === label ? "selected" : ""}
                onClick={() => setCategory(label)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <div className="game-grid">
            {filtered.map((g, i) => (
              <article className="game-card" key={g.title}>
                <div className={`thumbnail ${g.art}`}>
                  <span
                    className={`game-tag ${g.title === "Neon Dash" ? "ready" : ""}`}
                  >
                    {g.tag}
                  </span>
                  <div className="thumb-art" aria-hidden="true">
                    {g.art === "neon" ? (
                      <>
                        <div className="neon-moon" />
                        <div className="neon-city" />
                        <div className="neon-floor" />
                        <div className="neon-runner" />
                        <strong>
                          NEON
                          <br />
                          <em>DASH</em>
                        </strong>
                      </>
                    ) : g.art === "racing" ? (
                      <>
                        <div className="race-sun" />
                        <div className="road" />
                        <span className="kart">🏎</span>
                        <strong>
                          SUNSET
                          <br />
                          <em>CIRCUIT</em>
                        </strong>
                      </>
                    ) : g.art === "cloud" ? (
                      <>
                        <span className="cloud c1">☁</span>
                        <span className="cloud c2">☁</span>
                        <div className="platform p1" />
                        <div className="platform p2" />
                        <strong>
                          CLOUD
                          <br />
                          <em>BOUND</em>
                        </strong>
                      </>
                    ) : (
                      <>
                        <span className="planet" />
                        <span className="party-face">✿</span>
                        <strong>
                          PARTY
                          <br />
                          <em>PLANET</em>
                        </strong>
                      </>
                    )}
                  </div>
                  <span className="game-type">{g.type}</span>
                </div>
                <div className="game-info">
                  <span className="game-category">{g.category}</span>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <div className="game-footer">
                    <span>
                      {g.title === "Neon Dash"
                        ? "↗ Chase your personal best"
                        : "Something good is on the way"}
                    </span>
                    {g.title === "Neon Dash" ? (
                      <button
                        onClick={() => setPlaying(true)}
                        aria-label="Play Neon Dash"
                      >
                        Play <ArrowUpRight size={16} />
                      </button>
                    ) : (
                      <span className="coming">Coming soon</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty">
              No{" "}
              {category === "All games" ? "matching" : category.toLowerCase()}{" "}
              games available yet. Try another category.
            </div>
          )}
          <p className="library-note">
            A small arcade with big plans. New worlds are in the works.{" "}
            <span>Stay for one more round. ↗</span>
          </p>
        </section>
        <section id="multiplayer" className="multiplayer">
          <div className="party-intro">
            <span className="eyebrow">
              <Users size={15} /> THE MORE, THE MERRIER
            </span>
            <h2>
              Same party.
              <br />
              <em>Different screens.</em>
            </h2>
            <p>
              Round up your crew. Create a private party, share your code, and
              make game night happen.
            </p>
            <div className="connection">
              <span
                className={`dot ${connection === "Connected" ? "" : "offline"}`}
              />
              {online !== null
                ? `${online} player${online === 1 ? "" : "s"} connected`
                : connection === "Connecting"
                  ? "Connecting to the arcade…"
                  : "Multiplayer server offline"}
              <span>• Up to 8 per party</span>
            </div>
          </div>
          <div className="party-panel">
            {party ? (
              <>
                <div className="panel-title">
                  <h3>
                    Your party <span>{party.players.length}/8</span>
                  </h3>
                  <button
                    className="text-button"
                    disabled={pending}
                    onClick={() => action("leave")}
                  >
                    Leave
                  </button>
                </div>
                <button
                  className="party-code"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(party.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setError(
                        "Copy unavailable. Select the party code manually.",
                      );
                    }
                  }}
                >
                  {party.code}
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
                <ul className="players">
                  {party.players.map((p) => (
                    <li key={p.id}>
                      <span className="avatar">{p.name[0]}</span>
                      {p.name}
                      <small>{p.id === party.host ? "HOST" : "PLAYER"}</small>
                    </li>
                  ))}
                </ul>
                {party.host === socket?.id ? (
                  <button
                    className="primary full"
                    disabled={pending}
                    onClick={() => action("start")}
                  >
                    Start a party run <ArrowRight size={16} />
                  </button>
                ) : (
                  <p>Waiting for the host to start a run.</p>
                )}
                <small className="muted">
                  Synchronized start · independent Neon Dash runs
                </small>
              </>
            ) : (
              <>
                <div className="panel-title">
                  <h3>Your crew starts here</h3>
                  <Gamepad2 size={22} />
                </div>
                <label className="field-label">
                  Player name
                  <input
                    maxLength={20}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <button
                  className="primary full"
                  disabled={pending}
                  onClick={() => action("create")}
                >
                  <Plus size={18} />
                  {pending ? "Please wait…" : "Create Party"}
                  <ArrowUpRight size={17} />
                </button>
                <div className="divider">
                  <span>or join your friends</span>
                </div>
                <div className="join-row">
                  <input
                    aria-label="Party code"
                    maxLength={6}
                    placeholder="Enter party code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  <button disabled={pending} onClick={() => action("join")}>
                    Join Party <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
          </div>
        </section>
        <section id="leaderboards" className="leaderboards">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE HEALTHY COMPETITION</span>
              <h2>
                Make your mark<span>.</span>
              </h2>
            </div>
            <span className="local-badge">
              <Trophy size={15} /> Local records
            </span>
          </div>
          <div className="record-layout">
            <div className="ranking">
              <div className="ranking-head">
                <span>PLAYER</span>
                <span>RUNS</span>
                <span>HIGH SCORE</span>
              </div>
              {records.runs ? (
                <div className="ranking-row">
                  <span>
                    <b>01</b>
                    <span className="avatar">{name[0]}</span>
                    {name}
                  </span>
                  <span>{records.runs}</span>
                  <strong>{records.best.toLocaleString()}</strong>
                </div>
              ) : (
                <div className="records-empty">
                  <Trophy size={24} />
                  <div>
                    No records. Yet.
                    <small>
                      Finish your first Neon Dash run to take the top spot.
                    </small>
                  </div>
                  <button onClick={() => setPlaying(true)}>
                    Let’s play <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
              <p>
                Records are saved on this browser. Global rankings and verified
                wins are coming later.
              </p>
            </div>
            <div className="stat-box">
              <Zap size={23} />
              <span>YOUR TOTAL SCORE</span>
              <strong>{records.total.toLocaleString()}</strong>
              <small>Every run counts.</small>
            </div>
          </div>
        </section>
        <footer>
          <a className="brand" href="#home">
            <Gamepad2 size={24} /> online<span>arcade</span>
          </a>
          <p>Good games. Great company.</p>
          <span>
            © {new Date().getFullYear()} OnlineArcade <i>✦</i> Built for play.
          </span>
        </footer>
      </main>
      {playing && (
        <NeonDash onClose={() => setPlaying(false)} onScore={saveScore} />
      )}
      {profile && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Local profile"
        >
          <div className="profile-dialog">
            <button
              className="close"
              onClick={() => setProfile(false)}
              aria-label="Close profile"
            >
              ✕
            </button>
            <span className="eyebrow">YOUR CORNER OF THE ARCADE</span>
            <h2>Hey, {name}.</h2>
            <p>Your profile is stored on this browser.</p>
            <label className="field-label">
              Display name
              <input
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className="primary full"
              onClick={() => {
                const clean = name.trim();
                if (!/^[\p{L}\p{N} _-]{1,20}$/u.test(clean)) return;
                setName(clean);
                try {
                  localStorage.setItem("oa-name", clean);
                } catch {}
                setProfile(false);
              }}
            >
              Save profile <Check size={17} />
            </button>
            <small>Use 1–20 letters, numbers, spaces, _ or -.</small>
          </div>
        </div>
      )}
    </>
  );
}
