import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { hasSupabaseConfig, supabase } from "@/lib/supabase.ts";

function SignInPage() {
  const [provider, setProvider] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (nextProvider: "google" | "github") => {
    if (!supabase) {
      setError("Supabase is not configured for this app yet. Add VITE_SUPABASE_URL and a publishable key.");
      return;
    }

    try {
      setProvider(nextProvider);
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: nextProvider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signInError) throw signInError;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Unable to start sign-in flow.";
      setError(message);
    } finally {
      setProvider(null);
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            backend neutral
          </p>
          <h1 className="text-3xl font-semibold">Authentication is not configured yet</h1>
          <p className="text-muted-foreground">
            Add your Supabase browser config or swap in any other auth provider without changing the
            app’s neutral UI/service contract.
          </p>
          <p className="text-sm text-muted-foreground">
            Required env values: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or
            VITE_SUPABASE_ANON_KEY).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            sign in
          </p>
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="text-muted-foreground">Continue with your provider to unlock your downloads.</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleSignIn("google")}
            disabled={provider !== null}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          <button
            type="button"
            onClick={() => void handleSignIn("github")}
            disabled={provider !== null}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider === "github" ? "Opening GitHub…" : "Continue with GitHub"}
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInPage,
});
