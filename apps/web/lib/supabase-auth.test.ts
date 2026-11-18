import { test } from "node:test";
import assert from "node:assert/strict";
import { authMessage, cloudError } from "./supabase";
test("auth feedback distinguishes wrong credentials, email confirmation, and weak passwords without echoing inputs", () => {
  assert.match(
    authMessage({ code: "invalid_credentials", message: "private input" }),
    /Email or password/,
  );
  assert.match(
    authMessage({ code: "email_not_confirmed" }),
    /Confirm your email/,
  );
  assert.match(authMessage({ code: "weak_password" }), /stronger password/);
  assert.equal(
    authMessage({ message: "secret detail" }).includes("secret"),
    false,
  );
});
test("missing schema and network failures give actionable cloud status", () => {
  assert.match(cloudError({ code: "PGRST202" }), /being set up/);
  assert.match(cloudError(new TypeError("Failed to fetch")), /reconnect/);
  assert.match(
    cloudError({ message: "Too many results. Try again in a minute." }),
    /wait a minute/,
  );
});
