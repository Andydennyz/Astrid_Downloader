import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import PagePlaceholder from "@/components/page-placeholder.tsx";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  return (
    <PagePlaceholder
      icon={Settings}
      title="Make Astrid yours"
      description="Default formats, download behaviour, appearance and advanced options, saved on this device."
    />
  );
}
