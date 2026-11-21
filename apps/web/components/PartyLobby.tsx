"use client";
import { useEffect, useRef, useState } from "react";
import {
  Gamepad2,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Copy,
  Check,
  Send,
  RefreshCw,
} from "lucide-react";
import { TRACKS, type TrackId } from "@onlinearcade/core";
import { useParty, type OnlineRaceLink } from "../lib/use-party";
export default function PartyLobby({
  name,
  onNameChange,
  signedIn,
  onStart,
}: {
  name: string;
  onNameChange: (name: string) => void;
  signedIn: boolean;
  onStart: (race?: OnlineRaceLink) => void;
}) {
  const lobby = useParty(onStart),
    { party, status, online, memberId, pending, action } = lobby;
  const [partyGame, setPartyGame] = useState<
      "neon-dash" | "kart-circuit" | "party-planet" | "boostball"
    >("kart-circuit"),
    [track, setTrack] = useState<TrackId>("sunset-bay"),
    [code, setCode] = useState(""),
    [copied, setCopied] = useState(false),
    [draft, setDraft] = useState("");
  useEffect(() => {
    const select = (event: Event) => {
      const game = (event as CustomEvent<unknown>).detail;
      if (
        game === "boostball" ||
        game === "party-planet" ||
        game === "kart-circuit"
      )
        setPartyGame(game);
    };
    window.addEventListener("oa:choose-party-game", select);
    return () => window.removeEventListener("oa:choose-party-game", select);
  }, []);
  const messages = useRef<HTMLDivElement>(null),
    copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setDraft("");
    setCopied(false);
  }, [party?.code]);
  useEffect(() => {
    const box = messages.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [party?.messages.length]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const connected = status === "connected",
    host = party?.host === memberId,
    self = party?.players.find((p) => p.id === memberId),
    allReady =
      !!party &&
      party.players.length >= 2 &&
      party.players.every((p) => p.ready && p.connected);
  const copy = async () => {
    if (!party) return;
    try {
      await navigator.clipboard.writeText(party.code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      lobby.setError("Copy unavailable. Select the code and copy it manually.");
    }
  };
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text && (await action({ action: "chat", text }))) setDraft("");
  }
  return (
    <section id="multiplayer" className="multiplayer">
      <div className="party-intro">
        <h2 id="party-heading" tabIndex={-1}>
          Play with friends
        </h2>
        <p>
          Create a private party and share its code. Chat in the lobby, then
          race, play car soccer, or compete in Party Planet.
        </p>
        <div className="connection" role="status">
          <span className={`dot ${connected ? "" : "offline"}`} />
          {connected
            ? online === null
              ? "Connected to the arcade"
              : `${online} player${online === 1 ? "" : "s"} connected`
            : status === "unconfigured"
              ? "Online parties are awaiting server activation"
              : status === "offline"
                ? "You are offline"
                : status === "reconnecting"
                  ? "Reconnecting · server may be waking up…"
                  : "Connecting to the arcade…"}
          <span>• Up to 8 per party</span>
        </div>
        <p className="party-privacy">
          Guest names are not verified account identities. Chat is visible only
          to room members and clears when the room closes. Share codes only with
          people you trust.
        </p>
      </div>
      <div className="party-panel">
        {status === "unconfigured" ? (
          <div className="party-setup-note">
            <Gamepad2 size={28} />
            <h3>Party server setup is needed</h3>
            <p>
              The website is online, but a public multiplayer server has not
              been connected yet. Solo games are ready to play.
            </p>
            <p>
              The site owner needs to deploy the Node server and configure its
              HTTPS address.{" "}
              <a
                href="https://github.com/wheelcoding/onlinearcade/blob/main/docs/multiplayer-deployment.md"
                target="_blank"
                rel="noreferrer"
              >
                Open setup instructions ↗
              </a>
            </p>
          </div>
        ) : (
          <>
            {!connected && (
              <div className="party-reconnect" role="status">
                <p>
                  {status === "offline"
                    ? "Reconnect to the internet to rejoin your crew."
                    : "Connecting securely to the party server. A sleeping free server can take about a minute to start."}
                </p>
                <button
                  onClick={lobby.reconnect}
                  disabled={status === "offline"}
                >
                  <RefreshCw size={14} /> Retry connection
                </button>
              </div>
            )}
            {party ? (
              <>
                <div className="panel-title">
                  <h3>
                    Your party{" "}
                    <span>
                      {party.players.filter((p) => p.connected).length} online /{" "}
                      {party.players.length} members
                    </span>
                  </h3>
                  <button
                    className="text-button"
                    disabled={pending || !connected}
                    onClick={() => action({ action: "leave" })}
                  >
                    Leave
                  </button>
                </div>
                <div className="party-invite">
                  <code>{party.code}</code>
                  <button onClick={copy} aria-label="Copy party code">
                    {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                    {copied ? "Copied" : "Copy code"}
                  </button>
                </div>
                <ul className="players">
                  {party.players.map((p) => (
                    <li key={p.id}>
                      <span className="avatar">{p.name[0]}</span>
                      <span className="party-player-name">
                        {p.name}
                        {p.id === memberId ? " (you)" : ""}
                        <small>
                          {p.id === party.host ? "HOST · " : ""}
                          {!p.connected
                            ? "RECONNECTING"
                            : p.ready
                              ? "READY"
                              : "NOT READY"}
                        </small>
                      </span>
                      {host && p.id !== memberId && (
                        <button
                          className="text-button"
                          aria-label={`Remove ${p.name} from party`}
                          disabled={pending || !connected}
                          onClick={() =>
                            action({ action: "kick", playerId: p.id })
                          }
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {host && (
                  <div className="party-race-options">
                    <label>
                      Party game{" "}
                      <select
                        aria-label="Party game"
                        value={partyGame}
                        disabled={pending}
                        onChange={(e) =>
                          setPartyGame(e.target.value as typeof partyGame)
                        }
                      >
                        <option value="kart-circuit">
                          Sunset Circuit · shared race
                        </option>
                        <option value="boostball">
                          Boostball · team car soccer
                        </option>
                        <option value="party-planet">
                          Party Planet · three mini-games
                        </option>
                        <option value="neon-dash">
                          Neon Dash · independent runs
                        </option>
                      </select>
                    </label>
                    {partyGame === "kart-circuit" && (
                      <label>
                        Track{" "}
                        <select
                          aria-label="Party race track"
                          value={track}
                          onChange={(e) => setTrack(e.target.value as TrackId)}
                        >
                          {TRACKS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                {host &&
                  partyGame === "party-planet" &&
                  !lobby.features.includes("party-planet") && (
                    <p role="status">
                      Party Planet is waiting for the server update. Deploy the
                      latest commit in Render. Solo practice is available from
                      the game library.
                    </p>
                  )}
                <div className="party-ready-actions">
                  <button
                    className={self?.ready ? "secondary" : "primary"}
                    disabled={pending || !connected}
                    onClick={() =>
                      action({ action: "ready", ready: !self?.ready })
                    }
                  >
                    {self?.ready ? "✓ Ready · cancel" : "I’m ready"}
                  </button>
                  {host ? (
                    <button
                      className="primary"
                      disabled={
                        pending ||
                        !connected ||
                        !allReady ||
                        (partyGame === "party-planet" &&
                          !lobby.features.includes("party-planet")) ||
                        (partyGame === "boostball" &&
                          !lobby.features.includes("boostball-3d"))
                      }
                      onClick={() =>
                        action({ action: "start", game: partyGame, track })
                      }
                    >
                      Start party run <ArrowRight size={15} />
                    </button>
                  ) : (
                    <span>Waiting for the host</span>
                  )}
                </div>
                <small className="muted">
                  {party.players.length < 2
                    ? "Invite a friend to start a party run."
                    : !allReady
                      ? "Everyone must be connected and ready."
                      : "Ready to go!"}{" "}
                  {partyGame === "boostball" &&
                    !lobby.features.includes("boostball-3d") && (
                      <span role="status">
                        Boostball 3D needs the latest Render server
                        deployment.{" "}
                      </span>
                    )}
                  Sunset Circuit uses a shared server-controlled race. Neon Dash
                  runs are independent.
                </small>
                <div className="party-chat">
                  <div className="chat-heading">
                    <h4>Party chat</h4>
                    <span>Room only · last 50 messages</span>
                  </div>
                  <div
                    className="chat-messages"
                    ref={messages}
                    role="log"
                    aria-label="Party messages"
                    aria-live="polite"
                    aria-relevant="additions"
                  >
                    {party.messages.length ? (
                      party.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`chat-message ${m.playerId === memberId ? "own" : ""}`}
                        >
                          <div>
                            <b>{m.name}</b>
                            <time dateTime={new Date(m.sentAt).toISOString()}>
                              {new Date(m.sentAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                          <p>{m.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="chat-empty">
                        Your room is ready. Say hello to your crew.
                      </p>
                    )}
                  </div>
                  <form onSubmit={send} className="chat-compose">
                    <label className="sr-only" htmlFor="party-message">
                      Message your party
                    </label>
                    <input
                      id="party-message"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={300}
                      autoComplete="off"
                      placeholder="Message your party…"
                      disabled={!connected}
                    />
                    <button
                      type="submit"
                      aria-label="Send party message"
                      disabled={!connected || pending || !draft.trim()}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                  <small className="chat-limit">
                    {draft.length}/300 · Don’t share passwords or personal
                    information.
                  </small>
                </div>
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
                    onChange={(e) => onNameChange(e.target.value)}
                    disabled={signedIn}
                    placeholder="Your name"
                  />
                </label>
                <button
                  className="primary full"
                  disabled={pending || !connected}
                  onClick={() => action({ action: "create", name })}
                >
                  <Plus size={18} />
                  {pending ? "Please wait…" : "Create Party"}
                  <ArrowUpRight size={17} />
                </button>
                <div className="divider">
                  <span>or join your friends</span>
                </div>
                <form
                  className="join-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action({
                      action: "join",
                      name,
                      code: code.trim().toUpperCase(),
                    });
                  }}
                >
                  <label className="sr-only" htmlFor="party-code-input">
                    Party code
                  </label>
                  <input
                    id="party-code-input"
                    maxLength={6}
                    placeholder="Enter party code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                  <button
                    disabled={pending || !connected || code.trim().length !== 6}
                  >
                    Join Party <ArrowRight size={16} />
                  </button>
                </form>
              </>
            )}
          </>
        )}
        {lobby.error && (
          <p className="error" role="alert">
            {lobby.error}
          </p>
        )}
        {lobby.notice && (
          <p className="party-notice" role="status">
            {lobby.notice}
          </p>
        )}
      </div>
    </section>
  );
}
