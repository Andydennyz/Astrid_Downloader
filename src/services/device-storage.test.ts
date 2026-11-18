import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_DOWNLOADS_MODE,
  chooseDownloadDirectory,
  getDownloadDirectoryName,
} from "./device-storage.ts";

describe("device download fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses browser downloads when folder access is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(getDownloadDirectoryName()).resolves.toBe(
      BROWSER_DOWNLOADS_MODE,
    );
    await expect(chooseDownloadDirectory()).resolves.toBe(
      BROWSER_DOWNLOADS_MODE,
    );
  });
});
