import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Flame, Box, Users, Sparkles, Clock, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation — WB-FDVA" },
      {
        name: "description",
        content:
          "Future-ready simulation module for fire spread dynamics, 3D BIM walkthroughs, and emergency evacuation.",
      },
    ],
  }),
  component: SimulationPage,
});

export function SimulationPage() {
  const [activeTab, setActiveTab] = useState<"spread" | "evacuation" | "walkthrough">("spread");

  return (
    <AppShell
      title="Simulation (Future Module)"
      subtitle="Upcoming simulation engine for thermal fire spread, emergency evacuation modeling, and 3D spatial walkthroughs"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-card/60 border border-border/60 backdrop-blur-md shadow-sm w-fit">
          <button
            onClick={() => setActiveTab("spread")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "spread"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="h-4 w-4" /> Fire Spread Simulation
          </button>
          <button
            onClick={() => setActiveTab("evacuation")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "evacuation"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" /> Emergency Evacuation
          </button>
          <button
            onClick={() => setActiveTab("walkthrough")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "walkthrough"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Box className="h-4 w-4" /> 3D Walkthrough
          </button>
        </div>

        {/* Tab 1: Fire Spread Simulation Placeholder */}
        {activeTab === "spread" && (
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md p-8 min-h-[420px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <Flame className="h-12 w-12" />
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Clock className="h-3.5 w-3.5" /> Future Enhancement Placeholder
              </div>
              <h3 className="text-xl font-extrabold text-foreground">Fire Spread Simulation Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cellular automata thermal physics modeling, smoke propagation dynamics, and flame front velocity estimation planned for Phase 2 integration.
              </p>
            </div>
          </Card>
        )}

        {/* Tab 2: Emergency Evacuation Placeholder */}
        {activeTab === "evacuation" && (
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md p-8 min-h-[420px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Users className="h-12 w-12" />
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-3.5 w-3.5" /> Future Enhancement Placeholder
              </div>
              <h3 className="text-xl font-extrabold text-foreground">Emergency Evacuation Modeling</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agent-based crowd dynamics, staircase bottleneck prediction, and priority clearance routing for high-vulnerability occupants planned for Phase 2 integration.
              </p>
            </div>
          </Card>
        )}

        {/* Tab 3: 3D Walkthrough Placeholder */}
        {activeTab === "walkthrough" && (
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md p-8 min-h-[420px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Box className="h-12 w-12" />
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Clock className="h-3.5 w-3.5" /> Future Enhancement Placeholder
              </div>
              <h3 className="text-xl font-extrabold text-foreground">3D Walkthrough Integration</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Interactive first-person 3D spatial navigation, BIM digital twin mesh rendering, and immersive hazard visualization planned for Phase 2 integration.
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
