import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  SETTINGS_STORAGE_KEY,
} from "./settings-storage.ts";

describe("loadSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("migrates the former default download folder without changing custom folders", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        general: {
          ...DEFAULT_SETTINGS.general,
          downloadLocation: "~/Downloads/Astrid",
        },
      }),
    );
    expect(loadSettings().general.downloadLocation).toBe(
      "~/Downloads/MediaDock",
    );

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        general: {
          ...DEFAULT_SETTINGS.general,
          downloadLocation: "D:/My Media",
        },
      }),
    );
    expect(loadSettings().general.downloadLocation).toBe("D:/My Media");
  });
});
