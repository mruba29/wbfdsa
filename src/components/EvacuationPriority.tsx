import React, { useMemo } from "react";
import { ListOrdered, ArrowRight, Loader2, AlertOctagon, ShieldCheck, Flame, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FloorData } from "@/types/floor";
import { getEvacuationPriority } from "@/services/aiCadService";

interface EvacuationPriorityProps {
  floors: any[];
  currentFloorData?: FloorData | null;
  onSelectFloor: (level: number) => void;
  selectedFloorLevel: number | null;
}

const PRIORITY_STYLES: Record<number, string> = {
  1: "bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-500/50 animate-pulse",
  2: "bg-orange-500 text-white",
  3: "bg-amber-500 text-white",
};

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "text-rose-400 bg-rose-500/15 border-rose-500/30 font-extrabold",
  HIGH: "text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold",
  MEDIUM: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30 font-bold",
  LOW: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30 font-bold",
};

export function EvacuationPriority({
  floors,
  currentFloorData,
  onSelectFloor,
  selectedFloorLevel,
}: EvacuationPriorityProps) {
  const { data: priorities = [], isLoading } = useQuery({
    queryKey: [
      "evacuationPriority",
      floors.map((f) => f.id),
      currentFloorData?.vulnerability?.overallVulnerability,
    ],
    queryFn: () => getEvacuationPriority(floors, currentFloorData),
    enabled: floors.length > 0,
  });

  // Calculate Highest & Lowest Vulnerability Floor
  const { highestFloor, lowestFloor } = useMemo(() => {
    if (!priorities.length) return { highestFloor: null, lowestFloor: null };
    const sorted = [...priorities].sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
    return {
      highestFloor: sorted[0],
      lowestFloor: sorted[sorted.length - 1],
    };
  }, [priorities]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm p-6 flex flex-col items-center justify-center min-h-[160px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-xs text-muted-foreground font-semibold">Calculating priority evacuation scores...</p>
      </div>
    );
  }

  if (priorities.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-lg overflow-hidden space-y-3 p-4">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-orange-500" />
          Evacuation Priority
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
          {priorities.length} Floors Ranked
        </span>
      </div>

      {/* Highest vs Lowest Vulnerability Floor Cards */}
      {highestFloor && (
        <div className="grid grid-cols-1 gap-2.5">
          {/* Highest Risk Floor (Immediate Evacuation) */}
          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 truncate">
                  Highest Vulnerability
                </span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40 shrink-0">
                Priority 1
              </span>
            </div>
            <h4 className="text-xs font-extrabold text-foreground truncate pl-5.5">{highestFloor.floorName}</h4>
          </div>

          {/* Lowest Risk Floor */}
          {lowestFloor && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 truncate">
                    Lowest Vulnerability
                  </span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0">
                  Safe Zone
                </span>
              </div>
              <h4 className="text-xs font-extrabold text-foreground truncate pl-5.5">{lowestFloor.floorName}</h4>
            </div>
          )}
        </div>
      )}

      {/* Priority Evacuation List */}
      <div className="rounded-xl border border-border/50 bg-background/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-1 px-3 py-2 text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider border-b border-border/50 bg-secondary/30">
          <div className="col-span-2 text-center">Priority</div>
          <div className="col-span-4">Floor</div>
          <div className="col-span-3 text-center">Risk Level</div>
          <div className="col-span-3 text-right">Action</div>
        </div>

        {/* Priority Rows */}
        <div className="divide-y divide-border/40 max-h-[260px] overflow-y-auto">
          {priorities.map((p) => {
            const isSelected = selectedFloorLevel === p.level;
            const isPriorityOne = p.priorityOrder === 1;
            const badgeStyle =
              PRIORITY_STYLES[p.priorityOrder] || "bg-secondary text-muted-foreground";
            const riskStyle = RISK_BADGE[p.riskLevel] || RISK_BADGE.LOW;

            return (
              <button
                key={p.floorId}
                onClick={() => onSelectFloor(p.level)}
                className={`w-full grid grid-cols-12 gap-1 px-3 py-2.5 items-center transition-all text-left ${
                  isPriorityOne
                    ? "bg-rose-500/15 border-l-4 border-l-rose-500 hover:bg-rose-500/20"
                    : isSelected
                    ? "bg-primary/10 border-l-4 border-l-primary hover:bg-primary/15"
                    : "hover:bg-secondary/40"
                }`}
              >
                {/* Priority Badge & Label */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${badgeStyle}`}
                  >
                    {p.priorityOrder}
                  </div>
                </div>

                {/* Floor Name & Immediate Warning badge if Priority 1 */}
                <div className="col-span-4 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-foreground truncate">{p.floorName}</span>
                    {isPriorityOne && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/40 shrink-0">
                        <Flame className="h-2.5 w-2.5 animate-bounce" /> Immediate Evacuation
                      </span>
                    )}
                  </div>
                </div>

                {/* Risk Level Badge */}
                <div className="col-span-3 flex justify-center">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${riskStyle}`}>
                    {p.riskLevel}
                  </span>
                </div>

                {/* Recommended Action / Select Button */}
                <div className="col-span-3 flex items-center justify-end gap-1 text-[10px] font-bold text-primary">
                  <span>{isPriorityOne ? "Evacuate Now" : "Inspect Floor"}</span>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 font-semibold">
        <span className="flex items-center gap-1 text-rose-400">
          <AlertOctagon className="h-3 w-3" /> Priority 1 requires immediate evacuation response
        </span>
        <span>Click row to view floor details</span>
      </div>
    </div>
  );
}
