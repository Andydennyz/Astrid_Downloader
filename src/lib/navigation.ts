import type { ComponentType } from "react";
import {
  AudioLines,
  CheckCircle2,
  Clapperboard,
  History,
  HardDrive,
  LayoutDashboard,
  ListOrdered,
  ListVideo,
  PlusCircle,
  Play,
  Settings,
} from "lucide-react";
import type { RoutePath } from "@/router.tsx";

export type NavItem = {
  label: string;
  to: RoutePath;
  icon: ComponentType<{ className?: string }>;
  description: string;
};

export type NavSection = { label: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Overview",
        to: "/",
        icon: LayoutDashboard,
        description: "Your download activity at a glance",
      },
      {
        label: "New Download",
        to: "/new",
        icon: PlusCircle,
        description: "Paste a link and pick a format",
      },
      {
        label: "Direct Player",
        to: "/player",
        icon: Play,
        description: "Play a direct media URL or local file",
      },
      {
        label: "Device Media",
        to: "/device-media",
        icon: HardDrive,
        description: "Browse and play audio and video on this phone",
      },
      {
        label: "Download Queue",
        to: "/queue",
        icon: ListOrdered,
        description: "Active and waiting downloads",
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        label: "Completed",
        to: "/completed",
        icon: CheckCircle2,
        description: "Every finished download",
      },
      {
        label: "Audio",
        to: "/audio",
        icon: AudioLines,
        description: "Tracks, mixes and podcasts",
      },
      {
        label: "Video",
        to: "/video",
        icon: Clapperboard,
        description: "Films, talks and clips",
      },
      {
        label: "Playlists",
        to: "/playlists",
        icon: ListVideo,
        description: "Import and play M3U channel playlists",
      },
      {
        label: "History",
        to: "/history",
        icon: History,
        description: "Completed, failed and cancelled",
      },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  label: "Settings",
  to: "/settings",
  icon: Settings,
  description: "Preferences, appearance and advanced options",
};

export const ALL_NAV: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  SETTINGS_NAV,
];

/** Longer titles for the top bar than the compact sidebar labels. */
const PAGE_TITLES: Partial<Record<RoutePath, string>> = {
  "/completed": "Completed Downloads",
  "/audio": "Audio Downloads",
  "/video": "Video Downloads",
  "/history": "Download History",
  "/player": "Direct Player",
  "/device-media": "Device Media",
  "/playlists": "M3U Playlists",
};

export function findNav(pathname: string): NavItem | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return ALL_NAV.find((item) => item.to === clean);
}

export function pageTitle(item: NavItem | undefined) {
  if (!item) return "MediaDock";
  return PAGE_TITLES[item.to] ?? item.label;
}
