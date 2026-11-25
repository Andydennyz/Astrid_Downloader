import { Capacitor } from "@capacitor/core";
import {
  listDeviceMedia as listNativeDeviceMedia,
  requestDeviceMediaPermissions,
} from "./native-storage.ts";
import { ServiceError } from "./errors.ts";

export type DeviceMediaKind = "all" | "audio" | "video";

export type DeviceMediaItem = {
  id: string;
  kind: "audio" | "video";
  title: string;
  creator: string;
  filename: string;
  uri: string;
  thumbnailUrl: string;
  mimeType: string;
  durationSec: number;
  sizeBytes: number;
  dateAdded: number;
};

export type DeviceMediaAccess = {
  granted: boolean;
  audioGranted: boolean;
  videoGranted: boolean;
  videoSelectedOnly: boolean;
};

export async function requestDeviceMediaAccess(): Promise<DeviceMediaAccess> {
  if (Capacitor.getPlatform() !== "android") {
    throw new ServiceError(
      "UNAVAILABLE",
      "The device media library is currently available in the Android app.",
    );
  }
  return requestDeviceMediaPermissions();
}

export async function listDeviceMedia(options: {
  kind: DeviceMediaKind;
  offset: number;
  limit?: number;
}) {
  if (Capacitor.getPlatform() !== "android") {
    throw new ServiceError(
      "UNAVAILABLE",
      "The device media library is currently available in the Android app.",
    );
  }
  const page = await listNativeDeviceMedia({
    kind: options.kind,
    offset: options.offset,
    limit: options.limit ?? 30,
  });
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      uri: Capacitor.convertFileSrc(item.uri),
    })),
  };
}
