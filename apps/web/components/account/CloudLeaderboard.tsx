"use client";
import { useEffect, useState } from "react";
import { TRACKS, type GameId, type TrackId } from "@onlinearcade/core";
import { useAccount } from "./AccountProvider";
import { getSupabase, cloudRpc, cloudError } from "../../lib/supabase";
import { parseBoard, type BoardRow } from "../../lib/cloud-records";
import { formatRaceTime } from "../../lib/race-records";
export default function CloudLeaderboard({
  gameId,
  onSignIn,
}: {
  gameId: GameId;
  onSignIn: () => void;
}) {
  const cloud = useAccount(),
    [track, setTrack] = useState<TrackId>("sunset-bay"),
    [rows, setRows] = useState<BoardRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRows([]);
    void (async () => {
      try {
        const session = await getSupabase()?.auth.getSession();
        const token =
          session?.data.session?.user.id === cloud.user?.id
            ? session?.data.session?.access_token
            : undefined;
        const data = await cloudRpc(
          "oa_leaderboard",
          {
            p_game_id: gameId,
            p_variant_id: gameId === "sunset-circuit" ? track : "default",
            p_limit: 25,
          },
          token,
        );
        if (active) setRows(parseBoard(data));
      } catch (e) {
        if (active) setError(cloudError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [gameId, track, cloud.user?.id, cloud.revision, attempt]);
  return (
    <div className="cloud-board">
      <div className="cloud-board-tools">
        {gameId === "sunset-circuit" ? (
          <label>
            Racing track
            <select
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
        ) : (
          <span>Top 25 players · best completed run</span>
        )}
        <button disabled={loading} onClick={() => setAttempt((a) => a + 1)}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>
      <div className="ranking">
        <div className="ranking-head">
          <span>PLAYER</span>
          <span>RUNS</span>
          <span>
            {gameId === "sunset-circuit" ? "RACE TIME" : "HIGH SCORE"}
          </span>
        </div>
        {loading ? (
          <div className="cloud-empty" role="status">
            Loading community records…
          </div>
        ) : error ? (
          <div className="cloud-empty" role="alert">
            {error}
            <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </div>
        ) : rows.length ? (
          rows.map((row) => (
            <div
              className={`ranking-row ${row.is_self ? "your-row" : ""}`}
              key={row.position}
            >
              <span>
                <b>{String(row.position).padStart(2, "0")}</b>
                <span className="avatar">
                  {row.display_name[0]?.toUpperCase()}
                </span>
                {row.display_name}
                {row.is_self && <small>YOU</small>}
              </span>
              <span>{row.runs}</span>
              <strong>
                {gameId === "sunset-circuit"
                  ? formatRaceTime(row.duration_ms || 0)
                  : row.score.toLocaleString()}
              </strong>
            </div>
          ))
        ) : (
          <div className="cloud-empty">
            No community records yet. Finish a run while signed in to get on the
            board.
            {!cloud.user && (
              <button onClick={onSignIn}>Sign in to play →</button>
            )}
          </div>
        )}
        <p>
          Community results · unverified. Only completed runs saved while signed
          in appear here.
        </p>
      </div>
    </div>
  );
}
