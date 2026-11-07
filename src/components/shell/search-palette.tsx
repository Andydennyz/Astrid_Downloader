import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, AudioLines, Film, Link2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command.tsx";
import { Command } from "@/components/ui/command.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { ALL_NAV } from "@/lib/navigation.ts";
import { getServices, type LibraryItem } from "@/services/index.ts";

/** Global command palette: jump to pages, library items and queued jobs. */
export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const { jobs } = useDownloads();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setOpen(true);
    void getServices().library.list().then(setLibrary);
  };

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex h-9 w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-lg border bg-card/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search downloads, library, pages…</span>
        <Kbd className="hidden md:inline-flex">⌘K</Kbd>
      </button>
      <CommandDialog open={open} onOpenChange={(o) => (o ? openPalette() : setOpen(false))} title="Search" className="sm:max-w-xl">
        <Command>
          <CommandInput placeholder="Search downloads, library, pages…" />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {ALL_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.to} value={`page ${item.label}`} onSelect={() => go(() => void navigate({ to: item.to }))}>
                    <Icon />
                    {item.label}
                    <CommandShortcut>
                      <ArrowRight className="size-3.5" />
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {jobs.length > 0 && (
              <CommandGroup heading="Queue">
                {jobs.slice(0, 6).map((job) => (
                  <CommandItem key={job.id} value={`queue ${job.request.title} ${job.request.creator}`} onSelect={() => go(() => void navigate({ to: "/queue" }))}>
                    <Link2 />
                    <span className="truncate">{job.request.title}</span>
                    <CommandShortcut className="tracking-normal">{Math.round(job.progress * 100)}%</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {library.length > 0 && (
              <CommandGroup heading="Library">
                {library.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`library ${item.title} ${item.creator} ${item.filename}`}
                    onSelect={() => go(() => void navigate({ to: item.kind === "audio" ? "/audio" : "/video" }))}
                  >
                    {item.kind === "audio" ? <AudioLines /> : <Film />}
                    <span className="truncate">{item.title}</span>
                    <CommandShortcut className="tracking-normal">{item.extension.toUpperCase()}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
