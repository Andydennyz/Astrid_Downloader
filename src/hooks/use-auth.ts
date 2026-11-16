import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { clearSupabaseSessionToken, hasSupabaseConfig, setSupabaseSessionToken, supabase } from "@/lib/supabase.ts";

export type AuthState = {
  user: User | null;
  session: Session | null;
  error: string | null;
  loading: boolean;
  ready: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function syncSessionToken(nextSession: Session | null) {
  setSupabaseSessionToken(nextSession?.access_token ?? null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(() => !hasSupabaseConfig || !supabase);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      return undefined;
    }

    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) throw sessionError;
        const nextSession = data.session ?? null;
        setSession(nextSession);
        syncSessionToken(nextSession);
        setReady(true);
      })
      .catch((sessionError: unknown) => {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : "Could not check your sign-in session.");
        setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      const normalizedSession = nextSession ?? null;
      setSession(normalizedSession);
      syncSessionToken(normalizedSession);
      setError(null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    error,
    loading: !ready,
    ready,
    signInWithGoogle: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    },
    signInWithGitHub: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    },
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      clearSupabaseSessionToken();
    },
  }), [error, ready, session]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (value) return value;

  return {
    user: null,
    session: null,
    error: null,
    loading: false,
    ready: true,
    signInWithGoogle: async () => undefined,
    signInWithGitHub: async () => undefined,
    signOut: async () => undefined,
  };
}

export function useUser() {
  return useAuth().user;
}
