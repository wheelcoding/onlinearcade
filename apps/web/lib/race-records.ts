import {
  parseRaceRecords,
  saveRaceResult,
  type RaceRecords,
  type RaceResult,
} from "@onlinearcade/core";
export class BrowserRaceRepository {
  constructor(private storage: Storage) {}
  load(): RaceRecords {
    try {
      return parseRaceRecords(
        JSON.parse(this.storage.getItem("oa-racing-v2") || "null"),
      );
    } catch {
      return {};
    }
  }
  save(records: RaceRecords, result: RaceResult) {
    const next = saveRaceResult(records, result);
    this.storage.setItem("oa-racing-v2", JSON.stringify(next));
    return next;
  }
}
export function formatRaceTime(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const centiseconds = Math.round(ms / 10);
  return `${Math.floor(centiseconds / 6000)}:${((centiseconds % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}
