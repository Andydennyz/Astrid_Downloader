import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
const { requestLegacyStoragePermission } = vi.hoisted(() => ({
  requestLegacyStoragePermission: vi.fn(),
}));
vi.mock("./native-storage.ts", () => ({
  deleteFromDownloads: vi.fn(),
  requestLegacyStoragePermission,
}));
import {
  BROWSER_DOWNLOADS_MODE,
  chooseDownloadDirectory,
  getDeviceRelativePath,
  getMediaDockRelativeDirectory,
  getMediaDockRelativePath,
  getDownloadDirectoryName,
  NATIVE_DOCUMENTS_MODE,
  requestNativeDownloadAccess,
} from "./device-storage.ts";

describe("device download fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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

  it("uses the app Documents folder without prompting on native platforms", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    await expect(getDownloadDirectoryName()).resolves.toBe(
      NATIVE_DOCUMENTS_MODE,
    );
    await expect(chooseDownloadDirectory()).resolves.toBe(
      NATIVE_DOCUMENTS_MODE,
    );
  });

  it("requests legacy Android storage permission before queueing", async () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    requestLegacyStoragePermission.mockResolvedValue({ granted: true });

    await expect(requestNativeDownloadAccess()).resolves.toBeUndefined();
    expect(requestLegacyStoragePermission).toHaveBeenCalledOnce();
  });

  it("stops a download when legacy storage access is denied", async () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    requestLegacyStoragePermission.mockResolvedValue({ granted: false });

    await expect(requestNativeDownloadAccess()).rejects.toThrow(
      "Allow MediaDock storage access before starting a download.",
    );
  });

  it("keeps native download paths relative and rejects traversal", () => {
    expect(getDeviceRelativePath("video.mp4", "./Video/Creator")).toBe(
      "Video/Creator/video.mp4",
    );
    expect(() => getDeviceRelativePath("../video.mp4")).toThrow(
      "The media path is not a safe relative path.",
    );
  });

  it("organizes public Android downloads by media type and creator", () => {
    expect(getMediaDockRelativePath("video.mp4", "./Video/Creator")).toBe(
      "MediaDock/videos/Creator/video.mp4",
    );
    expect(getMediaDockRelativePath("mix.mp3", "./Audio/Creator")).toBe(
      "MediaDock/audios/Creator/mix.mp3",
    );
    expect(getMediaDockRelativeDirectory("mix.mp3", "./Audio/Creator")).toBe(
      "audios/Creator",
    );
    expect(getMediaDockRelativePath("MediaDock/videos/Creator/video.mp4")).toBe(
      "MediaDock/videos/Creator/video.mp4",
    );
  });

  it("rejects unsafe public Android media paths", () => {
    expect(() => getMediaDockRelativePath("../video.mp4")).toThrow(
      "The media path is not a safe relative path.",
    );
  });
});
