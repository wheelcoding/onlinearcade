import { test } from "node:test";
import assert from "node:assert/strict";
import { io as connect, type Socket } from "socket.io-client";
import { createArcadeServer } from "./server.js";
import type { PartyState, PartyReply } from "./protocol.js";
const event = <T = any>(
  s: Socket,
  n: string,
  matches: (value: T) => boolean = () => true,
  timeoutMs = 3000,
) =>
  new Promise<T>((resolve, reject) => {
    const receive = (value: T) => {
      if (!matches(value)) return;
      clearTimeout(timer);
      s.off(n, receive);
      resolve(value);
    };
    const timer = setTimeout(() => {
      s.off(n, receive);
      reject(new Error("Timed out waiting for " + n));
    }, timeoutMs);
    s.on(n, receive);
  });
async function fixture(options: Parameters<typeof createArcadeServer>[1] = {}) {
  const { http, io } = createArcadeServer("http://localhost:3000", options);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  const sockets: Socket[] = [];
  const client = async () => {
    const s = connect(url, {
      autoConnect: false,
      reconnection: false,
      extraHeaders: { Origin: "http://localhost:3000" },
    });
    sockets.push(s);
    const connected = event(s, "connect");
    s.connect();
    await connected;
    return s;
  };
  const action = (s: Socket, raw: unknown) =>
    new Promise<PartyReply>((resolve, reject) =>
      s
        .timeout(3000)
        .emit("party:action", raw, (err: Error | null, reply: PartyReply) =>
          err ? reject(err) : resolve(reply),
        ),
    );
  const create = async (s: Socket, name: string) => {
    const state = event<PartyState>(s, "party");
    const credentials = await action(s, { action: "create", name });
    assert.ok(credentials.ok);
    return { state: await state, credentials };
  };
  const close = async () => {
    sockets.forEach((s) => s.disconnect());
    await new Promise<void>((r) => io.close(() => r()));
  };
  return { http, io, url, client, action, create, close, sockets };
}
test("private chat, host permissions and ready checks use real Socket.IO clients", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      b = await f.client(),
      outsider = await f.client();
    assert.match(
      (await f.action(a, { action: "create", name: "<script>" })).error!,
      /name/,
    );
    const { state: room, credentials: owner } = await f.create(a, "Alex");
    await f.create(outsider, "Other");
    assert.match(room.code, /^[A-F0-9]{6}$/);
    assert.equal(JSON.stringify(room).includes(owner.resumeToken!), false);
    const joined = event<PartyState>(b, "party");
    const guest = await f.action(b, {
      action: "join",
      name: "Sam",
      code: room.code,
    });
    assert.equal((await joined).players.length, 2);
    assert.match((await f.action(b, { action: "start" })).error!, /host/);
    assert.match((await f.action(a, { action: "start" })).error!, /ready/);
    let leaked = false;
    outsider.on("chat", () => (leaked = true));
    const message = event(b, "chat");
    await f.action(a, {
      action: "chat",
      text: "Hello <script>alert(1)</script>",
      playerId: "forged",
      name: "Forged",
    });
    const received = await message;
    assert.equal(received.name, "Alex");
    assert.equal(received.playerId, owner.memberId);
    assert.equal(received.text, "Hello <script>alert(1)</script>");
    await f.action(outsider, { action: "ready", ready: true });
    assert.equal(leaked, false);
    assert.match(
      (await f.action(a, { action: "chat", text: " ".repeat(10) })).error!,
      /1–300/,
    );
    assert.match(
      (await f.action(a, { action: "chat", text: "x".repeat(301) })).error!,
      /1–300/,
    );
    assert.match(
      (await f.action(a, { action: "chat", text: "hello\u202eevil" })).error!,
      /control/,
    );
    await f.action(a, { action: "ready", ready: true });
    await f.action(b, { action: "ready", ready: true });
    const start = event(b, "session");
    assert.ok((await f.action(a, { action: "start" })).ok);
    const session = await start;
    assert.equal(session.game, "neon-dash");
    assert.ok(session.startsAt > Date.now() + 2000);
    assert.match(
      (await f.action(b, { action: "kick", playerId: owner.memberId })).error!,
      /host/,
    );
    const removed = event(b, "party:removed");
    assert.ok(
      (await f.action(a, { action: "kick", playerId: guest.memberId })).ok,
    );
    await removed;
    assert.match(
      (await f.action(b, { action: "chat", text: "not a member" })).error!,
      /Join/,
    );
    const resume = await new Promise<PartyReply>((r) =>
      b.emit("party:resume", { token: guest.resumeToken }, r),
    );
    assert.match(resume.error!, /expired/);
  } finally {
    await f.close();
  }
});
test("brief disconnection restores identity/history and transfers the host without leaking credentials", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      b = await f.client();
    const { state: room, credentials: owner } = await f.create(a, "Alex");
    const guest = await f.action(b, {
      action: "join",
      name: "Sam",
      code: room.code,
    });
    await f.action(a, { action: "chat", text: "remember this" });
    const change = event<PartyState>(b, "party");
    a.disconnect();
    const disconnected = await change;
    assert.equal(disconnected.host, guest.memberId);
    assert.equal(
      disconnected.players.find((p) => p.id === owner.memberId)?.connected,
      false,
    );
    const restored = await f.client(),
      state = event<PartyState>(restored, "party");
    const reply = await new Promise<PartyReply>((r) =>
      restored.emit("party:resume", { token: owner.resumeToken }, r),
    );
    assert.ok(reply.ok);
    assert.equal(reply.memberId, owner.memberId);
    const value = await state;
    assert.equal(value.players.length, 2);
    assert.equal(value.messages[0].text, "remember this");
    assert.ok(value.players.every((p) => p.connected));
    assert.equal(value.host, guest.memberId);
    const impersonator = await f.client();
    const duplicate = await new Promise<PartyReply>((r) =>
      impersonator.emit("party:resume", { token: owner.resumeToken }, r),
    );
    assert.match(duplicate.error!, /another tab/);
    await f.action(restored, { action: "leave" });
    const invalid = await new Promise<PartyReply>((r) =>
      restored.emit("party:resume", { token: owner.resumeToken }, r),
    );
    assert.match(invalid.error!, /expired/);
  } finally {
    await f.close();
  }
});
test("server expires disconnected rooms, rejects unknown codes and enforces real connection counts", async () => {
  const f = await fixture({ reconnectGraceMs: 25 });
  try {
    const a = await f.client(),
      { state: room } = await f.create(a, "Alex");
    a.disconnect();
    await new Promise((r) => setTimeout(r, 60));
    const b = await f.client();
    assert.match(
      (await f.action(b, { action: "join", name: "Sam", code: room.code }))
        .error!,
      /not found/,
    );
    assert.match(
      (await f.action(b, { action: "join", name: "Sam", code: "BAD" })).error!,
      /six-character/,
    );
    assert.match((await f.action(b, null)).error!, /Invalid/);
    const nextCount = event<{ online: number }>(b, "presence");
    await f.client();
    assert.equal((await nextCount).online, 2);
  } finally {
    await f.close();
  }
});
test("chat and action throttles reject flooding and a ninth room member is refused", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      { state: room } = await f.create(a, "Alex");
    for (let i = 0; i < 5; i++)
      assert.ok(
        (await f.action(a, { action: "chat", text: "message " + i })).ok,
      );
    assert.match(
      (await f.action(a, { action: "chat", text: "flood" })).error!,
      /too fast/,
    );
    for (let i = 0; i < 7; i++) {
      const b = await f.client();
      assert.ok(
        (
          await f.action(b, {
            action: "join",
            name: "Guest " + i,
            code: room.code,
          })
        ).ok,
      );
    }
    const ninth = await f.client();
    assert.match(
      (
        await f.action(ninth, {
          action: "join",
          name: "Ninth",
          code: room.code,
        })
      ).error!,
      /full/,
    );
    for (let i = 0; i < 20; i++) await f.action(ninth, { action: "unknown" });
    assert.match(
      (await f.action(ninth, { action: "create", name: "Flood" })).error!,
      /Too many/,
    );
  } finally {
    await f.close();
  }
});
test("health is deployable, and unapproved website origins cannot open a socket", async () => {
  const f = await fixture();
  try {
    const health = await fetch(f.url + "/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).version, 2);
    const blocked = connect(f.url, {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
      extraHeaders: { Origin: "https://evil.example" },
    });
    f.sockets.push(blocked);
    const rejection = event(blocked, "connect_error");
    blocked.connect();
    await rejection;
    assert.equal(blocked.connected, false);
  } finally {
    await f.close();
  }
});
test("shared kart races require host/ready checks and isolate snapshots and controls to their room", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      b = await f.client(),
      outsider = await f.client();
    const { state: room, credentials: owner } = await f.create(a, "Alex");
    await f.action(b, { action: "join", name: "Sam", code: room.code });
    await f.action(a, { action: "ready", ready: true });
    await f.action(b, { action: "ready", ready: true });
    assert.match(
      (
        await f.action(b, {
          action: "start",
          game: "kart-circuit",
          track: "sunset-bay",
        })
      ).error!,
      /host/,
    );
    assert.match(
      (
        await f.action(a, {
          action: "start",
          game: "kart-circuit",
          track: "fake-track",
        })
      ).error!,
      /valid/,
    );
    const session = event(a, "session");
    assert.ok(
      (
        await f.action(a, {
          action: "start",
          game: "kart-circuit",
          track: "sunset-bay",
        })
      ).ok,
    );
    const started = await session;
    assert.equal(started.game, "kart-circuit");
    assert.equal(started.racers.length, 2);
    assert.equal(started.racers[0].memberId, owner.memberId);
    let leaked = false;
    outsider.on("race:state", () => {
      leaked = true;
    });
    outsider.emit("race:sync", started.id);
    const first = event(a, "race:state");
    a.emit("race:sync", started.id);
    const initial = await first;
    assert.equal(initial.cars.length, 2);
    const samples: any[] = [];
    b.on("race:state", (p) => samples.push(p));
    const controls = setInterval(
      () =>
        a.emit("race:input", {
          sessionId: started.id,
          seq: Date.now(),
          input: {
            throttle: 1,
            brake: 0,
            steer: 0,
            drift: false,
            boost: false,
          },
          x: 999999,
        }),
      40,
    );
    try {
      await new Promise((r) => setTimeout(r, 3500));
    } finally {
      clearInterval(controls);
    }
    const latest = samples.at(-1);
    assert.ok(latest.time > 0);
    assert.ok(latest.cars[0].speed > 0);
    assert.equal(latest.cars[1].lastInput.throttle, 0);
    assert.notEqual(latest.cars[0].x, 999999);
    assert.equal(leaked, false);
    const withdrawn = event(b, "race:state", (value) =>
      value.withdrawn.includes(0),
    );
    a.emit("race:exit", started.id);
    assert.ok((await withdrawn).withdrawn.includes(0));
    a.emit("race:input", {
      sessionId: started.id,
      seq: Date.now() + 1,
      input: { throttle: 1, brake: 0, steer: 0, drift: false, boost: false },
    });
    assert.ok((await f.action(a, { action: "leave" })).ok);
  } finally {
    await f.close();
  }
});
test("Party Planet launches one shared match, isolates room snapshots and accepts only owned controls", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      b = await f.client(),
      other = await f.client();
    const { state: room } = await f.create(a, "Alex");
    await f.action(b, { action: "join", name: "Sam", code: room.code });
    await f.action(a, { action: "ready", ready: true });
    await f.action(b, { action: "ready", ready: true });
    assert.match(
      (await f.action(b, { action: "start", game: "party-planet" })).error!,
      /host/,
    );
    const session = event(a, "session");
    assert.ok(
      (await f.action(a, { action: "start", game: "party-planet" })).ok,
    );
    const started = await session;
    assert.equal(started.game, "party-planet");
    assert.equal(started.racers.length, 2);
    let leaked = false;
    other.on("planet:state", () => (leaked = true));
    other.emit("planet:sync", started.id);
    const received = event<any>(b, "planet:state");
    b.emit("planet:sync", started.id);
    assert.equal((await received).players.length, 2);
    const packets: any[] = [];
    a.on("planet:state", (p) => packets.push(p));
    const controls = setInterval(
      () =>
        a.emit("planet:input", {
          sessionId: started.id,
          seq: Date.now(),
          input: { x: 1, y: 0 },
          score: 99999,
        }),
      40,
    );
    try {
      await new Promise((r) => setTimeout(r, 3400));
    } finally {
      clearInterval(controls);
    }
    assert.ok(packets.at(-1).players[0].x > 210);
    assert.equal(packets.at(-1).players[1].x, 385);
    assert.equal(leaked, false);
    const left = event<any>(
      a,
      "planet:state",
      (value) => !value.players[1].active,
    );
    b.emit("planet:exit", started.id);
    assert.equal((await left).players[1].active, false);
  } finally {
    await f.close();
  }
});

test("Boostball launches one shared match, isolates room snapshots and accepts only owned controls", async () => {
  const f = await fixture();
  try {
    const a = await f.client(),
      b = await f.client(),
      other = await f.client();
    const { state: room } = await f.create(a, "Alex");
    await f.action(b, { action: "join", name: "Sam", code: room.code });
    await f.action(a, { action: "ready", ready: true });
    await f.action(b, { action: "ready", ready: true });
    assert.match(
      (await f.action(b, { action: "start", game: "boostball" })).error!,
      /host/,
    );
    const session = event(a, "session");
    assert.ok((await f.action(a, { action: "start", game: "boostball" })).ok);
    const started = await session;
    assert.equal(started.game, "boostball");
    assert.equal(started.racers.length, 2);
    let leaked = false;
    other.on("ball:state", () => (leaked = true));
    other.emit("ball:sync", started.id);
    const received = event<any>(b, "ball:state");
    b.emit("ball:sync", started.id);
    assert.equal((await received).cars.length, 2);
    const packets: any[] = [];
    a.on("ball:state", (p) => packets.push(p));
    const controls = setInterval(
      () =>
        a.emit("ball:input", {
          sessionId: started.id,
          seq: Date.now(),
          input: {
            throttle: 1,
            steer: 0,
            boost: true,
            dodge: false,
            jump: true,
          },
          score: 99999,
        }),
      40,
    );
    try {
      await event<any>(a, "ball:state", (p) => p.cars[0].x > 240, 8000);
    } finally {
      clearInterval(controls);
    }
    assert.ok(packets.at(-1).cars[0].x > 240);
    assert.deepEqual(packets.at(-1).score, [0, 0]);
    assert.ok(packets.at(-1).cars[0].height > 0);
    assert.equal(packets.at(-1).cars[1].x, 740);
    assert.equal(leaked, false);
    const left = event<any>(a, "ball:state", (value) => !value.cars[1].active);
    b.emit("ball:exit", started.id);
    assert.equal((await left).cars[1].active, false);
  } finally {
    await f.close();
  }
});
