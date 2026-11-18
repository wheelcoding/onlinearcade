"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  emptyProgress,
  type Account,
  type GameId,
  type LocalProgress,
  type RaceRecords,
  type RaceResult,
} from "@onlinearcade/core";
import {
  getSupabase,
  cloudRpc,
  cloudError,
  authMessage,
  signInRedirect,
} from "../../lib/supabase";
import {
  AccountOutbox,
  makeGameRun,
  makeRaceRun,
  parseCloudProgress,
  type PendingRun,
} from "../../lib/cloud-records";
type AccountState = {
  configured: boolean;
  loading: boolean;
  user: Session["user"] | null;
  account: Account | null;
  progress: LocalProgress;
  raceRecords: RaceRecords;
  pending: number;
  syncing: boolean;
  error: string;
  revision: number;
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  requestReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveName: (name: string) => Promise<void>;
  submitGame: (game: GameId, score: number) => void;
  submitRace: (result: RaceResult) => void;
  retry: () => void;
};
const Context = createContext<AccountState | null>(null);
export const useAccount = () => {
  const state = useContext(Context);
  if (!state) throw new Error("AccountProvider is required");
  return state;
};
export default function AccountProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<Account | null>(null),
    [progress, setProgress] = useState<LocalProgress>(emptyProgress),
    [raceRecords, setRaceRecords] = useState<RaceRecords>({}),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(0),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [recovering, setRecovering] = useState(false);
  const current = useRef<Session | null>(null),
    refreshSequence = useRef(0),
    queues = useRef(new Map<string, PendingRun[]>()),
    flushing = useRef(false),
    flushRef = useRef<() => Promise<void>>(async () => {}),
    alive = useRef(true);
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const queueFor = (id: string) => {
    if (!queues.current.has(id)) {
      try {
        queues.current.set(id, new AccountOutbox(localStorage, id).load());
      } catch {
        queues.current.set(id, []);
      }
    }
    return queues.current.get(id)!;
  };
  const writeQueue = (id: string, queue: PendingRun[]) => {
    queues.current.set(id, queue);
    try {
      new AccountOutbox(localStorage, id).replace(queue);
    } catch {
      if (current.current?.user.id === id)
        setError(
          "Browser storage is blocked. Pending runs are kept for this visit only.",
        );
    }
    if (current.current?.user.id === id) setPending(queue.length);
  };
  const refresh = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot) return;
    const request = ++refreshSequence.current;
    try {
      const [profile, data] = await Promise.all([
        cloudRpc<Account>("oa_profile", {}, snapshot.access_token),
        cloudRpc("oa_get_progress", {}, snapshot.access_token),
      ]);
      if (
        !alive.current ||
        current.current?.user.id !== snapshot.user.id ||
        request !== refreshSequence.current
      )
        return;
      if (
        profile.id !== snapshot.user.id ||
        typeof profile.displayName !== "string"
      )
        throw new Error("Invalid profile");
      const parsed = parseCloudProgress(data);
      setAccount(profile);
      setProgress(parsed.progress);
      setRaceRecords(parsed.races);
      setError("");
      setRevision((r) => r + 1);
    } catch (e) {
      if (
        alive.current &&
        current.current?.user.id === snapshot.user.id &&
        request === refreshSequence.current
      )
        setError(cloudError(e));
    } finally {
      if (alive.current && current.current?.user.id === snapshot.user.id)
        setLoading(false);
    }
  }, []);
  const flush = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot || flushing.current) return;
    const id = snapshot.user.id;
    flushing.current = true;
    setSyncing(true);
    try {
      while (current.current?.user.id === id) {
        const run = queueFor(id)[0];
        if (!run) break;
        try {
          await cloudRpc(
            "oa_submit_run",
            {
              p_event_id: run.eventId,
              p_game_id: run.gameId,
              p_variant_id: run.variantId,
              p_score: run.score,
              p_duration_ms: run.durationMs,
              p_best_lap_ms: run.bestLapMs,
            },
            snapshot.access_token,
          );
        } catch (e) {
          const code = (e as { code?: string })?.code,
            msg = (e as { message?: string })?.message || "";
          if (code === "P0001" && /Invalid|Unknown|already used/.test(msg)) {
            writeQueue(
              id,
              queueFor(id).filter((r) => r.eventId !== run.eventId),
            );
            if (current.current?.user.id === id)
              setError(
                "A result could not be accepted. Your local gameplay was not affected.",
              );
            continue;
          }
          throw e;
        }
        writeQueue(
          id,
          queueFor(id).filter((r) => r.eventId !== run.eventId),
        );
      }
      if (current.current?.user.id === id) await refresh();
    } catch (e) {
      if (alive.current && current.current?.user.id === id)
        setError(cloudError(e));
    } finally {
      flushing.current = false;
      if (alive.current) {
        setSyncing(false);
        if (current.current && current.current.user.id !== id)
          void flushRef.current();
      }
    }
  }, [refresh]);
  flushRef.current = flush;
  useEffect(() => {
    alive.current = true;
    const supabase = getSupabase();
    setClient(supabase);
    if (!supabase) {
      setLoading(false);
      return () => {
        alive.current = false;
      };
    }
    let active = true,
      received = false;
    const update = (value: Session | null) => {
      if (!active) return;
      received = true;
      const changed = current.current?.user.id !== value?.user.id;
      current.current = value;
      setSession(value);
      if (changed) {
        refreshSequence.current++;
        setAccount(null);
        setProgress(emptyProgress());
        setRaceRecords({});
        setError("");
        setPending(value ? queueFor(value.user.id).length : 0);
        setLoading(!!value);
      } else if (!value) setLoading(false);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, value) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      update(value);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || received) return;
      if (error) {
        setError(cloudError(error));
        setLoading(false);
      } else update(data.session);
    });
    return () => {
      active = false;
      alive.current = false;
      subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    void refresh().then(() => flushRef.current());
    const reconnect = () => {
      void flushRef.current();
    };
    window.addEventListener("online", reconnect);
    const timer = setInterval(() => {
      if (navigator.onLine && queueFor(userId).length) void flushRef.current();
    }, 60000);
    return () => {
      window.removeEventListener("online", reconnect);
      clearInterval(timer);
    };
  }, [userId, refresh]);
  function enqueue(run: PendingRun) {
    const snapshot = current.current;
    if (!snapshot) return;
    const queue = queueFor(snapshot.user.id);
    if (queue.length >= 100) {
      setError("Pending results are full. Reconnect to sync your runs.");
      return;
    }
    writeQueue(snapshot.user.id, [...queue, run]);
    void flushRef.current();
  }
  async function signIn(email: string, password: string) {
    if (!client) throw new Error("Account sign-in is not configured yet.");
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(authMessage(error));
  }
  async function signUp(email: string, password: string) {
    if (!client) throw new Error("Accounts are not configured yet.");
    if (password.length < 8)
      throw new Error("Use at least 8 characters for your password.");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: signInRedirect() },
    });
    if (error) throw new Error(authMessage(error));
    return !!data.session;
  }
  async function requestReset(email: string) {
    if (!client) throw new Error("Accounts are not configured yet.");
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: signInRedirect(),
    });
    if (error) throw new Error(authMessage(error));
  }
  async function updatePassword(password: string) {
    if (!client) throw new Error("Please sign in first.");
    if (password.length < 8)
      throw new Error("Use at least 8 characters for your password.");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(authMessage(error));
    setRecovering(false);
  }
  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error(cloudError(error));
  }
  async function saveName(name: string) {
    const snapshot = current.current;
    if (!snapshot) throw new Error("Please sign in first.");
    if (!/^[\p{L}\p{N} _-]{1,20}$/u.test(name.trim()))
      throw new Error("Use 1–20 letters, numbers, spaces, _ or -.");
    const profile = await cloudRpc<Account>(
      "oa_profile",
      { p_display_name: name.trim() },
      snapshot.access_token,
    );
    if (current.current?.user.id === snapshot.user.id) {
      setAccount(profile);
      setRevision((r) => r + 1);
    }
  }
  return (
    <Context.Provider
      value={{
        configured,
        loading,
        user: session?.user || null,
        account,
        progress,
        raceRecords,
        pending,
        syncing,
        error,
        revision,
        recovering,
        signIn,
        signUp,
        requestReset,
        updatePassword,
        signOut,
        saveName,
        submitGame: (game, score) => {
          try {
            enqueue(makeGameRun(game, score));
          } catch {
            setError("This result could not be saved.");
          }
        },
        submitRace: (result) => {
          try {
            enqueue(makeRaceRun(result));
          } catch {
            setError("This track result could not be saved.");
          }
        },
        retry: () => {
          void refresh().then(() => flushRef.current());
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
