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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
  const metadata = user?.user_metadata ?? {};
  const metadataName = [metadata.full_name, metadata.name, metadata.user_name].find(
    (value) => typeof value === "string" && value.trim(),
  );
  const displayName =
    typeof metadataName === "string"
      ? metadataName.trim()
      : user?.email?.split("@")[0] || "Account";
  const avatarValue = metadata.avatar_url ?? metadata.picture;
  const avatarUrl = typeof avatarValue === "string" ? avatarValue : undefined;
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-w-40 gap-2 px-2"
                  aria-label={`Profile: ${displayName}`}
                  title={user.email ?? displayName}
                />
              }
            >
              <Avatar className="size-7">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate sm:inline">
                {displayName}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar size="lg">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email ?? "Signed in"}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
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
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
