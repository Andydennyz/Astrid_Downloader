import type { Platform } from "./types.ts";

/**
 * Filename helpers shared by the UI preview and the mock engine. A real backend
 * should apply the same rules so the preview matches the saved file.
 */

export type FilenameVars = {
  title: string;
  creator: string;
  quality: string;
  platform: Platform;
};

/** Removes characters that are invalid on Windows, macOS or Linux. */
export function sanitizeFilename(name: string) {
  return name
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/** Strips the "Best (1080p)" wrapper so filenames read "1080p". */
export function plainQuality(label: string) {
  return label.replace(/^Best \((.+)\)$/, "$1");
}

/**
 * Renders a template such as "{title} [{quality}]". Unknown tokens are left as
 * typed so the user can spot a typo in the preview.
 */
export function renderFilenameTemplate(template: string, vars: FilenameVars) {
  const values: Record<string, string> = {
    title: vars.title,
    creator: vars.creator,
    quality: plainQuality(vars.quality),
    platform: vars.platform,
  };
  const rendered = template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
  return sanitizeFilename(rendered) || sanitizeFilename(vars.title) || "download";
}
