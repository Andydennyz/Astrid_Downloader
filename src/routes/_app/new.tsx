import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { PageContainer } from "@/components/layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useSettings } from "@/hooks/use-media-data.ts";
import AnalyzingState from "./-components/new-download/analyzing-state.tsx";
import DownloadComposer from "./-components/new-download/download-composer.tsx";
import IdleState from "./-components/new-download/idle-state.tsx";
import UrlBar from "./-components/new-download/url-bar.tsx";
import { useAnalyzer } from "./-hooks/use-analyzer.ts";

export const Route = createFileRoute("/_app/new")({
  validateSearch: z.object({
    url: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "New Download · Astrid Downloader" }] }),
  component: NewDownloadPage,
});

function NewDownloadPage() {
  const search = Route.useSearch();
  const [url, setUrl] = useState(search.url ?? "");
  const { state, analyze, reset } = useAnalyzer();
  const { data: settings } = useSettings();
  const autoRan = useRef(false);

  // A link passed in the address (e.g. "?url=...") is analyzed once on arrival.
  useEffect(() => {
    if (autoRan.current || !search.url) return;
    autoRan.current = true;
    void analyze(search.url);
  }, [analyze, search.url]);

  const clear = () => {
    setUrl("");
    reset();
  };

  return (
    <PageContainer className="flex max-w-[1240px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">What would you like to download?</h2>
        <p className="text-sm text-muted-foreground">Paste a link from YouTube, Vimeo, SoundCloud, Twitch, Bandcamp and more.</p>
      </div>

      <UrlBar
        url={url}
        onUrlChange={(next) => {
          setUrl(next);
          if (state.status === "error") reset();
        }}
        onAnalyze={(next) => void analyze(next)}
        onClear={clear}
        analyzing={state.status === "analyzing"}
      />

      {state.status === "idle" && <IdleState />}
      {state.status === "analyzing" && <AnalyzingState url={state.url} />}
      {state.status === "error" && (
        <ErrorState className="border-destructive/30 bg-destructive/[0.03]">
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <ShieldAlert />
            </ErrorStateMedia>
            <ErrorStateTitle>We couldn't analyze this link</ErrorStateTitle>
            <ErrorStateDescription>{state.message}</ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent className="flex-row justify-center">
            <Button className="gap-2" onClick={() => void analyze(state.url)}>
              <RotateCcw />
              Try again
            </Button>
            <Button variant="ghost" onClick={clear}>
              Use another link
            </Button>
          </ErrorStateContent>
        </ErrorState>
      )}
      {state.status === "ready" &&
        (settings ? (
          <DownloadComposer key={state.info.id} info={state.info} settings={settings} onDone={clear} />
        ) : (
          <Skeleton className="h-96 rounded-2xl" />
        ))}
    </PageContainer>
  );
}
