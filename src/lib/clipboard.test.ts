import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboardText } from "./clipboard.ts";

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  "execCommand",
);

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("writeClipboardText", () => {
  it("uses the browser clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await writeClipboardText("https://example.com/video");

    expect(writeText).toHaveBeenCalledWith("https://example.com/video");
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("copies through the selected text fallback when the clipboard API is unavailable", async () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await writeClipboardText("https://example.com/video");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports when both clipboard methods are unavailable", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });

    await expect(writeClipboardText("text")).rejects.toThrow(
      "Clipboard writing is unavailable in this browser.",
    );
    expect(document.querySelector("textarea")).toBeNull();
  });
});
