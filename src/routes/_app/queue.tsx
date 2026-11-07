import { createFileRoute } from "@tanstack/react-router";
import { ListOrdered } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/queue")({
  head: () => ({ meta: [{ title: "Download Queue · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={ListOrdered}
      title="Your live download queue"
      description="Track progress, speed and time remaining, and pause, resume, cancel or retry any download."
    />
  );
}
