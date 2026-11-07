import type { AppServices } from "./contracts.ts";
import { createMockClipboardService } from "./mock/clipboard.ts";
import { createMockDownloadService } from "./mock/downloads.ts";
import { createMockMediaService } from "./mock/media.ts";
import {
  createLocalSettingsService,
  createMockFileSystemService,
  createMockHistoryService,
  createMockLibraryService,
  createMockStatsService,
} from "./mock/other.ts";

/**
 * The single place that decides which implementation the app uses.
 *
 * To connect a real backend, write `createHttpServices(baseUrl)` returning the
 * same `AppServices` shape and swap it in here. No UI code needs to change.
 */
function createServices(): AppServices {
  return {
    media: createMockMediaService(),
    clipboard: createMockClipboardService(),
    downloads: createMockDownloadService(),
    library: createMockLibraryService(),
    history: createMockHistoryService(),
    stats: createMockStatsService(),
    fileSystem: createMockFileSystemService(),
    settings: createLocalSettingsService(),
  };
}

let instance: AppServices | null = null;

/** Lazily created so the mock engine only runs in the browser. */
export function getServices(): AppServices {
  instance ??= createServices();
  return instance;
}

export type * from "./contracts.ts";
export type * from "./types.ts";
