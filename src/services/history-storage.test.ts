import { beforeEach, describe, expect, it } from "vitest";
import type { DownloadJob, HistoryEntry } from "./types.ts";
import {
  clearLocalHistory,
  historyEntryFromJob,
  HISTORY_STORAGE_KEY,
  loadLocalHistory,
  mergeHistoryEntries,
  rememberLocalHistory,
  removeLocalHistory,
  saveLocalHistory,
} from "./history-storage.ts";

const localEntry: HistoryEntry = {
  id: "hist_local",
  title: "Local download",
  creator: "Creator",
  thumbnailUrl: "https://example.com/thumb.jpg",
  sourceUrl: "https://example.com/video",
  platform: "other",
  kind: "video",
  status: "completed",
  durationSec: 60,
  extension: "mp4",
  qualityLabel: "720p",
  timestamp: "2026-11-25T10:00:00.000Z",
};

describe("device history storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists local records, removes individual entries, and clears all history", () => {
    rememberLocalHistory(localEntry);
    expect(loadLocalHistory()).toEqual([localEntry]);

    rememberLocalHistory({ ...localEntry, title: "Updated download" });
    expect(loadLocalHistory()[0].title).toBe("Updated download");

    removeLocalHistory(localEntry.id);
    expect(loadLocalHistory()).toEqual([]);

    saveLocalHistory([localEntry]);
    clearLocalHistory();
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe("[]");
  });

  it("prefers database rows when merging metadata with the same id", () => {
    const updatedEntry = { ...localEntry, title: "Database title" };
    expect(mergeHistoryEntries([updatedEntry], [localEntry])).toEqual([
      updatedEntry,
    ]);
  });

  it("creates a local history record when a download reaches a final state", () => {
    const job: DownloadJob = {
      id: "job-1",
      request: {
        sourceUrl: "https://example.com/video",
        title: "Downloaded video",
        creator: "Creator",
        thumbnailUrl: "https://example.com/thumb.jpg",
        durationSec: 42,
        selection: {
          mode: "video",
          videoQuality: "720p",
          audioFormat: "best",
          container: "mp4",
        },
        destination: ".",
      },
      kind: "video",
      extension: "mp4",
      qualityLabel: "720p",
      status: "completed",
      progress: 1,
      downloadedBytes: 1000,
      totalBytes: 1000,
      speedBps: null,
      etaSec: null,
      createdAt: "2026-11-25T10:00:00.000Z",
      completedAt: "2026-11-25T10:01:00.000Z",
      filePath: "downloads/video.mp4",
    };

    expect(historyEntryFromJob(job)).toMatchObject({
      id: "hist_job-1",
      title: "Downloaded video",
      status: "completed",
      filePath: "downloads/video.mp4",
      libraryId: "lib_job-1",
      filename: "video.mp4",
    });
    expect(historyEntryFromJob({ ...job, status: "downloading" })).toBeNull();
  });
});
