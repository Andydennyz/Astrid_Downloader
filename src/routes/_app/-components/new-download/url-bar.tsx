import { useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Link2, ScanSearch, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { PLATFORM_LABEL } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import { getServices } from "@/services/index.ts";
import { SAMPLE_LINKS } from "../../-lib/new-download.ts";

type UrlBarProps = {
  url: string;
  onUrlChange: (url: string) => void;
  onAnalyze: (url: string) => void;
  onClear: () => void;
  analyzing: boolean;
};

/** The large link field with paste, clear, analyze and live validation. */
export default function UrlBar({ url, onUrlChange, onAnalyze, onClear, analyzing }: UrlBarProps) {
  const [touched, setTouched] = useState(false);
  const validation = getServices().media.validateUrl(url);
  const showError = touched && !validation.valid && url.trim().length > 0;
  const showValid = validation.valid && !analyzing;

  const submit = (value: string) => {
    setTouched(true);
    if (!getServices().media.validateUrl(value).valid) return;
    onAnalyze(value);
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.info("Your clipboard is empty");
        return;
      }
      onUrlChange(text);
      submit(text);
    } catch {
      toast.error("Clipboard access was blocked", { description: "Click the field and press Ctrl+V or Cmd+V instead." });
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(url);
      }}
      className="flex flex-col gap-3"
    >
      <div
        className={cn(
          "group relative flex flex-col gap-2 rounded-2xl border bg-card/80 p-2 shadow-[0_1px_0_0_inset] shadow-white/[0.04] backdrop-blur-sm transition-[border-color,box-shadow] sm:flex-row sm:items-center",
          "focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15",
          showError && "border-destructive/60 focus-within:border-destructive/60 focus-within:ring-destructive/15",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pl-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary transition-colors",
              showError && "bg-destructive/12 text-destructive",
              showValid && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {showError ? <AlertCircle className="size-4" /> : showValid ? <CheckCircle2 className="size-4" /> : <Link2 className="size-4" />}
          </span>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            disabled={analyzing}
            onChange={(e) => onUrlChange(e.target.value)}
            onBlur={() => setTouched(url.trim().length > 0)}
            placeholder="Paste a video or audio link, e.g. https://youtube.com/watch?v=…"
            aria-label="Media link"
            aria-invalid={showError}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          {url && !analyzing && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear link"
              onClick={() => {
                setTouched(false);
                onClear();
              }}
            >
              <X />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" className="h-11 flex-1 gap-2 px-4 sm:flex-none" onClick={() => void paste()} disabled={analyzing}>
            <ClipboardPaste />
            Paste
          </Button>
          <Button type="submit" className="h-11 flex-1 gap-2 px-5 sm:flex-none" disabled={analyzing || !url.trim()}>
            {analyzing ? <Spinner /> : <ScanSearch />}
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-[13px]">
        {showError && !validation.valid ? (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-destructive">
            {validation.reason}
          </motion.p>
        ) : validation.valid ? (
          <p className="text-muted-foreground">
            Detected <span className="font-medium text-foreground">{PLATFORM_LABEL[validation.platform]}</span> link
            {validation.platform === "other" && " (generic site support)"}
          </p>
        ) : (
          <p className="text-muted-foreground">Press Enter to analyze. Links without https:// work too.</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {SAMPLE_LINKS.map((sample) => (
            <button
              key={sample.url}
              type="button"
              disabled={analyzing}
              onClick={() => {
                onUrlChange(sample.url);
                submit(sample.url);
              }}
              className="cursor-pointer rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
