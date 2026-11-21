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
import {
  games,
  gameById,
  rankedGames,
  type GameDefinition,
} from "../lib/catalog";
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
  Users,
  Trophy,
  Zap,
  Search,
  Flag,
  Crosshair,
  Footprints,
  PartyPopper,
  Puzzle,
  Joystick,
  Play,
} from "lucide-react";
function LoadingGame() {
  return (
    <div className="play-loading" role="status">
      Loading game…
    </div>
  );
}
const Cloudbound = dynamic(() => import("./Cloudbound"), {
  ssr: false,
  loading: LoadingGame,
});
const Boostball = dynamic(() => import("./Boostball"), {
  ssr: false,
  loading: LoadingGame,
});
const PartyPlanet = dynamic(() => import("./PartyPlanet"), {
  ssr: false,
  loading: LoadingGame,
});
const OnlineKart = dynamic(() => import("./OnlineKart"), {
  ssr: false,
  loading: LoadingGame,
});
const GamePlayer = dynamic(() => import("./GamePlayer"), {
  ssr: false,
  loading: LoadingGame,
});
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const partyGames = {
  boostball: "boostball",
  "party-planet": "party-planet",
  "sunset-circuit": "kart-circuit",
} as const;
const isPartyGame = (id: GameDefinition["id"]): id is keyof typeof partyGames =>
  id in partyGames;

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
  const [onlineRace, setOnlineRace] = useState<OnlineRaceLink | null>(null);
  const [boardMode, setBoardMode] = useState<"local" | "community">(
    "community",
  );
  const [category, setCategory] = useState("All games"),
    [query, setQuery] = useState(""),
    [playing, setPlaying] = useState<GameDefinition["id"] | null>(null),
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
  const search = query.trim().toLowerCase();
  const filtered = games.filter(
    (game) =>
      (category === "All games" || game.category === category) &&
      `${game.title} ${game.category} ${game.desc}`
        .toLowerCase()
        .includes(search),
  );
  const closeGame = () => {
    setPlaying(null);
    setOnlineRace(null);
  };
  const chooseParty = (game: keyof typeof partyGames) => {
    closeGame();
    window.dispatchEvent(
      new CustomEvent("oa:choose-party-game", { detail: partyGames[game] }),
    );
    requestAnimationFrame(() => {
      const heading = document.getElementById("party-heading");
      heading?.focus({ preventScroll: true });
      document
        .getElementById("multiplayer")
        ?.scrollIntoView({ block: "start" });
    });
  };
  const personal = (cloud.user ? cloud.progress : progress).games;
  return (
    <>
      <header className="arcade-header">
        <a className="brand" href="#home" aria-label="OnlineArcade home">
          <span className="brand-icon">
            <Gamepad2 size={21} aria-hidden="true" />
          </span>
          online<span>arcade</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#games">Games</a>
          <a href="#multiplayer">Multiplayer</a>
          <a href="#leaderboards">Leaderboards</a>
        </nav>
        <button
          className="profile"
          onClick={() => setProfile(true)}
          aria-label={cloud.user ? "My account" : "Sign in or view profile"}
        >
          <span className="avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {cloud.user
              ? "My account"
              : cloud.configured
                ? "Sign in"
                : "Profile"}
          </span>
        </button>
      </header>
      <main id="home" className="arcade-home">
        <section className="arcade-hero" aria-labelledby="arcade-title">
          <img
            className="arcade-hero-art"
            src={`${basePath}/art/boostball-stadium.webp`}
            alt=""
            width={1536}
            height={1024}
            fetchPriority="high"
          />
          <div className="arcade-hero-copy">
            <h1 id="arcade-title">
              <span>Welcome to</span>OnlineArcade
            </h1>
            <p>Your arcade. Your friends. Your games.</p>
            <div className="hero-actions">
              <button
                className="primary"
                onClick={() => setPlaying("boostball")}
              >
                <Play size={18} fill="currentColor" aria-hidden="true" /> Play
                Boostball
              </button>
              <a className="secondary" href="#games">
                Browse games
              </a>
            </div>
          </div>
          <div className="arcade-hero-caption">
            <span className="arcade-feature-mark" aria-hidden="true">
              <Gamepad2 size={18} />
            </span>
            <span>
              <strong>Boostball</strong>
              <small>3D car soccer · 2–8 online</small>
            </span>
          </div>
        </section>
        <section id="games" className="library arcade-library">
          <div className="section-heading arcade-library-heading">
            <div>
              <h2>Game library</h2>
              <p role="status">
                {filtered.length} {filtered.length === 1 ? "game" : "games"}
              </p>
            </div>
            <label className="search arcade-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search games"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search games"
              />
            </label>
          </div>
          <div
            className="categories arcade-categories"
            aria-label="Game categories"
          >
            {categories.map(([label, Icon]) => (
              <button
                key={label}
                className={category === label ? "selected" : ""}
                aria-pressed={category === label}
                onClick={() => setCategory(label)}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <div className="game-grid arcade-grid">
            {filtered.map((game) => {
              const stats = rankedGames.some((ranked) => ranked.id === game.id)
                ? personal[game.id as GameId]
                : null;
              return (
                <article className="game-card arcade-card" key={game.id}>
                  <div className={`thumbnail ${game.art}`}>
                    <GameArtwork game={game} />
                    <span className="game-type">{game.type}</span>
                  </div>
                  <div className="game-info">
                    <div className="arcade-card-heading">
                      <h3>{game.title}</h3>
                      <span className="game-category">{game.category}</span>
                    </div>
                    <p>{game.desc}</p>
                    {stats?.runs ? (
                      <small className="arcade-card-best">
                        <Trophy size={13} /> Best {stats.best.toLocaleString()}
                      </small>
                    ) : null}
                    <div className="arcade-card-actions">
                      {game.playable ? (
                        <button
                          className="arcade-card-play"
                          onClick={() => setPlaying(game.id)}
                          aria-label={`Play ${game.title}`}
                        >
                          <Play
                            size={14}
                            fill="currentColor"
                            aria-hidden="true"
                          />{" "}
                          Play
                        </button>
                      ) : (
                        <span className="coming">Coming soon</span>
                      )}
                      {isPartyGame(game.id) && (
                        <button
                          className="arcade-card-friends"
                          aria-label={`Play ${game.title} with friends`}
                          onClick={() => {
                            if (isPartyGame(game.id)) chooseParty(game.id);
                          }}
                        >
                          <Users size={15} aria-hidden="true" /> Friends
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!filtered.length && (
            <div className="empty arcade-empty">
              <Search size={22} aria-hidden="true" />
              <strong>No games found</strong>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("All games");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
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
              <h2>Leaderboards</h2>
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
                      Play {gameById(boardGame).title}
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
      {playing === "cloudbound" && (
        <Cloudbound accountId={cloud.user?.id} onClose={closeGame} />
      )}
      {(playing === "boostball" ||
        onlineRace?.session.game === "boostball") && (
        <Boostball
          key={onlineRace?.session.id ?? "solo-boostball"}
          link={
            onlineRace?.session.game === "boostball" ? onlineRace : undefined
          }
          onClose={closeGame}
          onFriends={() => chooseParty("boostball")}
        />
      )}
      {(playing === "party-planet" ||
        onlineRace?.session.game === "party-planet") && (
        <PartyPlanet
          key={onlineRace?.session.id ?? "solo-planet"}
          link={
            onlineRace?.session.game === "party-planet" ? onlineRace : undefined
          }
          onClose={closeGame}
          onFriends={() => chooseParty("party-planet")}
        />
      )}
      {onlineRace?.session.game === "kart-circuit" && (
        <OnlineKart
          key={onlineRace.session.id}
          link={onlineRace}
          onClose={closeGame}
        />
      )}
      {playing &&
        playing !== "cloudbound" &&
        playing !== "boostball" &&
        playing !== "party-planet" && (
          <GamePlayer
            key={playing}
            gameId={playing}
            onClose={closeGame}
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
