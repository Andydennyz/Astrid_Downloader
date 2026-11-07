import type { RoutePath } from "@/router.tsx";

type Site = {
  name: string;
  tagline: string;
  nav: Array<{ label: string; to: RoutePath }>;
};

export const site: Site = {
  name: "Astrid Downloader",
  tagline:
    "A premium desktop download manager for video and audio. Analyze links, pick exact formats and manage your media library.",
  nav: [{ label: "Overview", to: "/" }],
};
