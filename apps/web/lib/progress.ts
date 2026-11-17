import { parseProgress, type LocalProgress } from "@onlinearcade/core";
/** Storage boundary: UI/game engines do not know the persistence implementation. */
export interface ProgressRepository {
  load(): LocalProgress;
  save(progress: LocalProgress): void;
}
export class BrowserProgressRepository implements ProgressRepository {
  constructor(private storage: Storage) {}
  load() {
    const read = (key: string) => {
      try {
        return JSON.parse(this.storage.getItem(key) || "null");
      } catch {
        return null;
      }
    };
    return parseProgress(read("oa-progress-v2"), read("oa-records"));
  }
  save(progress: LocalProgress) {
    this.storage.setItem("oa-progress-v2", JSON.stringify(progress));
  }
}
