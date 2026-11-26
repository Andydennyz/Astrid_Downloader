import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type MediaDockStoragePlugin = {
  readClipboardText(): Promise<{ text: string }>;
  getInitialSharedText(): Promise<{ text: string }>;
  addListener(
    eventName: "sharedText",
    listener: (event: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  requestLegacyStoragePermission(): Promise<{ granted: boolean }>;
  requestDeviceMediaPermissions(): Promise<{
    granted: boolean;
    audioGranted: boolean;
    videoGranted: boolean;
    videoSelectedOnly: boolean;
  }>;
  listDeviceMedia(options: {
    kind: "all" | "audio" | "video";
    offset: number;
    limit: number;
  }): Promise<{
    items: Array<{
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
    }>;
    nextOffset: number;
    hasMore: boolean;
  }>;
  downloadToDownloads(options: {
    url: string;
    filename: string;
    relativeDirectory: string;
  }): Promise<{ path: string }>;
  getDownloadUri(options: {
    relativePath: string;
  }): Promise<{ uri: string }>;
  deleteFromDownloads(options: {
    relativePath: string;
  }): Promise<{ deleted: boolean }>;
};

const MediaDockStorage = registerPlugin<MediaDockStoragePlugin>("MediaDockStorage");

export async function readNativeClipboardText() {
  return (await MediaDockStorage.readClipboardText()).text;
}

export function getInitialSharedText() {
  return MediaDockStorage.getInitialSharedText();
}

export function addSharedTextListener(
  listener: (event: { text: string }) => void,
) {
  return MediaDockStorage.addListener("sharedText", listener);
}

export function requestLegacyStoragePermission() {
  return MediaDockStorage.requestLegacyStoragePermission();
}

export function requestDeviceMediaPermissions() {
  return MediaDockStorage.requestDeviceMediaPermissions();
}

export function listDeviceMedia(
  options: Parameters<MediaDockStoragePlugin["listDeviceMedia"]>[0],
) {
  return MediaDockStorage.listDeviceMedia(options);
}

export function downloadToDownloads(
  options: Parameters<MediaDockStoragePlugin["downloadToDownloads"]>[0],
) {
  return MediaDockStorage.downloadToDownloads(options);
}

export function getDownloadUri(
  options: Parameters<MediaDockStoragePlugin["getDownloadUri"]>[0],
) {
  return MediaDockStorage.getDownloadUri(options);
}

export function deleteFromDownloads(
  options: Parameters<MediaDockStoragePlugin["deleteFromDownloads"]>[0],
) {
  return MediaDockStorage.deleteFromDownloads(options);
}
