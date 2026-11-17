import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { Server } from "socket.io";
export function createArcadeServer(origin = "http://localhost:3000") {
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const io = new Server(http, {
    cors: { origin: origin.split(",") },
    maxHttpBufferSize: 4096,
  });
  type Party = {
    code: string;
    host: string;
    players: { id: string; name: string }[];
    session: string | null;
  };
  const parties = new Map<string, Party>();
  const broadcast = () =>
    io.emit("presence", { online: io.engine.clientsCount });
  io.on("connection", (socket) => {
    let code: string | undefined;
    let tokens = 15;
    let last = Date.now();
    const leave = () => {
      if (!code) return;
      const p = parties.get(code);
      socket.leave(code);
      if (p) {
        p.players = p.players.filter((x) => x.id !== socket.id);
        if (!p.players.length) parties.delete(code);
        else {
          if (p.host === socket.id) p.host = p.players[0].id;
          io.to(code).emit("party", p);
        }
      }
      code = undefined;
      socket.emit("party", null);
    };
    socket.on("party:action", (raw, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const now = Date.now();
      tokens = Math.min(15, tokens + (now - last) / 1000);
      last = now;
      if (tokens < 1)
        return reply({ error: "Too many requests. Try again shortly." });
      tokens--;
      if (!raw || typeof raw !== "object")
        return reply({ error: "Invalid request." });
      const { action } = raw;
      if (action === "leave") {
        leave();
        return reply({ ok: true });
      }
      if (action === "start") {
        const p = code && parties.get(code);
        if (!p || p.host !== socket.id)
          return reply({ error: "Only the party host can start." });
        p.session = randomBytes(8).toString("hex");
        io.to(p.code).emit("party", p);
        io.to(p.code).emit("session", {
          id: p.session,
          game: "neon-dash",
          startsAt: Date.now() + 3000,
        });
        return reply({ ok: true });
      }
      if (action !== "create" && action !== "join")
        return reply({ error: "Unknown action." });
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!/^[\p{L}\p{N} _-]{1,20}$/u.test(name))
        return reply({
          error: "Use a name of 1–20 letters, numbers, spaces, _ or -.",
        });
      let p: Party;
      if (action === "join") {
        if (typeof raw.code !== "string" || !/^[A-F0-9]{6}$/.test(raw.code))
          return reply({ error: "Enter a six-character party code." });
        const found = parties.get(raw.code);
        if (!found) return reply({ error: "Party not found." });
        if (found.players.length >= 8)
          return reply({ error: "This party is full." });
        if (code === found.code) return reply({ ok: true });
        p = found;
      } else {
        if (parties.size >= 1000)
          return reply({ error: "Server is at capacity." });
        let key: string;
        do {
          key = randomBytes(3).toString("hex").toUpperCase();
        } while (parties.has(key));
        p = { code: key, host: socket.id, players: [], session: null };
        parties.set(key, p);
      }
      leave();
      code = p.code;
      p.players.push({ id: socket.id, name });
      socket.join(code);
      io.to(code).emit("party", p);
      reply({ ok: true });
    });
    broadcast();
    socket.on("disconnect", () => {
      leave();
      broadcast();
    });
  });
  return { http, io };
}
