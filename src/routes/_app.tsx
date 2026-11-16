import { useState } from "react";
import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
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
  const { ready } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSettings();
  const density = settings?.appearance.density ?? "comfortable";
  const isOverviewRoute = pathname === "/";
  const showQueueSidebar = pathname === "/queue";
  const showLibrarySidebar = [
    "/completed",
    "/audio",
    "/video",
    "/history",
  ].includes(pathname);
  const showHistorySidebar = ["/history", "/settings"].includes(pathname);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Checking your sign-in session…
      </div>
    );
  }

  return (
    <DownloadsProvider>
      <AppLayoutShell
        pathname={pathname}
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
  pathname,
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
  pathname: string;
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
  const [storedPanelState, setStoredPanelState] = useState(() => ({
    pathname,
    queueOpen: showQueueSidebar,
    libraryOpen: showLibrarySidebar,
    historySettingsOpen: showHistorySidebar,
  }));
  const panelState =
    storedPanelState.pathname === pathname
      ? storedPanelState
      : {
          pathname,
          queueOpen: showQueueSidebar,
          libraryOpen: showLibrarySidebar,
          historySettingsOpen: showHistorySidebar,
        };

  return (
    <div
      data-density={density}
      className="flex h-dvh overflow-hidden bg-background"
    >
      <AppSidebar collapsed={collapsed} onToggle={onToggleCollapsed} />
      <Sheet
        open={mobileOpen}
        onOpenChange={(next) => (next ? onOpenMobileNav() : onCloseMobileNav())}
      >
        <SheetContent
          side="left"
          className="w-72 gap-0 bg-sidebar p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <SidebarNav collapsed={false} onNavigate={onCloseMobileNav} />
          <div className="h-4" />
        </SheetContent>
      </Sheet>
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Soft teal and cyan wash behind the content for depth. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_80%_at_20%_-20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(ellipse_40%_60%_at_90%_-10%,color-mix(in_oklch,var(--accent)_8%,transparent),transparent)]" />
        <TopBar
          showSidePanelToggles={!isOverviewRoute}
          onOpenMobileNav={onOpenMobileNav}
          onToggleQueue={() =>
            setStoredPanelState({
              ...panelState,
              queueOpen: !panelState.queueOpen,
            })
          }
          onToggleLibrary={() =>
            setStoredPanelState({
              ...panelState,
              libraryOpen: !panelState.libraryOpen,
            })
          }
          onToggleHistorySettings={() =>
            setStoredPanelState({
              ...panelState,
              historySettingsOpen: !panelState.historySettingsOpen,
            })
          }
        />
        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          <div className="relative min-w-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
          <RouteSidebars
            key={pathname}
            showQueueSidebar={showQueueSidebar}
            showLibrarySidebar={showLibrarySidebar}
            showHistorySidebar={showHistorySidebar}
            queueOpen={panelState.queueOpen}
            libraryOpen={panelState.libraryOpen}
            historySettingsOpen={panelState.historySettingsOpen}
            onToggleQueue={() =>
              setStoredPanelState({
                ...panelState,
                queueOpen: !panelState.queueOpen,
              })
            }
            onToggleLibrary={() =>
              setStoredPanelState({
                ...panelState,
                libraryOpen: !panelState.libraryOpen,
              })
            }
            onToggleHistorySettings={() =>
              setStoredPanelState({
                ...panelState,
                historySettingsOpen: !panelState.historySettingsOpen,
              })
            }
          />
        </main>
      </div>
    </div>
  );
}

function RouteSidebars({
  showQueueSidebar,
  showLibrarySidebar,
  showHistorySidebar,
  queueOpen,
  libraryOpen,
  historySettingsOpen,
  onToggleQueue,
  onToggleLibrary,
  onToggleHistorySettings,
}: {
  showQueueSidebar: boolean;
  showLibrarySidebar: boolean;
  showHistorySidebar: boolean;
  queueOpen: boolean;
  libraryOpen: boolean;
  historySettingsOpen: boolean;
  onToggleQueue: () => void;
  onToggleLibrary: () => void;
  onToggleHistorySettings: () => void;
}) {
  return (
    <>
      {showLibrarySidebar && (
        <MediaLibrarySidebar open={libraryOpen} onToggle={onToggleLibrary} />
      )}
      {showQueueSidebar && (
        <QueueSidebar open={queueOpen} onToggle={onToggleQueue} />
      )}
      {showHistorySidebar && (
        <HistorySettingsSidebar
          open={historySettingsOpen}
          onToggle={onToggleHistorySettings}
        />
      )}
    </>
  );
}
