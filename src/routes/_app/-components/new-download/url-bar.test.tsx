import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clipboardReadText, clipboardReadSupportedUrl, validateUrl, toastInfo } =
  vi.hoisted(() => ({
    clipboardReadText: vi.fn(),
    clipboardReadSupportedUrl: vi.fn(),
    validateUrl: vi.fn(),
    toastInfo: vi.fn(),
  }));

vi.mock("@/services/index.ts", () => ({
  getServices: () => ({
    clipboard: {
      readText: clipboardReadText,
      readSupportedUrl: clipboardReadSupportedUrl,
    },
    media: { validateUrl },
  }),
}));

vi.mock("sonner", () => ({
  toast: { info: toastInfo, error: vi.fn() },
}));

import UrlBar from "./url-bar.tsx";

beforeEach(() => {
  vi.clearAllMocks();
  validateUrl.mockReturnValue({
    valid: false,
    reason: "Enter a supported URL.",
  });
  clipboardReadText.mockRejectedValue(
    new Error("Automatic clipboard reading is unavailable here."),
  );
});

describe("UrlBar clipboard fallback", () => {
  it("focuses the link field and explains how to paste manually", async () => {
    render(
      <UrlBar
        url=""
        onUrlChange={vi.fn()}
        onAnalyze={vi.fn()}
        onClear={vi.fn()}
        analyzing={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Paste" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Media link" })).toHaveFocus();
    });
    expect(toastInfo).toHaveBeenCalledWith(
      "Automatic clipboard reading is unavailable here.",
      {
        description: "Use your device’s Paste command in the focused link field.",
      },
    );
  });
});
