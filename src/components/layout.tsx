import { cn } from "@/lib/utils.ts";

/** Standard page padding and max width inside the app shell. */
export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] min-w-0 px-4 py-6 md:px-8 md:py-8", className)}>{children}</div>
  );
}

/** Glass-like surface used for panels across the app. */
export function Panel({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/70 shadow-[0_1px_0_0_inset] shadow-white/[0.04] backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="pt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
