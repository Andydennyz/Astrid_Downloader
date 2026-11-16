import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MediaInfo } from "@/services/index.ts";
import MediaPreview from "./media-preview.tsx";

describe("MediaPreview", () => {
  it("renders metadata when uploadedAt is a Unix timestamp string", () => {
    const info: MediaInfo = {
      id: "media-1",
      sourceUrl: "https://youtu.be/example",
      platform: "youtube",
      title: "Example video",
      creator: "Example creator",
      durationSec: 42,
      thumbnailUrl: "",
      uploadedAt: "1767225600",
      formats: [{ formatId: "18", kind: "muxed", container: "mp4" }],
    };

    render(<MediaPreview info={info} />);

    expect(screen.getByText("Example video")).toBeInTheDocument();
    expect(screen.getByText("1 streams")).toBeInTheDocument();
  });
});
