import type {
  FileSystemService,
  HistoryService,
  LibraryService,
  SettingsService,
  StatsService,
} from "@/services/contracts.ts";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/services/settings-storage.ts";
import type { ActivityPoint } from "@/services/types.ts";
import { DEFAULT_ROOT } from "./data.ts";
import { delay, mockDb } from "./store.ts";

export function createMockLibraryService(): LibraryService {
  return {
    async list(query) {
      await delay(350);
      const search = query?.search?.trim().toLowerCase();
      return mockDb.library.filter((item) => {
        if (query?.kind && item.kind !== query.kind) return false;
        if (!search) return true;
        return [item.title, item.creator, item.filename].some((v) =>
          v.toLowerCase().includes(search),
        );
      });
    },
    async remove(itemId) {
      await delay(150);
      mockDb.removeLibraryItem(itemId);
    },
    subscribe: (listener) => mockDb.libraryChanged.subscribe(listener),
  };
}

export function createMockHistoryService(): HistoryService {
  return {
    async list() {
      await delay(350);
      return [...mockDb.history];
    },
    async remove(entryId) {
      await delay(120);
      mockDb.removeHistory(entryId);
    },
    async clear() {
      await delay(200);
      mockDb.clearHistory();
    },
    subscribe: (listener) => mockDb.historyChanged.subscribe(listener),
  };
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createMockStatsService(): StatsService {
  return {
    async getOverview(days) {
      await delay(400);
      const history = mockDb.history;
      const byDay = new Map<string, ActivityPoint>();
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dayKey(d);
        // A gentle baseline wave so the chart reads as long-term usage.
        const wave = Math.round(3 + 2 * Math.sin(i / 2.3) + (i % 3));
        byDay.set(key, { date: key, video: wave, audio: Math.max(1, wave - 2 + (i % 2)) });
      }
      for (const entry of history) {
        if (entry.status !== "completed") continue;
        const point = byDay.get(dayKey(new Date(entry.timestamp)));
        if (point) point[entry.kind] += 1;
      }
      const activity = [...byDay.values()];
      const baseline = activity.reduce((s, p) => s + p.video + p.audio, 0) - history.length;
      const completed = history.filter((h) => h.status === "completed").length;
      return {
        totalDownloads: baseline + history.length,
        completed: baseline + completed,
        failed: history.filter((h) => h.status === "failed").length,
        storageBytes: mockDb.library.reduce((s, item) => s + item.sizeBytes, 0),
        activity,
      };
    },
  };
}

const PICKER_FOLDERS = [
  "~/Movies/Astrid",
  "~/Music/Astrid",
  "~/Desktop",
  "/Volumes/Media/Downloads",
  DEFAULT_ROOT,
];

/**
 * Browser stand-in for the desktop filesystem bridge. Opening and revealing
 * resolve after a short delay; copying uses the real clipboard.
 */
export function createMockFileSystemService(): FileSystemService {
  return {
    async openFile() {
      await delay(300);
    },
    async revealInFolder() {
      await delay(300);
    },
    async copyPath(path) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(path);
      }
    },
    async chooseFolder(current) {
      await delay(450);
      // A native picker would return the user's choice. Cycle through plausible
      // folders so the demo visibly changes the destination.
      const index = PICKER_FOLDERS.indexOf(current);
      return PICKER_FOLDERS[(index + 1) % PICKER_FOLDERS.length] ?? DEFAULT_ROOT;
    },
    async fileExists(path) {
      return mockDb.library.some((item) => item.filePath === path);
    },
  };
}

export function createLocalSettingsService(): SettingsService {
  return {
    async get() {
      return loadSettings();
    },
    async update(next) {
      saveSettings(next);
      return next;
    },
    async reset() {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    },
  };
}
