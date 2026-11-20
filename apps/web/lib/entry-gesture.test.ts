import { test } from "node:test";
import assert from "node:assert/strict";
import { EntryGesture } from "./entry-gesture";
test("triple clicking alone cannot unlock; a wheel selection survives browser selection changes during clicks", () => {
  const g = new EntryGesture();
  for (let i = 1; i <= 3; i++) {
    g.press(false);
    assert.equal(g.click(i * 100), false);
  }
  g.press(true);
  assert.equal(g.click(1001), false);
  g.press(false);
  assert.equal(g.click(1101), false);
  g.press(false);
  assert.equal(g.click(1201), true);
});
test("selection is not itself a click; slow clicks, outside reset and fresh loads remain locked", () => {
  const g = new EntryGesture();
  g.arm();
  assert.equal(g.click(101), false);
  g.press(false);
  assert.equal(g.click(200), false);
  g.press(false);
  assert.equal(g.click(1000), false);
  g.press(false);
  assert.equal(g.click(1100), false);
  g.press(false);
  assert.equal(g.click(1200), true);
  g.clear();
  g.press(false);
  assert.equal(g.click(1300), false);
  const fresh = new EntryGesture();
  fresh.press(false);
  assert.equal(fresh.click(1400), false);
});
