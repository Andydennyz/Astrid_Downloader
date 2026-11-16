import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { hasSupabaseConfig, supabase } from "@/lib/supabase.ts";

function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      window.location.replace("/auth/sign-in");
      return;
    }

    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;

        if (data.session) {
          window.location.replace("/");
          return;
        }

        setMessage("No active session was found. Redirecting back to sign-in…");
        window.setTimeout(() => {
          window.location.replace("/auth/sign-in");
        }, 1500);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Could not complete sign-in. Return to sign-in and try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="max-w-md space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          auth
        </p>
        <h1 className="text-3xl font-semibold">{message}</h1>
        <p className="text-muted-foreground">
          Finalizing your secure session and returning you to the app.
        </p>
        <Link to="/auth/sign-in" className="text-sm text-primary underline">
          Return to sign-in
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});
