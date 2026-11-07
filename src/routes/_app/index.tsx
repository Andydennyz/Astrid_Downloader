import { useState } from "react";
import { Link, createFileRoute, useHydrated } from "@tanstack/react-router";
import { ArrowRight, Link2 } from "lucide-react";
import { PageContainer } from "@/components/layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useHistory, useOverview } from "@/hooks/use-media-data.ts";
import ActiveNow from "./-components/active-now.tsx";
import ActivityChart, { type RangeDays } from "./-components/activity-chart.tsx";
import RecentDownloads from "./-components/recent-downloads.tsx";
import StatsGrid from "./-components/stats-grid.tsx";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Overview · Astrid Downloader" }] }),
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

function OverviewPage() {
  const [range, setRange] = useState<RangeDays>("14");
  const { data: stats } = useOverview(Number(range));
  const { data: history } = useHistory();

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Greeting />
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">Here's what's happening with your downloads</h2>
        </div>
        <Button nativeButton={false} render={<Link to="/new" />} className="h-10 gap-2 px-4">
          <Link2 />
          Paste a link
          <ArrowRight className="opacity-60" />
        </Button>
      </div>
      <StatsGrid stats={stats} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ActivityChart data={stats?.activity} range={range} onRangeChange={setRange} />
        </div>
        <ActiveNow />
      </div>
      <RecentDownloads entries={history?.slice(0, 7)} />
    </PageContainer>
  );
}
