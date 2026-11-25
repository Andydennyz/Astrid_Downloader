import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { hasSupabaseConfig, supabase } from "@/lib/supabase.ts";

export function SignInPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [provider, setProvider] = useState<"google" | "github" | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignIn = async (nextProvider: "google" | "github") => {
    if (!supabase) {
      setError(
        "Supabase is not configured for this app yet. Add VITE_SUPABASE_URL and a publishable key.",
      );
      return;
    }

    try {
      setProvider(nextProvider);
      setError(null);
      setNotice(null);
      if (nextProvider === "google") {
        await auth.signInWithGoogle();
      } else {
        await auth.signInWithGitHub();
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start sign-in flow.";
      setError(message);
    } finally {
      setProvider(null);
    }
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError(
        "Supabase is not configured for this app yet. Add VITE_SUPABASE_URL and a publishable key.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          void navigate({ to: "/" });
        } else {
          setNotice(
            "Account created. Check your email for a confirmation link before signing in.",
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        void navigate({ to: "/" });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : mode === "sign-up"
            ? "Unable to create your account."
            : "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            backend neutral
          </p>
          <h1 className="text-3xl font-semibold">
            Authentication is not configured yet
          </h1>
          <p className="text-muted-foreground">
            Add your Supabase browser config or swap in any other auth provider
            without changing the app’s neutral UI/service contract.
          </p>
          <Link
            to="/new"
            className="text-sm text-primary underline underline-offset-4"
          >
            Continue without signing in
          </Link>
          <p className="text-sm text-muted-foreground">
            Required env values: VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).
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
            {mode === "sign-in" ? "sign in" : "create account"}
          </p>
          <h1 className="text-3xl font-semibold">
            {mode === "sign-in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "sign-in"
              ? "Sign in to keep your downloads tied to your account, or continue without signing in on this browser."
              : "Create an account with your email and password to keep your downloads tied to you."}
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleSignIn("google")}
            disabled={provider !== null || submitting}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          <button
            type="button"
            onClick={() => void handleSignIn("github")}
            disabled={provider !== null || submitting}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider === "github" ? "Opening GitHub…" : "Continue with GitHub"}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or use email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting || provider !== null}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting || provider !== null}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || provider !== null}
            className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? mode === "sign-up"
                ? "Creating account…"
                : "Signing in…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in with email"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "sign-up" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-4"
            onClick={() => {
              setMode(mode === "sign-up" ? "sign-in" : "sign-up");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "sign-up" ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="text-center text-sm">
          <Link to="/new" className="text-primary underline underline-offset-4">
            Continue without signing in
          </Link>
        </p>

        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          >
            {notice}
          </p>
        ) : null}

        {error ?? auth.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error ?? auth.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInPage,
});
