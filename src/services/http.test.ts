import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getSupabaseSession,
  getGuestToken,
  getDownloadDirectoryName,
  readDeviceFile,
  writeDeviceFile,
} = vi.hoisted(() => ({
  getSupabaseSession: vi.fn(),
  getGuestToken: vi.fn(),
  getDownloadDirectoryName: vi.fn(),
  readDeviceFile: vi.fn(),
  writeDeviceFile: vi.fn(),
}));

vi.mock("../lib/supabase.ts", () => ({ getSupabaseSession }));
vi.mock("../lib/guest.ts", () => ({ getGuestToken }));
vi.mock("./device-storage.ts", () => ({
  BROWSER_DOWNLOADS_MODE: "browser-downloads",
  chooseDownloadDirectory: vi.fn(),
  getDownloadDirectoryName,
  readDeviceFile,
  removeDeviceFile: vi.fn(),
  writeDeviceFile,
}));

import { createHttpServices } from "./http.ts";
import { BROWSER_DOWNLOADS_MODE } from "./device-storage.ts";

describe("HTTP service authentication", () => {
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

  it("uses separate inline and attachment tickets for a server media player", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const close = vi.fn();
    const previewDocument = document.implementation.createHTMLDocument();
    const preview = Object.create(window) as Window;
    Object.defineProperties(preview, {
      document: { value: previewDocument, configurable: true },
      close: { value: close, configurable: true },
    });
    vi.spyOn(window, "open").mockReturnValue(preview);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ticket: "signed-ticket" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ticket: "download-ticket" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const path = "C:\\storage\\video.mp4";

    await createHttpServices().fileSystem.openFile("library-1", "video.mp4", path);

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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/download-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    );
    const video = previewDocument.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/api/v1/files/open/signed-ticket");
    expect(video?.hasAttribute("controls")).toBe(true);
    const download = previewDocument.querySelector("a");
    expect(download?.getAttribute("href")).toBe(
      "/api/v1/files/open/download-ticket",
    );
    expect(download?.hasAttribute("download")).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it("opens a device video in a player with a video MIME type", async () => {
    readDeviceFile.mockResolvedValue(new File(["video"], "video.mp4"));
    const createObjectURL = vi.fn().mockReturnValue("blob:device-video");
    vi.stubGlobal("URL", { createObjectURL });
    const previewDocument = document.implementation.createHTMLDocument();
    const preview = Object.create(window) as Window;
    Object.defineProperties(preview, {
      document: { value: previewDocument, configurable: true },
      close: { value: vi.fn(), configurable: true },
      addEventListener: { value: vi.fn(), configurable: true },
    });
    vi.spyOn(window, "open").mockReturnValue(preview);

    await createHttpServices().fileSystem.openFile("library-1", "video.mp4");

    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "video/mp4" }),
    );
    expect(previewDocument.querySelector("video")?.getAttribute("src")).toBe(
      "blob:device-video",
    );
  });

  it("explains how to restore a missing device media file", async () => {
    readDeviceFile.mockResolvedValue(null);
    const close = vi.fn();
    const preview = Object.create(window) as Window;
    Object.defineProperties(preview, {
      document: {
        value: document.implementation.createHTMLDocument(),
        configurable: true,
      },
      close: { value: close, configurable: true },
    });
    vi.spyOn(window, "open").mockReturnValue(preview);

    await expect(
      createHttpServices().fileSystem.openFile("library-1", "video.mp4"),
    ).rejects.toThrow(
      "This media file is not in the selected download folder. Use Download again to save it to your device.",
    );
    expect(close).toHaveBeenCalledOnce();
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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedLinks.push(this);
      },
    );

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
