import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SeedProvider } from "./seed-provider";
import { useApp, type UserRole } from "@/lib/store";
import { Activity } from "lucide-react";

import { HierarchySelector } from "./hierarchy-selector";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { role, setRole } = useApp();
  return (
    <SeedProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card/60 px-6 py-4 backdrop-blur-xl shadow-sm z-10 sticky top-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-risk-green animate-pulse" />
                Live · Enterprise Command Center
              </div>
              <div className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="TrustGrid Logo"
                  className="h-6 w-auto object-contain hidden sm:block bg-white rounded-md p-1 shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  TrustGrid.AI
                </span>
              </div>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <HierarchySelector />
              {actions}
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="h-9 rounded-md border border-border bg-secondary px-2 text-xs font-medium"
              >
                <option>Admin</option>
                <option>Incident Commander</option>
                <option>Responder</option>
              </select>
              <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs">
                <Activity className="h-3.5 w-3.5 text-risk-green" />
                <span className="font-mono">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 min-w-0 p-4 sm:p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SeedProvider>
  );
}
