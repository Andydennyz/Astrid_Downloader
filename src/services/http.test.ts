import { afterEach, describe, expect, it, vi } from "vitest";

const { getSupabaseSession } = vi.hoisted(() => ({
  getSupabaseSession: vi.fn(),
}));

vi.mock("../lib/supabase.ts", () => ({ getSupabaseSession }));

import { createHttpServices } from "./http.ts";

describe("HTTP service authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
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

  it("explains that the user needs to sign in when the API rejects a missing session", async () => {
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
      "Your sign-in session is missing or expired. Sign in, then try again.",
    );
  });

  it("explains how to recover when the backend cannot be reached", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

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

    await expect(createHttpServices().downloads.getProgress("deleted-job")).resolves.toBeNull();
  });

  it("preserves validation errors as invalid-URL service errors", async () => {
    getSupabaseSession.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "A valid absolute HTTP or HTTPS media URL is required." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(createHttpServices().media.analyze("ftp://example.com/media")).rejects.toMatchObject({
      code: "INVALID_URL",
    });
  });

  it("opens a backend-stored media file using an authenticated streaming ticket", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const replace = vi.fn();
    const close = vi.fn();
    const preview = Object.create(window) as Window;
    Object.defineProperties(preview, {
      location: { value: { replace }, configurable: true },
      close: { value: close, configurable: true },
    });
    vi.spyOn(window, "open").mockReturnValue(preview);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "signed-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const path = "C:\\storage\\video.mp4";

    await createHttpServices().fileSystem.openFile(path);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/open-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path }),
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
    expect(replace).toHaveBeenCalledWith("/api/v1/files/open/signed-ticket");
    expect(close).not.toHaveBeenCalled();
  });

  it("downloads a backend-stored media file to the device using an authenticated ticket", async () => {
    getSupabaseSession.mockResolvedValue({ access_token: "test-access-token" });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[download=""]');
      expect(link?.href).toBe(`${window.location.origin}/api/v1/files/open/download-ticket`);
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: "download-ticket" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const path = "C:\\storage\\video.mp4";

    await createHttpServices().fileSystem.saveFileToDevice(path);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/download-session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path }),
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
    expect(click).toHaveBeenCalledOnce();
  });
});
