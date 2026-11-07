import { useState } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import AppSidebar, { SidebarNav } from "@/components/shell/app-sidebar.tsx";
import TopBar from "@/components/shell/top-bar.tsx";
import Logo from "@/components/logo.tsx";
import DownloadsProvider from "@/components/providers/downloads.tsx";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet.tsx";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DownloadsProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center px-5">
              <Logo />
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="h-4" />
          </SheetContent>
        </Sheet>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Soft violet and cyan wash behind the content for depth. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_80%_at_20%_-20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(ellipse_40%_60%_at_90%_-10%,color-mix(in_oklch,var(--accent)_8%,transparent),transparent)]" />
          <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
          <main className="relative flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </DownloadsProvider>
  );
}
