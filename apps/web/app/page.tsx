"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  emptyProgress,
  emptyStats,
  recordRun,
  type GameId,
  type LocalProgress,
} from "@onlinearcade/core";
import { games, gameById, playableGames } from "../lib/catalog";
import { BrowserProgressRepository } from "../lib/progress";
import GameArtwork from "../components/GameArtwork";
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
  Plus,
  Check,
  Copy,
} from "lucide-react";
const NeonDash = dynamic(() => import("../components/NeonDash"), {
  ssr: false,
  loading: () => <div className="modal">Loading game…</div>,
});
const GamePlayer = dynamic(() => import("../components/GamePlayer"), {
  ssr: false,
  loading: () => <div className="modal">Loading game engine…</div>,
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
type Party = {
  code: string;
  host: string;
  players: { id: string; name: string }[];
  session: string | null;
};

export default function Home() {
  const [category, setCategory] = useState("All games"),
    [query, setQuery] = useState(""),
    [playing, setPlaying] = useState<GameId | null>(null),
    [profile, setProfile] = useState(false),
    [name, setName] = useState("Player"),
    [progress, setProgress] = useState<LocalProgress>(emptyProgress),
    [boardGame, setBoardGame] = useState<GameId>("neon-dash"),
    [storageNotice, setStorageNotice] = useState(""),
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
      setProgress(new BrowserProgressRepository(localStorage).load());
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
          setPlaying("neon-dash");
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
  const records = progress.games[boardGame] || emptyStats();
  function saveScore(gameId: GameId, score: number) {
    // Persist outside React state updaters: Strict Mode may invoke updaters twice.
    let next: LocalProgress;
    try {
      next = recordRun(progress, gameId, score);
    } catch {
      return;
    }
    setProgress(next);
    setBoardGame(gameId);
    try {
      new BrowserProgressRepository(localStorage).save(next);
    } catch {
      setStorageNotice(
        "Browser storage is unavailable. Your scores will last for this visit only.",
      );
    }
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
              <span className="dot" /> YOUR NEXT HIGH SCORE STARTS HERE
            </span>
            <h1>
              Less waiting.
              <br />
              <em>More playing.</em>
              <span className="spark">✳</span>
            </h1>
            <p>
              Your arcade. Your friends. Your games. Five original worlds, one
              more round.
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                onClick={() => setPlaying("neon-dash")}
              >
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
          <button
            className="featured-world"
            onClick={() => setPlaying("sunset-circuit")}
            aria-label="Play Sunset Circuit 3D time trial"
          >
            <GameArtwork game={gameById("sunset-circuit")} />
            <div className="featured-top">
              <span className="pill">
                <span className="dot" /> NEW WORLD UNLOCKED
              </span>
              <span className="dimension-badge">3D</span>
            </div>
            <div className="featured-bottom">
              <span className="eyebrow">TAKE THE SCENIC ROUTE</span>
              <h2>Sunset Circuit</h2>
              <p>Golden skies. Tight corners. Your fastest lap.</p>
              <span className="featured-play">
                Jump in <ArrowUpRight size={18} />
              </span>
            </div>
          </button>
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
            {filtered.map((g) => (
              <article className="game-card" key={g.title}>
                <div className={`thumbnail ${g.art}`}>
                  <span className={`game-tag ${g.playable ? "ready" : ""}`}>
                    {g.tag}
                  </span>
                  <GameArtwork game={g} />
                  <span className="game-type">{g.type}</span>
                </div>
                <div className="game-info">
                  <span className="game-category">{g.category}</span>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <div className="game-footer">
                    <span>
                      {g.playable
                        ? "↗ Chase your personal best"
                        : "Something good is on the way"}
                    </span>
                    {g.playable ? (
                      <button
                        onClick={() => setPlaying(g.id as GameId)}
                        aria-label={`Play ${g.title}`}
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
            Five playable originals. Fresh challenges. No downloads.{" "}
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
          <div className="board-filters" aria-label="Leaderboard game">
            {playableGames.map((g) => (
              <button
                key={g.id}
                aria-pressed={boardGame === g.id}
                className={boardGame === g.id ? "selected" : ""}
                onClick={() => setBoardGame(g.id as GameId)}
              >
                {g.title}
              </button>
            ))}
          </div>
          {storageNotice && (
            <p className="error" role="status">
              {storageNotice}
            </p>
          )}
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
                      Finish a {gameById(boardGame).title} run to set your first
                      record.
                    </small>
                  </div>
                  <button onClick={() => setPlaying(boardGame)}>
                    Let’s play <ArrowUpRight size={16} />
                  </button>
                </div>
              )}
              <p>
                {gameById(boardGame).title} · Records are saved on this browser.
                Account sync and verified global rankings are planned.
              </p>
            </div>
            <div className="stat-box">
              <Zap size={23} />
              <span>TOTAL SCORE · THIS GAME</span>
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
      {playing === "neon-dash" && (
        <NeonDash
          onClose={() => setPlaying(null)}
          onScore={(score) => saveScore("neon-dash", score)}
        />
      )}
      {playing && playing !== "neon-dash" && (
        <GamePlayer
          key={playing}
          gameId={playing}
          onClose={() => setPlaying(null)}
          onScore={(score) => saveScore(playing, score)}
        />
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
            <p>
              Your profile and game records are stored on this browser. Accounts
              and cross-device sync are planned.
            </p>
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
