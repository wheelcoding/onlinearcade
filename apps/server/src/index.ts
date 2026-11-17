import { createArcadeServer } from "./server.js";
const { http } = createArcadeServer(
  process.env.WEB_ORIGIN || "http://localhost:3000",
);
http.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("Arcade server listening"),
);
