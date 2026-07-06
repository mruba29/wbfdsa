import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SeedProvider } from "./seed-provider";
import { useApp, type UserRole } from "@/lib/store";
import { Activity } from "lucide-react";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { role, setRole } = useApp();
  return (
    <SeedProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card/40 px-4 py-3 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-risk-green animate-pulse" />
                Live · Emergency Operations
              </div>
              <div className="flex items-center gap-2">
                <img
                  src="/logo.svg"
                  alt="TrustGrid Logo"
                  className="h-6 w-auto object-contain hidden sm:block bg-white rounded-sm p-0.5"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-bold">
                  TrustGrid.AI
                </span>
              </div>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
