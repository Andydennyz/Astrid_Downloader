import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/completed")({
  head: () => ({ meta: [{ title: "Completed Downloads · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={CheckCircle2}
      title="Your media library"
      description="Browse every finished download in grid or list view, then open, reveal or copy file locations."
    />
  );
}
