import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/history")({
  head: () => ({ meta: [{ title: "Download History · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={History}
      title="Every download, recorded"
      description="Search completed, failed and cancelled downloads, with original links and chosen formats."
    />
  );
}
