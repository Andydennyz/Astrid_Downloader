import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "motion/react";
import { HardDrive, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { NAV_SECTIONS, SETTINGS_NAV, type NavItem } from "@/lib/navigation.ts";
import { cn } from "@/lib/utils.ts";

function NavLink({
  item,
  collapsed,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-200 hover:-translate-x-0.5 hover:bg-sidebar-accent/80",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className={cn("size-[17px] shrink-0 transition-colors", active ? "text-primary" : "group-hover:text-sidebar-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums",
            collapsed ? "absolute top-0.5 right-0.5 h-3.5 min-w-3.5 text-[9px]" : "ml-auto",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { activeCount } = useDownloads();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          {!collapsed ? (
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/40 uppercase">
              {section.label}
            </div>
          ) : (
            <div className="mx-auto mb-1.5 h-px w-5 bg-sidebar-border" />
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              active={isActive(item.to)}
              badge={item.to === "/queue" ? activeCount : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-0.5">
        <NavLink item={SETTINGS_NAV} collapsed={collapsed} active={isActive(SETTINGS_NAV.to)} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function StorageMeter({ collapsed }: { collapsed: boolean }) {
  // Demo disk figures; the filesystem bridge would report real free space.
  const used = 0.62;
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="mx-auto grid size-9 place-items-center rounded-lg text-sidebar-foreground/60">
              <HardDrive className="size-4" />
            </div>
          }
        />
        <TooltipContent side="right">310 GB of 500 GB used</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium">
        <HardDrive className="size-3.5 text-accent" />
        Downloads drive
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${used * 100}%` }} />
      </div>
      <div className="mt-2 text-[11px] text-sidebar-foreground/55">310 GB of 500 GB used</div>
    </div>
  );
}

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
    >
      <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link to="/" className="cursor-pointer" aria-label="Astrid Downloader home">
          <Logo compact={collapsed} />
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="flex flex-col gap-2 p-3">
        <StorageMeter collapsed={collapsed} />
        {collapsed && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Expand sidebar"
                  className="mx-auto grid size-9 cursor-pointer place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <PanelLeftOpen className="size-4" />
                </button>
              }
            />
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
    </motion.aside>
  );
}
