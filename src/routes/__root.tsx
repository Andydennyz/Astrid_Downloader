import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useNavigate,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { toast } from "sonner";
import AuthProvider from "@/components/providers/auth.tsx";
import ThemeProvider from "@/components/providers/theme.tsx";
import RouteError from "@/components/route-error.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { useAuthErrorToast } from "@/hooks/use-auth-error-toast.ts";
import { site } from "@/lib/site.ts";
import {
  addSharedTextListener,
  getInitialSharedText,
} from "@/services/native-storage.ts";
import { getServices } from "@/services/index.ts";
import { extractSharedMediaUrl } from "@/services/shared-media-link.ts";
import appCss from "@/index.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: site.name },
      { name: "description", content: site.tagline },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  errorComponent: RootRouteError,
  notFoundComponent: NotFound,
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  useAuthErrorToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let active = true;
    let removeListener: (() => void) | undefined;
    const handleSharedText = (text: string) => {
      if (!active) return;
      const url = extractSharedMediaUrl(text, (candidate) =>
        getServices().media.validateUrl(candidate).valid,
      );
      if (!url) {
        toast.info("The shared content does not include a valid web link.");
        return;
      }
      void navigate({ to: "/new", search: { url } });
    };

    void (async () => {
      try {
        const listener = await addSharedTextListener(({ text }) =>
          handleSharedText(text),
        );
        if (!active) {
          void listener.remove();
          return;
        }
        removeListener = () => {
          void listener.remove();
        };
        const initial = await getInitialSharedText();
        if (initial.text) handleSharedText(initial.text);
      } catch (error) {
        console.error("Could not initialize Android share handling.", error);
        toast.error("MediaDock could not receive the shared link.");
      }
    })();

    return () => {
      active = false;
      removeListener?.();
    };
  }, [navigate]);

  return <Outlet />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              {children}
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootRouteError(props: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <RouteError {...props} />
    </div>
  );
}

function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <meta name="robots" content="noindex" />
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          This page does not exist.
        </p>
        <div className="pt-4">
          <Link to="/" className={buttonVariants()}>
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
