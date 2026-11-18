import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/services/settings-storage.ts";
import type { LibraryItem } from "@/services/types.ts";
import { buildRedownloadRequest } from "../-lib/new-download.ts";

const { start, open, download, remove, getSettings } = vi.hoisted(() => ({
  start: vi.fn(),
  open: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/hooks/use-downloads.ts", () => ({
  useDownloads: () => ({ start }),
}));

vi.mock("@/hooks/use-media-data.ts", () => ({
  useFileActions: () => ({ open, download }),
  useRemoveLibraryItem: () => remove,
}));

vi.mock("@/services/index.ts", () => ({
  getServices: () => ({ settings: { get: getSettings } }),
}));

import LibraryItemActions, { MediaSourceLink } from "./library-item-actions.tsx";

const item: LibraryItem = {
  id: "lib-1",
  kind: "audio",
  filename: "mix.mp3",
  title: "Test mix",
  creator: "Test DJ",
  thumbnailUrl: "https://example.com/thumb.jpg",
  extension: "mp3",
  qualityLabel: "320 kbps",
  durationSec: 120,
  sizeBytes: 1024,
  downloadedAt: "2026-01-01T00:00:00.000Z",
  filePath: "",
  sourceUrl: "https://example.com/mix",
  platform: "other",
};

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(DEFAULT_SETTINGS);
  start.mockResolvedValue(null);
  download.mockResolvedValue(undefined);
});

describe("library item actions", () => {
  it("keeps playback, direct download, and source redownload as separate actions", async () => {
    render(<LibraryItemActions item={item} layout="grid" />);

    fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
    expect(open).toHaveBeenCalledWith(item.id, item.filename, item.filePath);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(download).toHaveBeenCalledWith(item.id, item.filename, undefined);

    fireEvent.click(screen.getByRole("button", { name: "Download again" }));
    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(buildRedownloadRequest(item, DEFAULT_SETTINGS)),
    );
  });

  it("passes server-staged media to the direct device download action", () => {
    const stagedItem = { ...item, filePath: "C:\\storage\\mix.mp3" };
    render(<LibraryItemActions item={stagedItem} layout="grid" />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(download).toHaveBeenCalledWith(
      stagedItem.id,
      stagedItem.filename,
      stagedItem.filePath,
    );
    expect(screen.getByRole("button", { name: "Download again" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Play preview" })).toBeVisible();
  });

  it("links the media title to its original HTTP source", () => {
    render(<MediaSourceLink sourceUrl={item.sourceUrl} title={item.title} />);
    expect(screen.getByRole("link", { name: item.title })).toHaveAttribute(
      "href",
      item.sourceUrl,
    );
    expect(screen.getByRole("link", { name: item.title })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});
