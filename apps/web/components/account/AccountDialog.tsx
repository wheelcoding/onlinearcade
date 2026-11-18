"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
export default function AccountDialog({
  guestName,
  onGuestSave,
  onClose,
}: {
  guestName: string;
  onGuestSave: (name: string) => void;
  onClose: () => void;
}) {
  const cloud = useAccount(),
    [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(cloud.account?.displayName || guestName),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (cloud.account) setName(cloud.account.displayName);
  }, [cloud.account?.displayName]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setPassword("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
  }
  const passwords = (
    <>
      <label className="field-label">
        {cloud.recovering ? "New password" : "Password"}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "signup" || cloud.recovering ? 8 : undefined}
          maxLength={128}
          autoComplete={
            mode === "signup" || cloud.recovering
              ? "new-password"
              : "current-password"
          }
        />
      </label>
      {(mode === "signup" || cloud.recovering) && (
        <label className="field-label">
          Confirm password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
          />
        </label>
      )}
    </>
  );
  return (
    <div className="modal account-modal">
      <div
        className="profile-dialog account-dialog"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Arcade account"
      >
        <button className="close" onClick={onClose} aria-label="Close account">
          ✕
        </button>
        <span className="eyebrow">YOUR CORNER OF THE ARCADE</span>
        <h2>
          {cloud.recovering
            ? "Choose a new password."
            : cloud.user
              ? "Your player profile."
              : "Play here. Pick up anywhere."}
        </h2>
        {cloud.loading ? (
          <p role="status">Loading your account…</p>
        ) : cloud.recovering ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                if (password !== confirm)
                  throw new Error("Passwords do not match.");
                await cloud.updatePassword(password);
                setMessage("Password updated. You are signed in.");
              });
            }}
          >
            <p>Set a new password for your account.</p>
            {passwords}
            <button className="primary full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : cloud.user ? (
          <>
            <p className="account-email">Signed in as {cloud.user.email}</p>
            <label className="field-label">
              Public display name
              <input
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <small>
              Your display name appears on community leaderboards. Your email
              stays private.
            </small>
            <button
              className="primary full"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await cloud.saveName(name);
                  setMessage("Profile saved across your devices.");
                })
              }
            >
              {busy ? "Please wait…" : "Save profile"}
            </button>
            <div className="account-sync-box">
              <b>
                {cloud.error
                  ? "Cloud records unavailable"
                  : cloud.syncing
                    ? "Saving your results…"
                    : cloud.pending
                      ? `${cloud.pending} run${cloud.pending === 1 ? "" : "s"} waiting to sync`
                      : "Cloud records connected"}
              </b>
              <p>
                New runs sync while signed in. Guest history stays on this
                browser. Community results are not replay-verified.
              </p>
              <button onClick={cloud.retry} disabled={cloud.syncing}>
                Refresh cloud records
              </button>
            </div>
            <button
              className="secondary full"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await cloud.signOut();
                  setMessage("Signed out on this device.");
                })
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            {cloud.configured ? (
              <>
                <div className="auth-tabs">
                  <button
                    aria-pressed={mode === "signin"}
                    onClick={() => changeMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    aria-pressed={mode === "signup"}
                    onClick={() => changeMode("signup")}
                  >
                    Create account
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      if (mode === "reset") {
                        await cloud.requestReset(email);
                        setMessage(
                          "If an account exists for that email, you will receive a password-reset link.",
                        );
                        return;
                      }
                      if (mode === "signup") {
                        if (password !== confirm)
                          throw new Error("Passwords do not match.");
                        const signedIn = await cloud.signUp(email, password);
                        setMessage(
                          signedIn
                            ? "Account created. You are signed in."
                            : "Check your inbox to confirm your email, then sign in here.",
                        );
                      } else {
                        await cloud.signIn(email, password);
                        setMessage(
                          "Signed in. Your cloud records are loading.",
                        );
                      }
                    });
                  }}
                >
                  <p>
                    {mode === "reset"
                      ? "Enter your email to request a password-reset link."
                      : mode === "signup"
                        ? "Create your player account to save new runs across devices."
                        : "Sign in to continue your records on any device."}
                  </p>
                  <label className="field-label">
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      maxLength={254}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  {mode !== "reset" && passwords}
                  <button className="primary full" disabled={busy}>
                    {busy
                      ? "Please wait…"
                      : mode === "reset"
                        ? "Send reset link"
                        : mode === "signup"
                          ? "Create account"
                          : "Sign in →"}
                  </button>
                </form>
                <button
                  className="auth-reset"
                  onClick={() =>
                    changeMode(mode === "reset" ? "signin" : "reset")
                  }
                >
                  {mode === "reset" ? "← Back to sign in" : "Forgot password?"}
                </button>
                {mode === "signup" && (
                  <small>
                    Use at least 8 characters. Confirm your email before signing
                    in.
                  </small>
                )}
              </>
            ) : (
              <p>
                Account sign-in is being configured. You can keep playing as a
                guest.
              </p>
            )}
            <div className="divider">
              <span>or keep it local</span>
            </div>
            <label className="field-label">
              Guest nickname
              <input
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <button
              className="secondary full"
              disabled={busy}
              onClick={() => {
                if (!/^[\p{L}\p{N} _-]{1,20}$/u.test(name.trim())) {
                  setError("Use 1–20 letters, numbers, spaces, _ or -.");
                  return;
                }
                onGuestSave(name.trim());
                onClose();
              }}
            >
              Save guest nickname
            </button>
          </>
        )}
        {message && (
          <p className="account-success" role="status">
            {message}
          </p>
        )}
        {(error || cloud.error) && (
          <p className="error" role="alert">
            {error || cloud.error}
          </p>
        )}
      </div>
    </div>
  );
}
