import { motion } from "motion/react";
import { ScanSearch } from "lucide-react";
import { Panel } from "@/components/layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const STEPS = ["Resolving link", "Reading metadata", "Listing streams"];

/** Skeleton of the preview shown while the analyzer runs. */
export default function AnalyzingState({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <Panel className="flex flex-col gap-5 p-5 md:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted md:w-[300px]">
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <ScanSearch className="size-8 text-primary/70" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex flex-col gap-2 pt-2">
            {STEPS.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                className="flex items-center gap-2 text-[13px] text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-accent" />
                {step}…
              </motion.div>
            ))}
          </div>
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
