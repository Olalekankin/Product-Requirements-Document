import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, Terminal } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-background w-full">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, sticky on desktop */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center h-14 px-4 border-b border-border bg-sidebar text-sidebar-foreground md:hidden shrink-0 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="bg-primary p-1.5 rounded-md flex items-center justify-center shadow-inner">
            <Terminal className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm tracking-widest uppercase text-sidebar-foreground/90">
            Job Scout
          </span>
        </header>

        <main className="flex-1 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
