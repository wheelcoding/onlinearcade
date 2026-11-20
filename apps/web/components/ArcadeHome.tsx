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
import { games, gameById, rankedGames } from "../lib/catalog";
import { BrowserProgressRepository } from "../lib/progress";
import GameArtwork from "../components/GameArtwork";
import AccountProvider, { useAccount } from "./account/AccountProvider";
import AccountDialog from "../components/account/AccountDialog";
import CloudLeaderboard from "../components/account/CloudLeaderboard";
import type { OnlineRaceLink } from "../lib/use-party";
import PartyLobby from "../components/PartyLobby";
import {
  Heart,
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
  Check,
} from "lucide-react";
const Cloudbound = dynamic(() => import("../components/Cloudbound"), {
  ssr: false,
  loading: () => (
    <div className="modal">
      <div className="game-dialog" role="status">
        Preparing Cloudbound…
      </div>
    </div>
  ),
});
const PartyPlanet = dynamic(() => import("../components/PartyPlanet"), {
  ssr: false,
});
const OnlineKart = dynamic(() => import("../components/OnlineKart"), {
  ssr: false,
});
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
function ArcadeContent() {
  const cloud = useAccount();
  const [planetOpen, setPlanetOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [onlineRace, setOnlineRace] = useState<OnlineRaceLink | null>(null);
  const [boardMode, setBoardMode] = useState<"local" | "community">(
    "community",
  );
  const [category, setCategory] = useState("All games"),
    [query, setQuery] = useState(""),
    [playing, setPlaying] = useState<GameId | null>(null),
    [profile, setProfile] = useState(false),
    [guestName, setGuestName] = useState("Player"),
    [progress, setProgress] = useState<LocalProgress>(emptyProgress),
    [boardGame, setBoardGame] = useState<GameId>("neon-dash"),
    [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    try {
      setProgress(new BrowserProgressRepository(localStorage).load());
      setGuestName(localStorage.getItem("oa-name") || "Player");
    } catch {}
  }, []);
  useEffect(() => {
    if (cloud.recovering) setProfile(true);
  }, [cloud.recovering]);
  const name = cloud.account?.displayName || guestName;
  const records =
    (cloud.user ? cloud.progress : progress).games[boardGame] || emptyStats();
  function saveScore(gameId: GameId, score: number) {
    if (cloud.user) {
      setBoardGame(gameId);
      if (gameId !== "sunset-circuit") cloud.submitGame(gameId, score);
      return;
    }
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
          <span>
            {cloud.user
              ? "My account"
              : cloud.configured
                ? "Sign in / Profile"
                : "My profile"}
          </span>
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
              Your arcade. Your friends. Your games. Seven original worlds, one
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
            aria-label="Play Sunset Circuit kart racing"
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
              <p>Four circuits. Five drivers. Earn your podium.</p>
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
                        ? g.id === "cloudbound"
                          ? "↗ Climb to your personal best"
                          : g.id === "party-planet"
                            ? "↗ Practice or play with friends"
                            : "↗ Chase your personal best"
                        : "Something good is on the way"}
                    </span>
                    {g.playable ? (
                      <button
                        onClick={() =>
                          g.id === "cloudbound"
                            ? setCloudOpen(true)
                            : g.id === "party-planet"
                              ? setPlanetOpen(true)
                              : setPlaying(g.id as GameId)
                        }
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
            Seven playable originals. Fresh challenges. No downloads.{" "}
            <span>Stay for one more round. ↗</span>
          </p>
        </section>
        <aside
          className="grubhub-ad"
          aria-label="Grubhub referral advertisement"
        >
          <div className="grubhub-ad-art" aria-hidden="true">
            <span className="grubhub-spark spark-one">✦</span>
            <span className="grubhub-spark spark-two">✦</span>
            <svg viewBox="0 0 220 220" fill="none" focusable="false">
              <circle
                cx="110"
                cy="111"
                r="92"
                fill="#E6C7A1"
                fillOpacity=".12"
              />
              <circle cx="110" cy="111" r="78" fill="#F4DFC0" />
              <circle
                cx="110"
                cy="111"
                r="65"
                stroke="#D7B88F"
                strokeWidth="2"
              />
              <path
                d="M59 69Q110 39 164 69L118 170Q113 179 108 170Z"
                fill="#B25231"
                fillOpacity=".25"
                transform="translate(4 8)"
              />
              <path
                d="M59 69Q110 39 164 69L118 170Q113 179 108 170Z"
                fill="#F6BB62"
                stroke="#CF7D3D"
                strokeWidth="3"
              />
              <path d="M65 78Q110 52 157 78L114 166Z" fill="#F7DB8F" />
              <path
                d="M59 69Q110 39 164 69"
                stroke="#D9944E"
                strokeWidth="15"
                strokeLinecap="round"
              />
              <path
                d="M61 65Q110 38 162 65"
                stroke="#F5C183"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle cx="95" cy="87" r="13" fill="#C95D45" />
              <circle cx="130" cy="98" r="12" fill="#C95D45" />
              <circle cx="111" cy="130" r="11" fill="#C95D45" />
              <path d="M112 77Q131 65 128 82Q119 90 112 77Z" fill="#638E66" />
              <path d="M89 111Q75 116 91 126Q102 122 89 111Z" fill="#638E66" />
              <circle cx="94" cy="83" r="3" fill="#E98B64" />
              <circle cx="128" cy="94" r="3" fill="#E98B64" />
              <circle cx="109" cy="127" r="3" fill="#E98B64" />
            </svg>
            <span className="grubhub-ad-sticker">
              <strong>$10</strong>
              <span>OFF YOUR FIRST ORDER</span>
            </span>
          </div>
          <div className="grubhub-ad-copy">
            <div className="grubhub-ad-topline">
              <span className="grubhub-ad-brand">Grubhub</span>
              <span className="grubhub-ad-disclosure">Ad · referral link</span>
            </div>
            <p className="grubhub-ad-kicker">FUEL YOUR NEXT ROUND</p>
            <h2>
              Get <span>$10 off</span> when you place your first Grubhub order
            </h2>
            <a
              className="grubhub-ad-link"
              href="https://www.grubhub.com/referral/6c6f84c0-c2ab-11f1-a795-f3639ed6276f"
              target="_blank"
              rel="sponsored noopener noreferrer"
            >
              Click to get $10 off{" "}
              <span className="grubhub-ad-arrow">
                <ArrowUpRight size={19} aria-hidden="true" />
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </aside>
        <PartyLobby
          name={name}
          onNameChange={setGuestName}
          signedIn={!!cloud.user}
          onStart={(race) => {
            setPlanetOpen(false);
            setCloudOpen(false);
            if (race) {
              setPlaying(null);
              setOnlineRace(race);
            } else {
              setOnlineRace(null);
              setPlaying("neon-dash");
            }
          }}
        />
        <section id="leaderboards" className="leaderboards">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE HEALTHY COMPETITION</span>
              <h2>
                Make your mark<span>.</span>
              </h2>
            </div>
            <span className="local-badge">
              <Trophy size={15} />{" "}
              {boardMode === "community" && cloud.configured
                ? "Community · unverified"
                : cloud.user
                  ? "My cloud records"
                  : "Local records"}
            </span>
          </div>
          <div className="board-modes">
            <button
              aria-pressed={boardMode === "community"}
              disabled={!cloud.configured}
              title={
                !cloud.configured
                  ? "Community boards are being configured"
                  : undefined
              }
              onClick={() => setBoardMode("community")}
            >
              Community leaderboard
            </button>
            <button
              aria-pressed={boardMode === "local"}
              onClick={() => setBoardMode("local")}
            >
              {cloud.user ? "My cloud records" : "This browser"}
            </button>
            {!cloud.user && (
              <button
                className="account-callout"
                onClick={() => setProfile(true)}
              >
                Sign in to save across devices →
              </button>
            )}
          </div>
          {cloud.user && (
            <div className="sync-notice" role="status">
              {cloud.syncing
                ? "Saving results…"
                : cloud.pending
                  ? `${cloud.pending} run(s) waiting to sync`
                  : cloud.error || "Signed in · New runs save across devices"}
              {(cloud.pending > 0 || cloud.error) && (
                <button onClick={cloud.retry}>Retry sync</button>
              )}
            </div>
          )}
          <div className="board-filters" aria-label="Leaderboard game">
            {rankedGames.map((g) => (
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
          {boardMode === "community" && cloud.configured ? (
            <CloudLeaderboard
              gameId={boardGame}
              onSignIn={() => setProfile(true)}
            />
          ) : (
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
                        Finish a {gameById(boardGame).title} run to set your
                        first record.
                      </small>
                    </div>
                    <button onClick={() => setPlaying(boardGame)}>
                      Let’s play <ArrowUpRight size={16} />
                    </button>
                  </div>
                )}
                <p>
                  {gameById(boardGame).title} ·{" "}
                  {cloud.user
                    ? "Your account records, available across devices."
                    : "Guest records are saved on this browser. Sign in to save new runs across devices."}
                </p>
              </div>
              <div className="stat-box">
                <Zap size={23} />
                <span>TOTAL SCORE · THIS GAME</span>
                <strong>{records.total.toLocaleString()}</strong>
                <small>Every run counts.</small>
              </div>
            </div>
          )}
        </section>
        <section
          className="support-banner"
          aria-label="Support wheelcoding OnlineArcade"
        >
          <span className="support-banner-icon" aria-hidden="true">
            <Heart size={27} />
          </span>
          <div className="support-banner-copy">
            <span className="eyebrow">A LITTLE SUPPORT. A LOT OF PLAY.</span>
            <h2>Support wheelcoding OnlineArcade</h2>
            <p>Enjoying the games? Show your support.</p>
          </div>
          <a
            className="support-banner-link"
            href="https://square.link/u/re4xmK3B"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support wheelcoding OnlineArcade (opens in a new tab)"
          >
            Support the arcade <ArrowUpRight size={19} aria-hidden="true" />
          </a>
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
      {cloudOpen && (
        <Cloudbound
          accountId={cloud.user?.id}
          onClose={() => setCloudOpen(false)}
        />
      )}
      {(planetOpen || onlineRace?.session.game === "party-planet") && (
        <PartyPlanet
          link={
            onlineRace?.session.game === "party-planet" ? onlineRace : undefined
          }
          onClose={() => {
            setPlanetOpen(false);
            setOnlineRace(null);
          }}
          onFriends={() => {
            setPlanetOpen(false);
            window.dispatchEvent(new Event("oa:party-planet"));
            document
              .getElementById("multiplayer")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}
      {onlineRace && onlineRace.session.game !== "party-planet" && (
        <OnlineKart link={onlineRace} onClose={() => setOnlineRace(null)} />
      )}
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
        <AccountDialog
          guestName={guestName}
          onClose={() => setProfile(false)}
          onGuestSave={(value) => {
            setGuestName(value);
            try {
              localStorage.setItem("oa-name", value);
            } catch {}
          }}
        />
      )}
    </>
  );
}

export default function ArcadeHome() {
  return (
    <AccountProvider>
      <ArcadeContent />
    </AccountProvider>
  );
}
