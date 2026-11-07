import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/video")({
  head: () => ({ meta: [{ title: "Video Downloads · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={Clapperboard}
      title="Your video collection"
      description="Films, talks and clips organised by resolution, duration and file format."
    />
  );
}
