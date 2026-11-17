import { Grid2x2, List } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export type ViewMode = "grid" | "list";

export default function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Card layout"
      className="flex gap-1 rounded-full border border-border bg-card/70 p-1"
    >
      <Button
        type="button"
        variant={value === "grid" ? "default" : "ghost"}
        size="icon-sm"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
      >
        <Grid2x2 className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "default" : "ghost"}
        size="icon-sm"
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-3.5" />
      </Button>
    </div>
  );
}
