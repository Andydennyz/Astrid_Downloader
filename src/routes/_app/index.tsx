import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useHydrated } from "@tanstack/react-router";
import { ArrowRight, Link2, TriangleAlert } from "lucide-react";
import { PageContainer, Panel, PanelHeader } from "@/components/layout.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useHistory, useOverview } from "@/hooks/use-media-data.ts";
import type { ActivityPoint } from "@/services/types.ts";
import ActiveNow from "./-components/active-now.tsx";
import type { RangeDays } from "./-components/activity-chart.tsx";
import RecentDownloads from "./-components/recent-downloads.tsx";
import StatsGrid from "./-components/stats-grid.tsx";

const ActivityChart = lazy(() => import("./-components/activity-chart.tsx"));

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Overview · MediaDock" }] }),
  component: OverviewPage,
});

function Greeting() {
  // Time-of-day greeting only after hydration so server and client HTML match.
  const hydrated = useHydrated();
  if (!hydrated) return <>Welcome back</>;
  const h = new Date().getHours();
  if (h < 5) return <>Working late</>;
  if (h < 12) return <>Good morning</>;
  if (h < 18) return <>Good afternoon</>;
  return <>Good evening</>;
}

function ActivityChartFallback() {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Download activity"
        description="Completed downloads per day"
      />
      <div className="px-2 pb-3">
        <Skeleton className="mx-3 my-2 h-[240px]" />
      </div>
    </Panel>
  );
}

function DeferredActivityChart({
  data,
  range,
  onRangeChange,
}: {
  data: ActivityPoint[] | undefined;
  range: RangeDays;
  onRangeChange: (range: RangeDays) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = setTimeout(() => setShouldLoad(true), 0);
      return () => clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observerRef.current = observer;
    observer.observe(container);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <Suspense fallback={<ActivityChartFallback />}>
          <ActivityChart
            data={data}
            range={range}
            onRangeChange={onRangeChange}
          />
        </Suspense>
      ) : (
        <ActivityChartFallback />
      )}
    </div>
  );
}

function OverviewPage() {
  const [range, setRange] = useState<RangeDays>("14");
  const overviewQuery = useOverview(Number(range));
  const historyQuery = useHistory();
  const stats = overviewQuery.data;
  const history = historyQuery.data;

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Greeting />
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">
            Here's what's happening with your downloads
          </h2>
        </div>
        <Button
          nativeButton={false}
          render={<Link to="/new" />}
          className="h-10 gap-2 px-4"
        >
          <Link2 />
          Paste a link
          <ArrowRight className="opacity-60" />
        </Button>
      </div>
      <Alert className="items-start border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
        <TriangleAlert className="mt-0.5" />
        <div>
          <AlertTitle className="text-base">
            MediaDock is Temporarily Unavailable
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-3">
            <p className="font-medium text-foreground">
              We're making some improvements!
            </p>
            <p>
              MediaDock is currently undergoing backend maintenance as we work
              on infrastructure improvements and system upgrades to deliver a
              faster, more reliable experience.
            </p>
            <p>
              During this period, some features and services may be temporarily
              unavailable.
            </p>
            <div>
              <p className="mb-1 font-medium text-foreground">
                What's happening?
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Backend infrastructure upgrades.</li>
                <li>API service maintenance.</li>
                <li>Performance and reliability improvements.</li>
              </ul>
            </div>
            <p>
              <strong className="text-foreground">Your data matters.</strong>{" "}
              Your existing account information and stored data remain
              unaffected by this maintenance.
            </p>
            <p>
              We apologize for the inconvenience and appreciate your patience
              while we work behind the scenes.
            </p>
            <p>
              We'll be back soon!
              <br />— The MediaDock Team
            </p>
            <p>Thank you for being part of MediaDock.</p>
          </AlertDescription>
        </div>
      </Alert>
      {overviewQuery.isError && (
        <DataLoadError
          error={overviewQuery.error}
          onRetry={() => void overviewQuery.refetch()}
        />
      )}
      {historyQuery.isError && (
        <DataLoadError
          error={historyQuery.error}
          onRetry={() => void historyQuery.refetch()}
        />
      )}
      <StatsGrid stats={stats} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <DeferredActivityChart
            data={stats?.activity}
            range={range}
            onRangeChange={setRange}
          />
        </div>
        <ActiveNow />
      </div>
      {!historyQuery.isError && (
        <RecentDownloads entries={history?.slice(0, 7)} />
      )}
    </PageContainer>
  );
}
