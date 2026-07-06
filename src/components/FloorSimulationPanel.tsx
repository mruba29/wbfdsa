import React from "react";
import { Slider } from "@/components/ui/slider";
import { Timer, LayoutGrid, DoorOpen, DoorClosed, AlertTriangle, ArrowUpDown, Compass, ShieldCheck } from "lucide-react";
import type { FloorStatistics as FloorStatsType, FloorVulnerability, RiskLevelType } from "@/types/floor";

interface FloorSimulationPanelProps {
  simulationTime: number;
  onTimeChange: (val: number) => void;
  stats: FloorStatsType;
  vulnerability?: FloorVulnerability;
  floorRisk?: RiskLevelType;
  evacuationPriority?: number;
}

const RISK_COLOR: Record<RiskLevelType, string> = {
  LOW: "text-risk-green bg-risk-green/10",
  MEDIUM: "text-amber-500 bg-amber-500/10",
  HIGH: "text-orange-500 bg-orange-500/10",
  CRITICAL: "text-risk-red bg-risk-red/10",
};

export function FloorSimulationPanel({
  simulationTime,
  onTimeChange,
  stats,
  vulnerability,
  floorRisk,
  evacuationPriority,
}: FloorSimulationPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col overflow-hidden h-full">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-blue-500" />
            Time-based Simulation
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
            t = {simulationTime}s
          </span>
        </div>
        <Slider
          value={[simulationTime]}
          min={0}
          max={120}
          step={30}
          onValueChange={(vals) => onTimeChange(vals[0])}
          className="my-5"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-1">
          <span>0s</span>
          <span>30s</span>
          <span>60s</span>
          <span>90s</span>
          <span>120s</span>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          CAD Extraction Metrics
        </h4>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <MetricBox label="Rooms" value={stats.roomBoundaries?.length ?? 0} icon={LayoutGrid} color="text-indigo-500" />
          <MetricBox label="Doors" value={stats.doors} icon={DoorOpen} color="text-blue-500" />
          <MetricBox label="Windows" value={stats.windows} icon={LayoutGrid} color="text-cyan-500" />
          <MetricBox label="Staircases" value={stats.staircases} icon={ArrowUpDown} color="text-orange-500" />
          <MetricBox label="Elevators" value={stats.lifts} icon={ArrowUpDown} color="text-purple-500" />
          <MetricBox label="Exits" value={stats.directExits + (stats.emergencyExits || 0)} icon={DoorClosed} color="text-risk-green" />
        </div>

        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 border-t border-border pt-4">
          Dynamic Analysis
        </h4>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium"><Compass className="w-3.5 h-3.5"/> Avg. Exit Dist</span>
            <span className="font-semibold font-mono">{stats.distanceToStaircase}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium"><AlertTriangle className="w-3.5 h-3.5"/> Current Vulnerability</span>
            <span className="font-bold text-lg">{vulnerability?.overallVulnerability ?? 0}%</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium"><ShieldCheck className="w-3.5 h-3.5"/> Risk Level</span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${floorRisk ? RISK_COLOR[floorRisk] : ""}`}>
              {floorRisk ?? "SAFE"}
            </span>
          </div>
          {evacuationPriority !== undefined && (
            <div className="flex justify-between items-center text-xs border-t border-border pt-3 mt-3">
              <span className="text-muted-foreground font-semibold">Evacuation Priority</span>
              <span className="font-bold text-base px-2 py-0.5 bg-secondary rounded border border-border text-foreground shadow-sm">
                Priority {evacuationPriority}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, icon: Icon, color }: any) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5 flex items-center gap-2.5 shadow-sm hover:shadow-md transition-shadow">
      <div className={`p-1.5 rounded bg-secondary ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold leading-none mb-1">{label}</p>
        <p className="font-bold text-base leading-none">{value}</p>
      </div>
    </div>
  );
}
