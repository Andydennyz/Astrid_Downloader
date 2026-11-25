import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

const { listDeviceMedia, requestDeviceMediaPermissions } = vi.hoisted(() => ({
  listDeviceMedia: vi.fn(),
  requestDeviceMediaPermissions: vi.fn(),
}));

vi.mock("./native-storage.ts", () => ({
  listDeviceMedia,
  requestDeviceMediaPermissions,
}));

import {
  listDeviceMedia as loadDeviceMedia,
  requestDeviceMediaAccess,
} from "./device-media.ts";

describe("device media adapter", () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    vi.spyOn(Capacitor, "convertFileSrc").mockImplementation(
      (uri) => `webview:${uri}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("requests only the native library access state", async () => {
    const permissions = {
      granted: true,
      audioGranted: true,
      videoGranted: true,
      videoSelectedOnly: false,
    };
    requestDeviceMediaPermissions.mockResolvedValue(permissions);

    await expect(requestDeviceMediaAccess()).resolves.toEqual(permissions);
    expect(requestDeviceMediaPermissions).toHaveBeenCalledOnce();
  });

  it("converts MediaStore content URIs for in-app playback", async () => {
    listDeviceMedia.mockResolvedValue({
      items: [
        {
          id: "video:42",
          kind: "video",
          title: "Phone video",
          creator: "On this device",
          filename: "clip.mp4",
          uri: "content://media/external/video/media/42",
          thumbnailUrl: "data:image/jpeg;base64,abc",
          mimeType: "video/mp4",
          durationSec: 30,
          sizeBytes: 1200,
          dateAdded: 1_767_225_600_000,
        },
      ],
      nextOffset: 30,
      hasMore: false,
    });

    const page = await loadDeviceMedia({ kind: "video", offset: 0 });

    expect(listDeviceMedia).toHaveBeenCalledWith({
      kind: "video",
      offset: 0,
      limit: 30,
    });
    expect(page.items[0]?.uri).toBe(
      "webview:content://media/external/video/media/42",
    );
    expect(page.items[0]?.thumbnailUrl).toBe("data:image/jpeg;base64,abc");
  });

  it("refuses to access a phone media library from the web app", async () => {
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");

    await expect(requestDeviceMediaAccess()).rejects.toThrow(
      "The device media library is currently available in the Android app.",
    );
    expect(requestDeviceMediaPermissions).not.toHaveBeenCalled();
  });
});
