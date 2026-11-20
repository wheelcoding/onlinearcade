import { test } from "node:test";
import assert from "node:assert/strict";
import { EntryGesture, TouchEntryGesture } from "./entry-gesture";
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

test("three quick touch taps unlock without selection or compatibility clicks", () => {
  const g = new TouchEntryGesture();
  for (let i = 0; i < 3; i++) {
    g.start(7, 10, 20, i * 200);
    assert.equal(g.end(7, i * 200 + 60), i === 2);
    assert.equal(g.end(7, i * 200 + 70), false);
  }
});

test("touch drags, holds, cancellation, slow taps and multiple fingers do not unlock", () => {
  const g = new TouchEntryGesture();
  const tap = (time: number) => { g.start(1, 10, 20, time); return g.end(1, time + 50); };
  assert.equal(tap(0), false);
  g.start(1, 10, 20, 100);
  g.move(1, 30, 20);
  assert.equal(g.end(1, 150), false);
  assert.equal(tap(200), false);
  g.start(1, 10, 20, 300);
  assert.equal(g.end(1, 800), false);
  assert.equal(tap(900), false);
  assert.equal(tap(1700), false);
  g.clear();
  assert.equal(tap(1800), false);
  g.start(1, 10, 20, 1900);
  g.start(2, 10, 20, 1901);
  assert.equal(g.end(1, 1950), false);
  assert.equal(g.end(2, 1951), false);
  assert.equal(tap(2000), false);
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
