import { AlertCircle } from "lucide-react";
import { errorMessage } from "@/services/errors.ts";
import { Button } from "@/components/ui/button.tsx";

export default function DataLoadError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Could not load this data</p>
          <p className="break-words text-sm text-muted-foreground">
            {errorMessage(error, "Try again in a moment.")}
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
