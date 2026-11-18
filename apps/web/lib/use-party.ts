"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import deployment from "../config/multiplayer.json";
import type {
  PartyState,
  PartyReply,
  PartyAction,
  ChatMessage,
  PartySession,
} from "../../server/src/protocol";
export type ConnectionState =
  "unconfigured" | "connecting" | "connected" | "reconnecting" | "offline";
export function multiplayerEndpoint(
  config: string | undefined,
  hostname: string,
) {
  if (!config)
    return ["localhost", "127.0.0.1"].includes(hostname)
      ? "http://localhost:3001"
      : null;
  try {
    const url = new URL(config);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !(
        ["localhost", "127.0.0.1"].includes(hostname) &&
        url.protocol === "http:"
      )
    )
      return null;
    if (
      !["localhost", "127.0.0.1"].includes(hostname) &&
      ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function useParty(onStart: () => void) {
  const [status, setStatus] = useState<ConnectionState>("connecting"),
    [online, setOnline] = useState<number | null>(null),
    [party, setParty] = useState<PartyState | null>(null),
    [memberId, setMemberId] = useState<string | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState("");
  const socket = useRef<Socket | null>(null),
    start = useRef(onStart),
    sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    storageKey = useRef(""),
    seenSession = useRef("");
  start.current = onStart;
  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey.current);
    } catch {}
    setMemberId(null);
    setParty(null);
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    setNotice("");
  }, []);
  const remember = useCallback((reply: PartyReply) => {
    if (reply.memberId) setMemberId(reply.memberId);
    if (reply.resumeToken)
      try {
        sessionStorage.setItem(storageKey.current, reply.resumeToken);
      } catch {}
  }, []);
  useEffect(() => {
    const endpoint = multiplayerEndpoint(
      process.env.NEXT_PUBLIC_MULTIPLAYER_URL || deployment.serverUrl,
      location.hostname,
    );
    if (!endpoint) {
      setStatus("unconfigured");
      return;
    }
    storageKey.current = "oa-party-session-v2:" + endpoint;
    const s = io(endpoint, {
      autoConnect: false,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.3,
    });
    socket.current = s;
    s.on("connect", () => {
      setStatus("connected");
      setError("");
      let token: string | null = null;
      try {
        token = sessionStorage.getItem(storageKey.current);
      } catch {}
      if (token)
        s.timeout(8000).emit(
          "party:resume",
          { token },
          (err: Error | null, reply: PartyReply) => {
            if (err) {
              setError("Could not restore your party. Reconnect to try again.");
              return;
            }
            if (reply?.error) {
              clearSession();
              setError(reply.error);
            } else remember(reply);
          },
        );
    });
    s.on("connect_error", () => {
      setStatus(navigator.onLine ? "reconnecting" : "offline");
      setOnline(null);
    });
    s.on("disconnect", () => {
      setStatus("reconnecting");
      setOnline(null);
      setPending(false);
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
      setNotice("Connection interrupted. Reconnecting to your party…");
    });
    s.on("presence", (value) => {
      if (
        Number.isInteger(value?.online) &&
        value.online >= 0 &&
        value.online <= 1000
      )
        setOnline(value.online);
    });
    s.on("party", (value: PartyState | null) => {
      setParty(value);
      if (value) setNotice("");
    });
    s.on("party:removed", () => {
      clearSession();
      setError("The host removed you from the party.");
    });
    s.on("chat", (message: ChatMessage) => {
      setParty((p) =>
        p && !p.messages.some((m) => m.id === message.id)
          ? { ...p, messages: [...p.messages, message].slice(-50) }
          : p,
      );
    });
    s.on("session", (value: PartySession) => {
      if (
        value?.game !== "neon-dash" ||
        typeof value.id !== "string" ||
        !Number.isFinite(value.startsAt) ||
        value.startsAt < Date.now() - 1000 ||
        value.startsAt > Date.now() + 10000 ||
        seenSession.current === value.id
      )
        return;
      seenSession.current = value.id;
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
      setNotice(
        "Starting Neon Dash together in 3 seconds. Runs are independent.",
      );
      sessionTimer.current = setTimeout(
        () => {
          setNotice("");
          start.current();
        },
        Math.max(0, value.startsAt - Date.now()),
      );
    });
    const offline = () => {
        setStatus("offline");
        setOnline(null);
      },
      online = () => {
        setStatus("connecting");
        s.connect();
      };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    s.connect();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
      s.removeAllListeners();
      s.disconnect();
      socket.current = null;
    };
  }, [clearSession, remember]);
  const action = useCallback(
    async (payload: PartyAction) => {
      const s = socket.current;
      if (!s?.connected) {
        setError(
          "The party server is reconnecting. Please wait, then try again.",
        );
        return false;
      }
      setPending(true);
      setError("");
      return new Promise<boolean>((resolve) => {
        s.timeout(8000).emit(
          "party:action",
          payload,
          (err: Error | null, reply: PartyReply) => {
            setPending(false);
            if (err || reply?.error) {
              setError(
                err ? "Request timed out. Please try again." : reply.error!,
              );
              resolve(false);
              return;
            }
            remember(reply || {});
            if (payload.action === "leave") clearSession();
            resolve(true);
          },
        );
      });
    },
    [remember, clearSession],
  );
  const reconnect = () => {
    const s = socket.current;
    if (!s) return;
    s.disconnect();
    setStatus("connecting");
    s.connect();
  };
  return {
    status,
    online,
    party,
    memberId,
    error,
    setError,
    pending,
    notice,
    action,
    reconnect,
  };
}
