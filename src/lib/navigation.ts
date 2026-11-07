import type { ComponentType } from "react";
import {
  AudioLines,
  CheckCircle2,
  Clapperboard,
  History,
  LayoutDashboard,
  ListOrdered,
  PlusCircle,
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
      { label: "Overview", to: "/", icon: LayoutDashboard, description: "Your download activity at a glance" },
      { label: "New Download", to: "/new", icon: PlusCircle, description: "Paste a link and pick a format" },
      { label: "Download Queue", to: "/queue", icon: ListOrdered, description: "Active and waiting downloads" },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Completed", to: "/completed", icon: CheckCircle2, description: "Every finished download" },
      { label: "Audio", to: "/audio", icon: AudioLines, description: "Tracks, mixes and podcasts" },
      { label: "Video", to: "/video", icon: Clapperboard, description: "Films, talks and clips" },
      { label: "History", to: "/history", icon: History, description: "Completed, failed and cancelled" },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  label: "Settings",
  to: "/settings",
  icon: Settings,
  description: "Preferences, appearance and advanced options",
};

export const ALL_NAV: NavItem[] = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_NAV];

/** Longer titles for the top bar than the compact sidebar labels. */
const PAGE_TITLES: Partial<Record<RoutePath, string>> = {
  "/completed": "Completed Downloads",
  "/audio": "Audio Downloads",
  "/video": "Video Downloads",
  "/history": "Download History",
};

export function findNav(pathname: string): NavItem | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return ALL_NAV.find((item) => item.to === clean);
}

export function pageTitle(item: NavItem | undefined) {
  if (!item) return "Astrid";
  return PAGE_TITLES[item.to] ?? item.label;
}
