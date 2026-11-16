import { useState } from "react";
import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import AppSidebar, { SidebarNav } from "@/components/shell/app-sidebar.tsx";
import TopBar from "@/components/shell/top-bar.tsx";
import QueueSidebar from "@/components/shell/queue-sidebar.tsx";
import MediaLibrarySidebar from "@/components/shell/media-library-sidebar.tsx";
import HistorySettingsSidebar from "@/components/shell/history-settings-sidebar.tsx";
import Logo from "@/components/logo.tsx";
import DownloadsProvider from "@/components/providers/downloads.tsx";
import { useSettings } from "@/hooks/use-media-data.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet.tsx";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { pathname } = useLocation();
  const { ready, user, error: authError } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSettings();
  const density = settings?.appearance.density ?? "comfortable";
  const isOverviewRoute = pathname === "/";
  const showQueueSidebar = pathname === "/queue";
  const showLibrarySidebar = ["/completed", "/audio", "/video", "/history"].includes(pathname);
  const showHistorySidebar = ["/history", "/settings"].includes(pathname);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Checking your sign-in session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in to your account</h1>
          <p className="text-sm text-muted-foreground">
            Your download queue, history, and media library are private to your account.
          </p>
          {authError && <p role="alert" className="text-sm text-destructive">{authError}</p>}
          <Link
            to="/auth/sign-in"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DownloadsProvider>
      <AppLayoutShell
        key={pathname}
        density={density}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onOpenMobileNav={() => setMobileOpen(true)}
        onCloseMobileNav={() => setMobileOpen(false)}
        isOverviewRoute={isOverviewRoute}
        showQueueSidebar={showQueueSidebar}
        showLibrarySidebar={showLibrarySidebar}
        showHistorySidebar={showHistorySidebar}
      />
    </DownloadsProvider>
  );
}

function AppLayoutShell({
  density,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onOpenMobileNav,
  onCloseMobileNav,
  isOverviewRoute,
  showQueueSidebar,
  showLibrarySidebar,
  showHistorySidebar,
}: {
  density: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  isOverviewRoute: boolean;
  showQueueSidebar: boolean;
  showLibrarySidebar: boolean;
  showHistorySidebar: boolean;
}) {
  const [queueOpen, setQueueOpen] = useState(showQueueSidebar);
  const [libraryOpen, setLibraryOpen] = useState(showLibrarySidebar);
  const [historySettingsOpen, setHistorySettingsOpen] = useState(showHistorySidebar);

  return (
    <div data-density={density} className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar collapsed={collapsed} onToggle={onToggleCollapsed} />
      <Sheet open={mobileOpen} onOpenChange={(next) => (next ? onOpenMobileNav() : onCloseMobileNav())}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <SidebarNav collapsed={false} onNavigate={onCloseMobileNav} />
          <div className="h-4" />
        </SheetContent>
      </Sheet>
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Soft violet and cyan wash behind the content for depth. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_80%_at_20%_-20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(ellipse_40%_60%_at_90%_-10%,color-mix(in_oklch,var(--accent)_8%,transparent),transparent)]" />
        <TopBar
          showSidePanelToggles={!isOverviewRoute}
          onOpenMobileNav={onOpenMobileNav}
          onToggleQueue={() => setQueueOpen((value) => !value)}
          onToggleLibrary={() => setLibraryOpen((value) => !value)}
          onToggleHistorySettings={() => setHistorySettingsOpen((value) => !value)}
        />
        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          <div className="relative min-w-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
          {showLibrarySidebar && <MediaLibrarySidebar open={libraryOpen} onToggle={() => setLibraryOpen((value) => !value)} />}
          {showQueueSidebar && <QueueSidebar open={queueOpen} onToggle={() => setQueueOpen((value) => !value)} />}
          {showHistorySidebar && (
            <HistorySettingsSidebar open={historySettingsOpen} onToggle={() => setHistorySettingsOpen((value) => !value)} />
          )}
        </main>
      </div>
    </div>
  );
}
