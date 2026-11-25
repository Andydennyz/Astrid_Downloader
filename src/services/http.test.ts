import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

const {
  getSupabaseSession,
  getGuestToken,
  getDownloadDirectoryName,
  getMediaDockRelativeDirectory,
  getMediaDockRelativePath,
  readDeviceFile,
  writeDeviceFile,
  downloadFile,
  makeDirectory,
  getUri,
  downloadToDownloads,
  getDownloadUri,
} = vi.hoisted(() => ({
  getSupabaseSession: vi.fn(),
  getGuestToken: vi.fn(),
  getDownloadDirectoryName: vi.fn(),
  getMediaDockRelativeDirectory: vi.fn(),
  getMediaDockRelativePath: vi.fn(),
  readDeviceFile: vi.fn(),
  writeDeviceFile: vi.fn(),
  downloadFile: vi.fn(),
  makeDirectory: vi.fn(),
  getUri: vi.fn(),
  downloadToDownloads: vi.fn(),
  getDownloadUri: vi.fn(),
}));

vi.mock("../lib/supabase.ts", () => ({ getSupabaseSession }));
vi.mock("../lib/guest.ts", () => ({ getGuestToken }));
vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: { downloadFile },
}));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Documents: "DOCUMENTS" },
  Filesystem: {
    mkdir: makeDirectory,
    getUri,
  },
}));
vi.mock("./native-storage.ts", () => ({ downloadToDownloads, getDownloadUri }));
vi.mock("./device-storage.ts", () => ({
  BROWSER_DOWNLOADS_MODE: "browser-downloads",
  NATIVE_DOCUMENTS_MODE: "native-documents",
  chooseDownloadDirectory: vi.fn(),
  getDeviceRelativePath: vi.fn(),
  getMediaDockRelativeDirectory,
  getMediaDockRelativePath,
  getDownloadDirectoryName,
  readDeviceFile,
  removeDeviceFile: vi.fn(),
  writeDeviceFile,
}));

import { createHttpServices } from "./http.ts";
import {
  BROWSER_DOWNLOADS_MODE,
  NATIVE_DOCUMENTS_MODE,
} from "./device-storage.ts";
import { HISTORY_STORAGE_KEY } from "./history-storage.ts";

describe("HTTP service authentication", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_BACKEND_URL", "");
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it.each([
    ["https://www.facebook.com/watch/?v=123", "facebook"],
    ["https://www.instagram.com/reel/abc123/", "instagram"],
    ["https://pin.it/abc123", "pinterest"],
  ] as const)("recognizes %s as a supported platform", (url, platform) => {
    expect(createHttpServices().media.validateUrl(url)).toEqual({
      valid: true,
      platform,
    });
  });

  it("uses a guest token when there is no signed-in session", async () => {
    getSupabaseSession.mockResolvedValue(null);
    getGuestToken.mockReturnValue("guest-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "media-1",
          sourceUrl: "https://example.com/media",
          platform: "other",
          title: "Test media",
          creator: "Test creator",
          durationSec: 30,
          thumbnailUrl: "",
          uploadedAt: "2026-01-01T00:00:00Z",
          formats: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().media.analyze("https://example.com/media");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/media/analyze",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Guest-Token": "guest-token" }),
      }),
    );
  });

  it("offers sign-in when a guest link is not supported", async () => {
    getSupabaseSession.mockResolvedValue(null);
    getGuestToken.mockReturnValue("guest-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ detail: "Sign in to use other supported sites." }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(
      createHttpServices().media.analyze("https://example.com/media"),
    ).rejects.toMatchObject({
      code: "INVALID_STATE",
      message: "Sign in to use other supported sites.",
    });
  });

  it("merges locally saved metadata with database history for signed-in users", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "signed-token" });
    const localEntry = {
      id: "hist_local",
      title: "Offline metadata",
      creator: "Creator",
      thumbnailUrl: "",
      sourceUrl: "https://example.com/local",
      platform: "other",
      kind: "video",
      status: "completed",
      durationSec: 30,
      extension: "mp4",
      qualityLabel: "720p",
      timestamp: "2026-11-25T10:00:00.000Z",
    };
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([localEntry]),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            ...localEntry,
            id: "hist_remote",
            title: "Database metadata",
            sourceUrl: "https://example.com/remote",
            timestamp: "2026-11-25T10:01:00.000Z",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await createHttpServices().history.list();

    expect(history.map((entry) => entry.title)).toEqual([
      "Database metadata",
      "Offline metadata",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/history",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer signed-token",
        }),
      }),
    );
    expect(
      JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]"),
    ).toHaveLength(2);
  });

  it("clears local and database history together", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "signed-token" });
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: "hist_local",
          title: "Video",
          creator: "Creator",
          thumbnailUrl: "",
          sourceUrl: "https://example.com/video",
          platform: "other",
          kind: "video",
          status: "completed",
          durationSec: 30,
          extension: "mp4",
          qualityLabel: "720p",
          timestamp: "2026-11-25T10:00:00.000Z",
        },
      ]),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().history.clear();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/history",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe("[]");
  });

  it("uses the same-origin proxy for the local backend during development", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000/api/v1");
    getSupabaseSession.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "media-1",
          sourceUrl: "https://example.com/media",
          platform: "other",
          title: "Test media",
          creator: "Test creator",
          durationSec: 30,
          thumbnailUrl: "",
          uploadedAt: "2026-01-01T00:00:00Z",
          formats: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().media.analyze("https://example.com/media");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/media/analyze",
      expect.any(Object),
    );
  });

  it("sends the current Supabase access token with media analysis", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "media-1",
          sourceUrl: "https://example.com/media",
          platform: "other",
          title: "Test media",
          creator: "Test creator",
          durationSec: 30,
          thumbnailUrl: "",
          uploadedAt: "2026-01-01T00:00:00Z",
          formats: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().media.analyze("https://example.com/media");

    expect(getSupabaseSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/media/analyze",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
  });

  it("explains how to recover when the API rejects a missing session", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Missing bearer token." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createHttpServices().media.analyze("https://example.com/media"),
    ).rejects.toThrow(
      "Your session is missing or expired. Refresh the page or sign in again.",
    );
  });

  it("explains how to recover when the backend cannot be reached", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      createHttpServices().media.analyze("https://example.com/media"),
    ).rejects.toThrow(
      "Cannot reach the backend at /api/v1/media/analyze. Check that the backend server is running, then try again.",
    );
  });

  it("returns null for a download that no longer exists", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Download job not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createHttpServices().downloads.getProgress("deleted-job"),
    ).resolves.toBeNull();
  });

  it("preserves validation errors as invalid-URL service errors", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: "A valid absolute HTTP or HTTPS media URL is required.",
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      createHttpServices().media.analyze("ftp://example.com/media"),
    ).rejects.toMatchObject({
      code: "INVALID_URL",
    });
  });

  it("returns an in-app player source for a server media file without opening a popup", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const open = vi.spyOn(window, "open");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "signed-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const path = "C:\\storage\\video.mp4";

    const source = await createHttpServices().fileSystem.openFile(
      "library-1",
      "video.mp4",
      path,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/open-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path }),
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(source).toEqual({
      url: "/api/v1/files/open/signed-ticket",
      title: "video.mp4",
      element: "video",
      isHls: false,
      isObjectUrl: false,
    });
  });

  it("returns a revocable in-app source for a device video", async () => {
    readDeviceFile.mockResolvedValue(new File(["video"], "video.mp4"));
    const createObjectURL = vi.fn().mockReturnValue("blob:device-video");
    const open = vi.spyOn(window, "open");
    vi.stubGlobal("URL", { createObjectURL });

    const source = await createHttpServices().fileSystem.openFile(
      "library-1",
      "video.mp4",
    );

    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "video/mp4" }),
    );
    expect(open).not.toHaveBeenCalled();
    expect(source).toMatchObject({
      url: "blob:device-video",
      title: "video.mp4",
      element: "video",
      isObjectUrl: true,
    });
  });

  it("returns a player source for a shared Android download URI", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    const open = vi.spyOn(window, "open");
    vi.spyOn(Capacitor, "convertFileSrc").mockReturnValue(
      "http://localhost/_capacitor_file_/MediaDock/videos/clip.mp4",
    );
    getMediaDockRelativePath.mockReturnValue("MediaDock/videos/clip.mp4");
    getDownloadUri.mockResolvedValue({
      uri: "content://media/external/downloads/42",
    });

    const source = await createHttpServices().fileSystem.openFile(
      "library-1",
      "MediaDock/videos/clip.mp4",
    );

    expect(getDownloadUri).toHaveBeenCalledWith({
      relativePath: "videos/clip.mp4",
    });
    expect(open).not.toHaveBeenCalled();
    expect(source).toMatchObject({
      url: "http://localhost/_capacitor_file_/MediaDock/videos/clip.mp4",
      element: "video",
      isObjectUrl: false,
    });
  });

  it("explains how to restore a missing device media file", async () => {
    readDeviceFile.mockResolvedValue(null);
    const open = vi.spyOn(window, "open");

    await expect(
      createHttpServices().fileSystem.openFile("library-1", "video.mp4"),
    ).rejects.toThrow(
      "This media file is not in the selected download folder. Use Download again to save it to your device.",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("requests a short-lived backend preview stream for analyzed media", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ticket: "encrypted-preview-ticket",
          title: "Preview title",
          element: "video",
          isHls: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const source = await createHttpServices().media.getPlaybackSource(
      "media-1",
      "video",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/media/media-1/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ kind: "video" }),
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
    expect(source).toEqual({
      url: "/api/v1/media/preview-stream/encrypted-preview-ticket",
      title: "Preview title",
      element: "video",
      isHls: false,
    });
  });

  it("streams a completed backend download to the device and releases the server copy", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    writeDeviceFile.mockResolvedValue("video.mp4");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "download-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ticket: "download-ticket" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("video bytes", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "saved" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().fileSystem.saveCompletedFile(
      "job-1",
      "video.mp4",
      "C:\\storage\\video.mp4",
      "./Video",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/download-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "C:\\storage\\video.mp4" }),
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/files/open/download-ticket",
    );
    expect(writeDeviceFile).toHaveBeenCalledWith(
      "job-1",
      "video.mp4",
      expect.any(ReadableStream),
      "./Video",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/downloads/job-1/device-saved",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ filename: "video.mp4" }),
      }),
    );
  });

  it("uses the browser download flow when folder selection is unavailable", async () => {
    getSupabaseSession.mockResolvedValue(null);
    getDownloadDirectoryName.mockResolvedValue(BROWSER_DOWNLOADS_MODE);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "browser-download-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await createHttpServices().fileSystem.saveCompletedFile(
      "job-1",
      "video.mp4",
      "C:\\storage\\video.mp4",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/download-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "C:\\storage\\video.mp4" }),
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(writeDeviceFile).not.toHaveBeenCalled();
  });

  it("streams native downloads into shared MediaDock storage before releasing the backend copy", async () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    getDownloadDirectoryName.mockResolvedValue(NATIVE_DOCUMENTS_MODE);
    getMediaDockRelativePath.mockReturnValue("MediaDock/videos/video.mp4");
    getMediaDockRelativeDirectory.mockReturnValue("videos");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ticket: "native-download-ticket" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "saved" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createHttpServices().fileSystem.saveCompletedFile(
      "job-1",
      "video.mp4",
      "C:\\storage\\video.mp4",
      "./Video",
    );

    expect(downloadToDownloads).toHaveBeenCalledWith({
      url: "/api/v1/files/open/native-download-ticket",
      filename: "video.mp4",
      relativeDirectory: "videos",
    });
    expect(downloadFile).not.toHaveBeenCalled();
    expect(makeDirectory).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/downloads/job-1/device-saved",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ filename: "MediaDock/videos/video.mp4" }),
      }),
    );
    expect(writeDeviceFile).not.toHaveBeenCalled();
  });

  it("keeps the backend file when the shared-storage download fails", async () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    getDownloadDirectoryName.mockResolvedValue(NATIVE_DOCUMENTS_MODE);
    getMediaDockRelativePath.mockReturnValue("MediaDock/videos/video.mp4");
    getMediaDockRelativeDirectory.mockReturnValue("videos");
    downloadToDownloads.mockRejectedValue(new Error("Storage write failed"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "native-download-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHttpServices().fileSystem.saveCompletedFile(
        "job-1",
        "video.mp4",
        "C:\\storage\\video.mp4",
      ),
    ).rejects.toThrow("Storage write failed");

    expect(downloadToDownloads).toHaveBeenCalledOnce();
    expect(downloadFile).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("downloads a file already stored in the selected device folder", async () => {
    const storedFile = new File(["media bytes"], "mix.mp3");
    readDeviceFile.mockResolvedValue(storedFile);
    const createObjectURL = vi.fn().mockReturnValue("blob:stored-media");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    vi.useFakeTimers();
    const clickedLinks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedLinks.push(this);
    });

    await createHttpServices().fileSystem.downloadFile(
      "lib-1",
      "Audio/Test DJ/mix.mp3",
    );
    vi.runOnlyPendingTimers();

    expect(readDeviceFile).toHaveBeenCalledWith("Audio/Test DJ/mix.mp3");
    expect(createObjectURL).toHaveBeenCalledWith(storedFile);
    expect(clickedLinks).toHaveLength(1);
    expect(clickedLinks[0]?.href).toBe("blob:stored-media");
    expect(clickedLinks[0]?.download).toBe("mix.mp3");
  });
});
