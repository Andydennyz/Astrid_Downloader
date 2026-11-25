import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { App } from "@capacitor/app";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import type { Session, User } from "@supabase/supabase-js";
import { clearSupabaseSessionToken, hasSupabaseConfig, setSupabaseSessionToken, supabase } from "@/lib/supabase.ts";
import {
  NATIVE_AUTH_REDIRECT_URL,
  parseNativeAuthCallback,
} from "@/lib/native-auth-callback.ts";

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

async function signInWithOAuth(provider: "google" | "github") {
  if (!supabase) return;
  const isNative = Capacitor.isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: isNative
        ? NATIVE_AUTH_REDIRECT_URL
        : `${window.location.origin}/auth/callback`,
      skipBrowserRedirect: isNative,
    },
  });
  if (error) throw error;

  if (isNative) {
    if (!data.url) {
      throw new Error("Supabase did not return a sign-in URL.");
    }
    await AppLauncher.openUrl({ url: data.url });
  }
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

  useEffect(() => {
    const client = supabase;
    if (!hasSupabaseConfig || !client || !Capacitor.isNativePlatform()) {
      return undefined;
    }

    let active = true;
    const handledCodes = new Set<string>();
    const finishSignIn = async (rawUrl: string) => {
      const callback = parseNativeAuthCallback(rawUrl);
      if (!callback) return;
      if (callback.type === "error") {
        if (active) setError(callback.message);
        return;
      }
      if (callback.type === "missing") {
        if (active) {
          setError(
            "The sign-in provider returned without an authorization code. Check the Supabase redirect URL and try again.",
          );
        }
        return;
      }

      const callbackKey =
        callback.type === "code"
          ? `code:${callback.code}`
          : `token:${callback.accessToken}`;
      if (handledCodes.has(callbackKey)) return;
      handledCodes.add(callbackKey);
      try {
        const { data, error: exchangeError } =
          callback.type === "code"
            ? await client.auth.exchangeCodeForSession(callback.code)
            : await client.auth.setSession({
                access_token: callback.accessToken,
                refresh_token: callback.refreshToken,
              });
        if (exchangeError) throw exchangeError;
        if (!data.session) {
          throw new Error("Supabase did not return a signed-in session.");
        }
        if (active) {
          setSession(data.session);
          syncSessionToken(data.session);
          setError(null);
          window.location.replace("/");
        }
      } catch (callbackExchangeError) {
        handledCodes.delete(callbackKey);
        if (active) {
          setError(
            callbackExchangeError instanceof Error
              ? callbackExchangeError.message
              : "Could not complete sign-in. Please try again.",
          );
        }
      }
    };

    const listener = App.addListener("appUrlOpen", ({ url }) => {
      void finishSignIn(url);
    });
    void listener.catch((listenerError: unknown) => {
      if (active) {
        setError(
          listenerError instanceof Error
            ? listenerError.message
            : "Could not listen for the sign-in callback.",
        );
      }
    });
    void App.getLaunchUrl()
      .then((launch) => {
        if (active && launch?.url) void finishSignIn(launch.url);
      })
      .catch((launchError: unknown) => {
        if (active) {
          setError(
            launchError instanceof Error
              ? launchError.message
              : "Could not read the app sign-in callback.",
          );
        }
      });

    return () => {
      active = false;
      void listener
        .then((handle) => handle.remove())
        .catch((listenerError: unknown) => {
          console.error("Could not remove the sign-in callback listener.", listenerError);
        });
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    error,
    loading: !ready,
    ready,
    signInWithGoogle: async () => {
      setError(null);
      await signInWithOAuth("google");
    },
    signInWithGitHub: async () => {
      setError(null);
      await signInWithOAuth("github");
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
