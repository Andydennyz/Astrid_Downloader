import { Link, useLocation } from "@tanstack/react-router";
import {
  BookOpenText,
  History,
  ListOrdered,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import ThemeToggle from "@/components/theme-toggle.tsx";
import { findNav, pageTitle } from "@/lib/navigation.ts";
import ActivityIndicator from "./activity-indicator.tsx";
import NotificationsMenu from "./notifications-menu.tsx";
import SearchPalette from "./search-palette.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

export default function TopBar({
  showSidePanelToggles = true,
  onOpenMobileNav,
  onToggleQueue,
  onToggleLibrary,
  onToggleHistorySettings,
}: {
  showSidePanelToggles?: boolean;
  onOpenMobileNav: () => void;
  onToggleQueue: () => void;
  onToggleLibrary: () => void;
  onToggleHistorySettings: () => void;
}) {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const nav = findNav(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/75 px-4 backdrop-blur-xl md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu />
      </Button>
      <div className="min-w-0 shrink-0 md:w-56">
        <h1 className="truncate font-display text-[17px] font-semibold tracking-tight">
          {pageTitle(nav)}
        </h1>
        {nav && (
          <p className="hidden truncate text-xs text-muted-foreground md:block">
            {nav.description}
          </p>
        )}
      </div>
      <div className="hidden flex-1 justify-center md:flex">
        <SearchPalette />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {showSidePanelToggles && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle media library"
              onClick={onToggleLibrary}
              className="xl:hidden"
            >
              <BookOpenText />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle queue"
              onClick={onToggleQueue}
              className="xl:hidden"
            >
              <ListOrdered />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle history and settings"
              onClick={onToggleHistorySettings}
              className="xl:hidden"
            >
              <History />
            </Button>
          </>
        )}
        <ActivityIndicator />
        <NotificationsMenu />
        <ThemeToggle />
        {user ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              void signOut().catch((error: unknown) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not sign out.",
                );
              });
            }}
          >
            <LogOut />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/auth/sign-in" />}
          >
            <LogIn />
            Sign in
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          nativeButton={false}
          render={<Link to="/settings" />}
        >
          <Settings />
        </Button>
        {pathname !== "/new" && (
          <Button
            size="sm"
            className="ml-1 hidden sm:inline-flex"
            nativeButton={false}
            render={<Link to="/new" />}
          >
            <Plus />
            New download
          </Button>
        )}
      </div>
    </header>
  );
}
