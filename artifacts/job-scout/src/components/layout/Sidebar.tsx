import React from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck } from "@workspace/api-client-react";
import { 
  Briefcase, 
  LayoutDashboard, 
  Settings, 
  Terminal, 
  Hash, 
  Activity,
  Radar,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job Feed", icon: Briefcase },
  { href: "/keywords", label: "Keywords", icon: Hash },
  { href: "/sources", label: "Sources", icon: Radar },
  { href: "/history", label: "Scanner History", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { refetchInterval: 60000, queryKey: ["healthCheck"] } });

  const isHealthy = health?.status === "ok" || health?.status === "healthy";

  return (
    <aside
      className={cn(
        // Base styles
        "w-64 bg-sidebar text-sidebar-foreground flex flex-col h-[100dvh] border-r border-sidebar-border shadow-xl z-50 shrink-0",
        // Mobile: fixed drawer that slides in; Desktop: sticky always-visible
        "fixed md:sticky top-0",
        "transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border gap-3 shrink-0">
        <div className="bg-primary p-1.5 rounded-md flex items-center justify-center shadow-inner">
          <Terminal className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-lg tracking-tight uppercase tracking-widest text-sidebar-foreground/90 flex-1">
          Job Scout
        </span>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="text-xs font-mono text-sidebar-foreground/40 mb-3 px-3 uppercase tracking-wider">
          System Menu
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="block"
                onClick={onClose}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-sidebar-accent-border"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 opacity-80" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/40 font-mono flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span>API STATUS:</span>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", isHealthy ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
            <span className={isHealthy ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
              {isHealthy ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div>V 1.0.4-BUILD</div>
      </div>
    </aside>
  );
}
