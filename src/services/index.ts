import type { AppServices } from "./contracts.ts";
import { createHttpServices } from "./http.ts";

/**
 * The single place that decides which implementation the app uses.
 */
function createServices(): AppServices {
  return createHttpServices();
}

let instance: AppServices | null = null;

/** Lazily created so the mock engine only runs in the browser. */
export function getServices(): AppServices {
  instance ??= createServices();
  return instance;
}

export type * from "./contracts.ts";
export type * from "./types.ts";
