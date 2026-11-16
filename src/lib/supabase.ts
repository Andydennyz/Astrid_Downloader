import { createClient, type Session, type User } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function setSupabaseSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;

  const keys = ["astrid-auth-token", "supabase_token", "auth_token"];
  for (const key of keys) {
    if (token) {
      window.localStorage.setItem(key, token);
    } else {
      window.localStorage.removeItem(key);
    }
  }
}

export function clearSupabaseSessionToken(): void {
  setSupabaseSessionToken(null);
}

export function getSupabaseSessionToken(): string | null {
  if (typeof window === "undefined" || !hasSupabaseConfig) return null;

  const explicitTokens = [
    window.localStorage.getItem("astrid-auth-token"),
    window.localStorage.getItem("supabase_token"),
    window.localStorage.getItem("auth_token"),
  ];

  for (const value of explicitTokens) {
    if (value) return value;
  }

  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith("sb-") || !key.includes("-auth-token")) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    } catch {
      continue;
    }
  }

  return null;
}

export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getSupabaseUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
