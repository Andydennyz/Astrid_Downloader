import type { HistoryEntry, LibraryItem } from "@/services/types.ts";
import { seedHistory, seedLibrary } from "./data.ts";

/**
 * In-memory state shared by the mock services, standing in for the backend's
 * persistence. It resets on page reload.
 */

type Listener = () => void;

function createChannel() {
  const listeners = new Set<Listener>();
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
}

const library = seedLibrary();

export const mockDb = {
  library,
  history: seedHistory(library),
  libraryChanged: createChannel(),
  historyChanged: createChannel(),

  addLibraryItem(item: LibraryItem) {
    this.library.unshift(item);
    this.libraryChanged.emit();
  },
  removeLibraryItem(id: string) {
    this.library = this.library.filter((item) => item.id !== id);
    this.libraryChanged.emit();
  },
  addHistory(entry: HistoryEntry) {
    this.history.unshift(entry);
    this.historyChanged.emit();
  },
  removeHistory(id: string) {
    this.history = this.history.filter((entry) => entry.id !== id);
    this.historyChanged.emit();
  },
  clearHistory() {
    this.history = [];
    this.historyChanged.emit();
  },
};

/** Simulated network latency. */
export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

let counter = 0;
export function makeId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}`;
}
