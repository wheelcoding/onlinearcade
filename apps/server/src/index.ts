import { createArcadeServer } from "./server.js";
const origin = process.env.WEB_ORIGIN || "http://localhost:3000";
if (process.env.NODE_ENV === "production" && origin.includes("localhost"))
  throw new Error("Set WEB_ORIGIN to your public website origin.");
const { http, io } = createArcadeServer(origin, {
  trustProxy: process.env.TRUST_PROXY === "true",
});
http.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("OnlineArcade multiplayer listening"),
);
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
