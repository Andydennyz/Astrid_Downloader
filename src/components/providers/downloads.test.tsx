import { useContext } from "react";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DownloadJob } from "@/services/types.ts";

const { list, saveCompletedFile } = vi.hoisted(() => ({
  list: vi.fn(),
  saveCompletedFile: vi.fn(),
}));

vi.mock("@/services/index.ts", () => ({
  getServices: () => ({
    downloads: { list },
    fileSystem: {
      getFolderName: vi.fn().mockResolvedValue(null),
      saveCompletedFile,
    },
    library: { list: vi.fn().mockResolvedValue([]) },
  }),
}));

import { DownloadsContext } from "@/hooks/use-downloads.ts";
import DownloadsProvider from "./downloads.tsx";

const originalVisibilityState = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState",
);

function createJob(status: DownloadJob["status"], progress = 0): DownloadJob {
  return {
    id: "job-1",
    request: {
      sourceUrl: "https://example.com/video",
      title: "Test video",
      creator: "Test creator",
      thumbnailUrl: "",
      durationSec: 30,
      selection: {
        mode: "video+audio",
        videoQuality: "best",
        audioFormat: "best",
        container: "mp4",
      },
      destination: "",
    },
    kind: "video",
    extension: "mp4",
    qualityLabel: "best",
    status,
    progress,
    downloadedBytes: 0,
    totalBytes: 100,
    speedBps: 0,
    etaSec: 0,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function renderDownloadsProbe(
  snapshots: Array<{ progress: number; loading: boolean }>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Probe() {
    const value = useContext(DownloadsContext);
    if (!value) throw new Error("Downloads context is missing.");
    snapshots.push({
      progress: value.jobs[0]?.progress ?? -1,
      loading: value.loading,
    });
    return null;
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <DownloadsProvider>
        <Probe />
      </DownloadsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalVisibilityState) {
    Object.defineProperty(document, "visibilityState", originalVisibilityState);
  } else {
    Reflect.deleteProperty(document, "visibilityState");
  }
});

describe("DownloadsProvider polling", () => {
  it("keeps live progress frequent and applies changed job data", async () => {
    list
      .mockResolvedValueOnce([createJob("downloading", 0.1)])
      .mockResolvedValueOnce([createJob("downloading", 0.2)]);
    const snapshots: Array<{ progress: number; loading: boolean }> = [];
    renderDownloadsProbe(snapshots);

    await act(async () => {
      await Promise.resolve();
    });
    expect(list).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)).toEqual({ progress: 0.1, loading: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2499);
    });
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(snapshots.at(-1)).toEqual({ progress: 0.2, loading: false });
  });

  it("backs off while idle and avoids rerendering consumers for unchanged jobs", async () => {
    list.mockResolvedValue([createJob("completed")]);
    const snapshots: Array<{ progress: number; loading: boolean }> = [];
    renderDownloadsProbe(snapshots);

    await act(async () => {
      await Promise.resolve();
    });
    const renderCount = snapshots.length;
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_999);
    });
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(snapshots).toHaveLength(renderCount);
  });

  it("automatically transfers completed backend files to the selected device folder", async () => {
    const completed = {
      ...createJob("completed"),
      filePath: "C:\\storage\\media-job-1.mp4",
    };
    list.mockResolvedValue([completed]);
    saveCompletedFile.mockResolvedValue("media-job-1.mp4");
    renderDownloadsProbe([]);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCompletedFile).toHaveBeenCalledWith(
      "job-1",
      "media-job-1.mp4",
      "C:\\storage\\media-job-1.mp4",
      undefined,
    );
  });
});
