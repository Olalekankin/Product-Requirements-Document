import React from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-background w-full">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
