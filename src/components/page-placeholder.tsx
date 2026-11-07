import type { ComponentType } from "react";
import { PageContainer, Panel } from "@/components/layout.tsx";

/** Temporary on-brand page body for sections that are still being built. */
export default function PagePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <PageContainer>
      <Panel className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="size-6" />
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="pt-1.5 text-sm text-balance text-muted-foreground">{description}</p>
        </div>
      </Panel>
    </PageContainer>
  );
}
