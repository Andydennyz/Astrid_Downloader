import { createFileRoute } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/audio")({
  head: () => ({ meta: [{ title: "Audio Downloads · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={AudioLines}
      title="Your audio collection"
      description="Tracks, mixes and podcasts with album art, artists, formats and file sizes."
    />
  );
}
