import { test } from "node:test";
import assert from "node:assert/strict";
import { io as connect, type Socket } from "socket.io-client";
import { createArcadeServer } from "./server.js";
test("real clients create, join, start, transfer host and validate input", async () => {
  const { http, io } = createArcadeServer();
  await new Promise<void>((r) => http.listen(0, r));
  const port = (http.address() as { port: number }).port;
  const a = connect(`http://localhost:${port}`),
    b = connect(`http://localhost:${port}`);
  const event = (s: Socket, n: string) => new Promise<any>((r) => s.once(n, r));
  const action = (s: Socket, data: object) =>
    new Promise<any>((r) => s.emit("party:action", data, r));
  try {
    await Promise.all([event(a, "connect"), event(b, "connect")]);
    assert.match(
      (await action(a, { action: "create", name: "<script>" })).error,
      /name/,
    );
    let update = event(a, "party");
    await action(a, { action: "create", name: "Alex" });
    const party = await update;
    assert.match(party.code, /^[A-F0-9]{6}$/);
    update = event(b, "party");
    await action(b, { action: "join", name: "Sam", code: party.code });
    assert.equal((await update).players.length, 2);
    assert.match((await action(b, { action: "start" })).error, /host/);
    const session = event(b, "session");
    await action(a, { action: "start" });
    assert.equal((await session).game, "neon-dash");
    update = event(b, "party");
    await action(a, { action: "leave" });
    assert.equal((await update).host, b.id);
    for (let i = 0; i < 20; i++) await action(b, { action: "unknown" });
    assert.match(
      (await action(b, { action: "create", name: "Sam" })).error,
      /Too many/,
    );
  } finally {
    a.disconnect();
    b.disconnect();
    await new Promise<void>((r) => io.close(() => r()));
  }
});
