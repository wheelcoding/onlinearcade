import { test } from "node:test";
import assert from "node:assert/strict";
import { multiplayerEndpoint } from "./use-party";
test("public multiplayer endpoint must be explicit HTTPS and never falls back to a visitor localhost", () => {
  assert.equal(multiplayerEndpoint(undefined, "wheelcoding.github.io"), null);
  assert.equal(
    multiplayerEndpoint(undefined, "localhost"),
    "http://localhost:3001",
  );
  for (const value of [
    "http://server.example",
    "https://localhost:3001",
    "https://127.0.0.1",
    "https://user:password@server.example",
    "https://server.example/socket.io",
    "https://server.example/?key=secret",
    "not a url",
  ])
    assert.equal(
      multiplayerEndpoint(value, "wheelcoding.github.io"),
      null,
      value,
    );
  assert.equal(
    multiplayerEndpoint("https://arcade.example/", "wheelcoding.github.io"),
    "https://arcade.example",
  );
  assert.equal(
    multiplayerEndpoint("http://localhost:3001", "localhost"),
    "http://localhost:3001",
  );
});
