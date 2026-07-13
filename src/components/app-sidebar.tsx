import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Map,
  Users,
  Flame,
  ShieldAlert,
  CalendarRange,
  Layers,
} from "lucide-react";
import { useApp } from "@/lib/store";

const navigationGroups = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/portfolio-map", label: "Portfolio Map", icon: Map },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/buildings", label: "Buildings", icon: Building2 },
      { to: "/building-input", label: "Building Input", icon: Building2 },
      { to: "/floor-plans", label: "Floor Plans", icon: Layers },
      { to: "/occupancy", label: "Occupancy", icon: CalendarRange },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/personnel", label: "Personnel", icon: Users },
      { to: "/incidents", label: "Fire Incidents", icon: Flame },
      { to: "/vulnerability", label: "Vulnerability", icon: ShieldAlert },
      { to: "/fire-inventory", label: "Fire Inventory", icon: Flame },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useApp();

  return (
    <div className="hidden md:flex h-screen sticky top-0 shrink-0 p-4 pr-0">
      <aside className="w-64 flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur-xl text-card-foreground shadow-xl overflow-hidden ring-1 ring-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border/40 relative z-10">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-primary-foreground shrink-0 overflow-hidden shadow-sm ring-1 ring-black/5">
            <img
              src="/logo.svg"
              alt="TrustGrid Logo"
              className="h-full w-full object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
            <ShieldAlert className="h-5 w-5 text-primary hidden" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              WB-FDVA
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 font-medium">
              by <span className="font-bold text-primary/80">TrustGrid.AI</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 relative z-10 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {navigationGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-out relative overflow-hidden ${
                        active
                          ? "text-primary font-semibold shadow-sm bg-primary/10"
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 rounded-r-full bg-primary" />
                      )}
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          active ? "bg-primary/20 text-primary" : "bg-transparent text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/40 px-5 py-4 text-xs bg-muted/10 relative z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                Active Role
              </div>
              <div className="font-semibold text-foreground truncate">{role}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
