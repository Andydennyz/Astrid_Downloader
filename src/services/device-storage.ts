import { ServiceError } from "./errors.ts";

const DATABASE_NAME = "astrid-device-files";
const DATABASE_VERSION = 1;
const HANDLE_STORE = "handles";
const SAVED_STORE = "saved-files";
const DIRECTORY_KEY = "download-directory";
export const BROWSER_DOWNLOADS_MODE = "browser-downloads";

type BrowserDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<BrowserDirectoryHandle>;
};

type SavedFileRecord = {
  filename: string;
  directory: BrowserDirectoryHandle;
};

function pathSegments(path: string): string[] {
  const segments = path.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
  if (
    path.startsWith("/") ||
    segments.some((part) => part === ".." || part.includes(":"))
  ) {
    throw new ServiceError("INVALID_STATE", "The media path is not a safe relative path.");
  }
  return segments;
}

async function getParentDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  create: boolean,
): Promise<{ directory: FileSystemDirectoryHandle; filename: string }> {
  const segments = pathSegments(relativePath);
  const filename = segments.pop();
  if (!filename) {
    throw new ServiceError("INVALID_STATE", "The media filename is empty.");
  }
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create });
  }
  return { directory, filename };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new ServiceError("UNAVAILABLE", "This browser cannot remember a selected folder."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE);
      }
      if (!database.objectStoreNames.contains(SAVED_STORE)) {
        database.createObjectStore(SAVED_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open device file storage."));
  });
}

async function readValue<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read device file storage."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

async function writeValue(storeName: string, key: IDBValidKey, value: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save device file storage."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save device file storage."));
    };
  });
}

async function removeValue(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not update device file storage."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not update device file storage."));
    };
  });
}

async function getDirectory(requestPermission: boolean): Promise<BrowserDirectoryHandle> {
  const directory = await readValue<BrowserDirectoryHandle>(HANDLE_STORE, DIRECTORY_KEY);
  if (!directory) {
    throw new ServiceError(
      "INVALID_STATE",
      "Choose a download folder in Settings before downloading.",
    );
  }

  let permission = await directory.queryPermission({ mode: "readwrite" });
  if (permission !== "granted" && requestPermission) {
    permission = await directory.requestPermission({ mode: "readwrite" });
  }
  if (permission !== "granted") {
    throw new ServiceError(
      "INVALID_STATE",
      "Reauthorize the selected download folder in Settings to let MediaDock save files.",
    );
  }
  return directory;
}

export async function getDownloadDirectoryName(): Promise<string | null> {
  if (
    typeof window !== "undefined" &&
    (!window.isSecureContext ||
      typeof (window as DirectoryPickerWindow).showDirectoryPicker !== "function")
  ) {
    return BROWSER_DOWNLOADS_MODE;
  }
  const directory = await readValue<BrowserDirectoryHandle>(HANDLE_STORE, DIRECTORY_KEY);
  return directory?.name ?? null;
}

export async function chooseDownloadDirectory(): Promise<string | null> {
  if (typeof window === "undefined") {
    throw new ServiceError(
      "UNAVAILABLE",
      "Folders can only be selected in a secure browser context.",
    );
  }
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!window.isSecureContext || !picker) {
    window.dispatchEvent(new Event("astrid:device-folder-changed"));
    return BROWSER_DOWNLOADS_MODE;
  }
  try {
    const directory = await picker.call(window, { mode: "readwrite" });
    const permission = await directory.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      throw new ServiceError(
        "INVALID_STATE",
        "MediaDock needs write access to the selected folder to save and remove downloads.",
      );
    }
    await writeValue(HANDLE_STORE, DIRECTORY_KEY, directory);
    window.dispatchEvent(new Event("astrid:device-folder-changed"));
    return directory.name;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export async function writeDeviceFile(
  jobId: string,
  filename: string,
  body: ReadableStream<Uint8Array> | null,
  destination = "",
): Promise<string> {
  const directory = await getDirectory(false);
  const destinationSegments = pathSegments(destination).slice(0, 2);
  const creatorIndex =
    destinationSegments[0] === "Audio" || destinationSegments[0] === "Video"
      ? 1
      : 0;
  if (destinationSegments[creatorIndex]) {
    destinationSegments[creatorIndex] = destinationSegments[creatorIndex].slice(0, 40);
  }
  const relativePath = [...destinationSegments, ...pathSegments(filename)].join("/");
  if (relativePath.length > 255) {
    throw new ServiceError(
      "INVALID_STATE",
      "The media path is too long for the selected folder structure.",
    );
  }
  const saved = await readValue<SavedFileRecord>(SAVED_STORE, jobId);
  if (saved && await directory.isSameEntry(saved.directory)) return saved.filename;
  if (!body) {
    throw new ServiceError("UNAVAILABLE", "The backend did not provide a media file stream.");
  }

  const parent = await getParentDirectory(directory, relativePath, true);
  const fileHandle = await parent.directory.getFileHandle(parent.filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await body.pipeTo(writable);
  } catch (error) {
    await parent.directory.removeEntry(parent.filename).catch((removeError: unknown) => {
      if (!(removeError instanceof DOMException && removeError.name === "NotFoundError")) {
        throw removeError;
      }
    });
    throw error;
  }

  await writeValue(SAVED_STORE, jobId, { filename: relativePath, directory } satisfies SavedFileRecord);
  return relativePath;
}

export async function removeDeviceFile(
  libraryId: string,
  filename: string,
): Promise<void> {
  const directory = await getDirectory(false);
  const parent = await getParentDirectory(directory, filename, false);
  try {
    await parent.directory.removeEntry(parent.filename);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
  if (libraryId.startsWith("lib_")) {
    await removeValue(SAVED_STORE, libraryId.slice(4));
  }
}

export async function readDeviceFile(filename: string): Promise<File | null> {
  try {
    const directory = await getDirectory(false);
    const parent = await getParentDirectory(directory, filename, false);
    const fileHandle = await parent.directory.getFileHandle(parent.filename);
    return await fileHandle.getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}
