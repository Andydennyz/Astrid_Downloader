import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useDownloads, type AppNotification } from "@/hooks/use-downloads.ts";
import { cn } from "@/lib/utils.ts";

const ICONS: Record<AppNotification["kind"], { icon: typeof Bell; className: string }> = {
  completed: { icon: CheckCircle2, className: "text-emerald-500" },
  failed: { icon: XCircle, className: "text-destructive" },
  info: { icon: Info, className: "text-accent" },
};

export default function NotificationsMenu() {
  const { notifications, unreadCount, markAllRead, dismissNotification, clearNotifications } = useDownloads();

  return (
    <Popover onOpenChange={(open) => !open && unreadCount > 0 && markAllRead()}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[340px] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {notifications.length > 0 && (
            <button type="button" onClick={clearNotifications} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You're all caught up.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const style = ICONS[n.kind];
              const Icon = style.icon;
              return (
                <div key={n.id} className={cn("group flex gap-3 rounded-lg p-2.5 hover:bg-muted/60", !n.read && "bg-primary/5")}>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", style.className)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{n.title}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                    <div className="pt-1 text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => dismissNotification(n.id)}
                    className="size-6 shrink-0 cursor-pointer rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                  >
                    <X className="mx-auto size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
