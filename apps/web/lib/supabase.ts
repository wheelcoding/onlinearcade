import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
  return client;
}
export function signInRedirect() {
  return new URL(
    `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`,
    window.location.origin,
  ).href;
}
export function cloudError(error: unknown): string {
  const code = (error as { code?: string })?.code,
    message = (error as { message?: string })?.message || "";
  if (code === "PGRST202" || code === "42P01" || code === "PGRST205")
    return "Cloud records are being set up. You can still play locally.";
  if (code === "42501" || /JWT|expired|sign in required/i.test(message))
    return "Please sign in again to save your records.";
  if (/rate|too many|security purposes/i.test(message))
    return "Too many requests. Please wait a minute and try again.";
  if (/fetch|network|offline/i.test(message) || error instanceof TypeError)
    return "Connection unavailable. Your pending runs will retry when you reconnect.";
  return "Cloud request failed. Please try again.";
}
export async function cloudRpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  accessToken?: string,
): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Cloud not configured");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw value || new Error("Cloud request failed");
    return value as T;
  } finally {
    clearTimeout(timer);
  }
}

export function authMessage(error: { code?: string; message?: string }) {
  if (error.code === "invalid_credentials")
    return "Email or password is incorrect.";
  if (error.code === "email_not_confirmed")
    return "Confirm your email using the link in your inbox, then sign in.";
  if (error.code === "weak_password")
    return "Choose a stronger password with at least 8 characters.";
  if (error.code === "same_password")
    return "Choose a password different from your current password.";
  return cloudError(error);
}
