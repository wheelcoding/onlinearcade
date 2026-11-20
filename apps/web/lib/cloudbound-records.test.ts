import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCloudResult, cloudRecordKey } from "./cloudbound-records";
test("Cloudbound browser records validate bounds and remain isolated from other accounts and cloud score contracts", () => {
  const good = {
    version: 1,
    elapsedMs: 52000,
    falls: 0,
    crystals: 31,
    medal: 3,
  };
  assert.deepEqual(parseCloudResult(good), good);
  for (const p of [
    null,
    {},
    { ...good, version: 2 },
    { ...good, elapsedMs: NaN },
    { ...good, crystals: 32 },
    { ...good, falls: -1 },
    { ...good, medal: 4 },
  ])
    assert.equal(parseCloudResult(p), null);
  assert.notEqual(cloudRecordKey(), cloudRecordKey("account-a"));
  assert.notEqual(cloudRecordKey("account-a"), cloudRecordKey("account-b"));
});
