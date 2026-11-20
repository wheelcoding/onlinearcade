import type { CloudResult } from "@onlinearcade/core";
export function parseCloudResult(raw: unknown): CloudResult | null {
  const p = raw as CloudResult;
  if (
    !p ||
    p.version !== 1 ||
    !Number.isSafeInteger(p.elapsedMs) ||
    p.elapsedMs <= 0 ||
    p.elapsedMs > 86400000 ||
    !Number.isSafeInteger(p.falls) ||
    p.falls < 0 ||
    !Number.isSafeInteger(p.crystals) ||
    p.crystals < 0 ||
    p.crystals > 31 ||
    ![1, 2, 3].includes(p.medal)
  )
    return null;
  return {
    version: 1,
    elapsedMs: p.elapsedMs,
    falls: p.falls,
    crystals: p.crystals,
    medal: p.medal,
  };
}
export function cloudRecordKey(accountId?: string) {
  return "oa-cloudbound-v1:" + (accountId || "guest");
}
