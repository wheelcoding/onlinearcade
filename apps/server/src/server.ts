import { OnlineRace } from "./online-race.js";
import { TRACK_IDS } from "@onlinearcade/core";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { PartyState, PartyPlayer, PartyReply } from "./protocol.js";

type Member = PartyPlayer & {
  socketId: string | null;
  token: string;
  expiry?: ReturnType<typeof setTimeout>;
};
type Room = Omit<PartyState, "players"> & {
  players: Member[];
  lastStart: number;
  race?: OnlineRace;
};
type Options = {
  reconnectGraceMs?: number;
  trustProxy?: boolean;
  maxConnectionsPerIp?: number;
};
const CODE = /^[A-F0-9]{6}$/;
export function createArcadeServer(
  origin = "http://localhost:3000",
  options: Options = {},
) {
  const origins = origin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rooms = new Map<string, Room>(),
    credentials = new Map<string, { code: string; id: string }>(),
    ips = new Map<string, number>();
  const http = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "onlinearcade-multiplayer",
          version: 2,
          features: ["shared-kart-racing"],
        }),
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const io = new Server(http, {
    cors: { origin: origins, methods: ["GET", "POST"] },
    allowRequest: (req, done) =>
      done(null, !req.headers.origin || origins.includes(req.headers.origin)),
    maxHttpBufferSize: 4096,
    pingTimeout: 20000,
  });
  const grace = options.reconnectGraceMs ?? 45000;
  const snapshot = (room: Room): PartyState => ({
    code: room.code,
    host: room.host,
    players: room.players.map(({ id, name, ready, connected }) => ({
      id,
      name,
      ready,
      connected,
    })),
    session: room.session,
    messages: room.messages,
  });
  const update = (room: Room) => io.to(room.code).emit("party", snapshot(room));
  const presence = () =>
    io.emit("presence", { online: io.sockets.sockets.size });
  function remove(room: Room, member: Member) {
    room.race?.exit(member.id);
    clearTimeout(member.expiry);
    credentials.delete(member.token);
    room.players = room.players.filter((p) => p.id !== member.id);
    if (!room.players.length) {
      rooms.delete(room.code);
      return;
    }
    if (room.host === member.id)
      room.host = (room.players.find((p) => p.connected) || room.players[0]).id;
    update(room);
  }
  io.use((socket, next) => {
    const forwarded = options.trustProxy
      ? socket.handshake.headers["x-forwarded-for"]
      : null;
    const ip =
      (typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : socket.handshake.address) || "unknown";
    if (
      io.engine.clientsCount > 1000 ||
      (ips.get(ip) || 0) >= (options.maxConnectionsPerIp ?? 30)
    )
      return next(new Error("Server is busy. Please try again later."));
    ips.set(ip, (ips.get(ip) || 0) + 1);
    socket.data.ip = ip;
    next();
  });
  io.on("connection", (socket) => {
    let roomCode: string | undefined,
      memberId: string | undefined,
      tokens = 15,
      chatTokens = 5,
      last = Date.now(),
      chatLast = Date.now();
    const current = () => {
      const room = roomCode ? rooms.get(roomCode) : undefined;
      const member = room?.players.find(
        (p) => p.id === memberId && p.socketId === socket.id,
      );
      return { room, member };
    };
    const leave = () => {
      if (!roomCode) return;
      const { room, member } = current();
      if (room && member) {
        socket.leave(room.code);
        remove(room, member);
      }
      roomCode = undefined;
      memberId = undefined;
      socket.emit("party", null);
    };
    socket.on("party:resume", (raw, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const now = Date.now();
      tokens = Math.min(15, tokens + (now - last) / 1000);
      last = now;
      if (tokens < 1)
        return reply({ error: "Too many requests. Try again shortly." });
      tokens--;
      const token = raw?.token;
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return reply({ error: "Party session expired." });
      const found = credentials.get(token),
        room = found && rooms.get(found.code),
        member = room && room.players.find((p) => p.id === found!.id);
      if (!room || !member)
        return reply({
          error: "Party session expired. Create or join a party again.",
        });
      if (member.connected && member.socketId !== socket.id)
        return reply({
          error: "This party session is already connected in another tab.",
        });
      if (roomCode && memberId !== member.id) leave();
      clearTimeout(member.expiry);
      member.connected = true;
      member.socketId = socket.id;
      roomCode = room.code;
      memberId = member.id;
      socket.join(room.code);
      reply({ ok: true, memberId: member.id, resumeToken: member.token });
      update(room);
      if (
        room.session &&
        (room.session.startsAt > Date.now() ||
          (room.race && !room.race.complete))
      )
        socket.emit("session", room.session);
    });
    socket.on("party:action", (raw, ack) => {
      const reply: (value: PartyReply) => void =
        typeof ack === "function" ? ack : () => {};
      const now = Date.now();
      tokens = Math.min(15, tokens + (now - last) / 1000);
      last = now;
      if (tokens < 1)
        return reply({ error: "Too many requests. Try again shortly." });
      tokens--;
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return reply({ error: "Invalid request." });
      const { action } = raw;
      if (action === "leave") {
        leave();
        return reply({ ok: true });
      }
      if (action === "create" || action === "join") {
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!/^[\p{L}\p{N} _-]{1,20}$/u.test(name))
          return reply({
            error: "Use a name of 1–20 letters, numbers, spaces, _ or -.",
          });
        let room: Room;
        if (action === "join") {
          if (typeof raw.code !== "string" || !CODE.test(raw.code))
            return reply({ error: "Enter a six-character party code." });
          const found = rooms.get(raw.code);
          if (!found)
            return reply({
              error: "Party not found. Check the code with your friend.",
            });
          if (found.code === roomCode) {
            const { member } = current();
            return reply({
              ok: true,
              memberId: member?.id,
              resumeToken: member?.token,
            });
          }
          if (found.players.length >= 8)
            return reply({ error: "This party is full." });
          room = found;
        } else {
          if (rooms.size >= 1000)
            return reply({ error: "Server is at capacity." });
          let key: string;
          do {
            key = randomBytes(3).toString("hex").toUpperCase();
          } while (rooms.has(key));
          room = {
            code: key,
            host: "",
            players: [],
            messages: [],
            session: null,
            lastStart: 0,
          };
          rooms.set(key, room);
        }
        leave();
        const member: Member = {
          id: randomUUID(),
          name,
          ready: false,
          connected: true,
          socketId: socket.id,
          token: randomBytes(32).toString("hex"),
        };
        room.players.push(member);
        if (!room.host) room.host = member.id;
        roomCode = room.code;
        memberId = member.id;
        credentials.set(member.token, { code: room.code, id: member.id });
        socket.join(room.code);
        reply({ ok: true, memberId: member.id, resumeToken: member.token });
        update(room);
        return;
      }
      const { room, member } = current();
      if (!room || !member) return reply({ error: "Join a party first." });
      if (action === "ready") {
        if (typeof raw.ready !== "boolean")
          return reply({ error: "Invalid ready state." });
        member.ready = raw.ready;
        update(room);
        return reply({ ok: true });
      }
      if (action === "chat") {
        chatTokens = Math.min(5, chatTokens + (now - chatLast) / 1500);
        chatLast = now;
        if (chatTokens < 1)
          return reply({ error: "Chat is moving too fast. Wait a moment." });
        chatTokens--;
        const text = typeof raw.text === "string" ? raw.text.trim() : "";
        if (
          !text ||
          text.length > 300 ||
          /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(
            text,
          )
        )
          return reply({
            error: "Send 1–300 characters without control characters.",
          });
        const message = {
          id: randomUUID(),
          playerId: member.id,
          name: member.name,
          text,
          sentAt: now,
        };
        room.messages.push(message);
        room.messages = room.messages.slice(-50);
        io.to(room.code).emit("chat", message);
        return reply({ ok: true });
      }
      if (action === "kick") {
        if (room.host !== member.id)
          return reply({ error: "Only the party host can remove players." });
        const target = room.players.find(
          (p) => p.id === raw.playerId && p.id !== member.id,
        );
        if (!target) return reply({ error: "Player not found." });
        if (target.socketId) {
          const peer = io.sockets.sockets.get(target.socketId);
          peer?.leave(room.code);
          peer?.emit("party:removed");
          peer?.emit("party", null);
        }
        remove(room, target);
        return reply({ ok: true });
      }
      if (action === "start") {
        if (room.host !== member.id)
          return reply({ error: "Only the party host can start." });
        if (room.players.length < 2)
          return reply({
            error: "Invite at least one friend before starting a party run.",
          });
        if (room.players.some((p) => !p.connected || !p.ready))
          return reply({ error: "Every player must be connected and ready." });
        if (now - room.lastStart < 10000)
          return reply({
            error: "A run has just started. Wait before starting another.",
          });
        if (room.race && !room.race.complete)
          return reply({
            error: "A race is already running. Finish or leave the race first.",
          });
        if (
          raw.game !== undefined &&
          !["neon-dash", "kart-circuit"].includes(raw.game)
        )
          return reply({ error: "Unknown party game." });
        if (raw.game === "kart-circuit" && !TRACK_IDS.includes(raw.track))
          return reply({ error: "Choose a valid racing track." });
        if (
          raw.game === "kart-circuit" &&
          [...rooms.values()].filter((r) => r.race && !r.race.complete)
            .length >= 12
        )
          return reply({
            error: "Racing servers are busy. Try again shortly.",
          });
        room.lastStart = now;
        room.session = {
          id: randomUUID(),
          game: raw.game === "kart-circuit" ? "kart-circuit" : "neon-dash",
          ...(raw.game === "kart-circuit"
            ? {
                track: raw.track,
                racers: room.players.map((p, i) => ({
                  memberId: p.id,
                  name: p.name,
                  color: [
                    "#f4a05f",
                    "#91cdbb",
                    "#bc9ce1",
                    "#f0ce80",
                    "#88b3d8",
                    "#ef91b6",
                    "#d0e89a",
                    "#a0b6fa",
                  ][i],
                })),
              }
            : {}),
          startsAt: now + 3000,
        };
        room.race =
          room.session.game === "kart-circuit"
            ? new OnlineRace(
                room.session.id,
                room.session.track!,
                room.session.racers!,
                now,
              )
            : undefined;
        room.players.forEach((p) => (p.ready = false));
        update(room);
        io.to(room.code).emit("session", room.session);
        return reply({ ok: true });
      }
      reply({ error: "Unknown action." });
    });
    let inputTokens = 45,
      inputAt = Date.now();
    socket.on("race:input", (raw) => {
      const now = Date.now();
      inputTokens = Math.min(45, inputTokens + (now - inputAt) * 0.035);
      inputAt = now;
      if (inputTokens < 1) return;
      inputTokens--;
      const { room, member } = current();
      if (room?.race && member) room.race.command(member.id, raw, now);
    });
    socket.on("race:sync", (id) => {
      const { room, member } = current();
      // Share the action budget so snapshot requests cannot flood large replies.
      if (tokens < 1) return;
      tokens--;
      if (member && room?.race && room.race.id === id)
        socket.emit("race:state", room.race.packet());
    });
    socket.on("race:exit", (id) => {
      const { room, member } = current();
      if (member && room?.race && room.race.id === id)
        room.race.exit(member.id);
    });
    presence();
    socket.on("disconnect", () => {
      ips.set(socket.data.ip, Math.max(0, (ips.get(socket.data.ip) || 1) - 1));
      if (!ips.get(socket.data.ip)) ips.delete(socket.data.ip);
      const { room, member } = current();
      if (room && member) {
        member.connected = false;
        member.ready = false;
        member.socketId = null;
        if (room.host === member.id) {
          const next = room.players.find((p) => p.connected);
          if (next) room.host = next.id;
        }
        member.expiry = setTimeout(() => {
          if (!member.connected && rooms.has(room.code)) remove(room, member);
        }, grace);
        member.expiry.unref();
        update(room);
      }
      presence();
    });
  });
  let lastTick = Date.now(),
    broadcasts = 0;
  const raceTimer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min((now - lastTick) / 1000, 0.25);
    lastTick = now;
    broadcasts++;
    for (const room of rooms.values())
      if (room.race && !room.race.complete) {
        room.race.advance(
          dt,
          new Set(room.players.filter((p) => p.connected).map((p) => p.id)),
          now,
        );
        if (broadcasts % 4 === 0 || room.race.complete)
          io.to(room.code).emit("race:state", room.race.packet());
      }
  }, 1000 / 60);
  raceTimer.unref();
  http.once("close", () => {
    clearInterval(raceTimer);
    for (const room of rooms.values())
      for (const member of room.players) clearTimeout(member.expiry);
    rooms.clear();
    credentials.clear();
  });
  return { http, io };
}
