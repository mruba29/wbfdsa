import React from "react";
import { ShieldAlert, Building2, Layers, Box } from "lucide-react";
import { motion } from "framer-motion";

export type SimpleRiskLabel = "Low" | "Medium" | "High" | "Critical";

interface RiskSummaryProps {
  floorVulnerability?: SimpleRiskLabel;
  buildingVulnerability?: SimpleRiskLabel;
}

const getLabelColor = (label: SimpleRiskLabel) => {
  switch (label) {
    case "Critical":
      return "text-rose-500 bg-rose-500/15 border-rose-500/30";
    case "High":
      return "text-amber-500 bg-amber-500/15 border-amber-500/30";
    case "Medium":
      return "text-yellow-500 bg-yellow-500/15 border-yellow-500/30";
    case "Low":
    default:
      return "text-emerald-500 bg-emerald-500/15 border-emerald-500/30";
  }
};

export function RiskSummary({
  floorVulnerability = "Low",
  buildingVulnerability = "Medium",
}: RiskSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Risk Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-md space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Risk Summary
          </h3>
          <span className="text-[10px] font-semibold text-muted-foreground">Live Assessment</span>
        </div>

        <div className="space-y-3">
          {/* Floor Vulnerability */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-secondary/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-foreground">Floor Vulnerability</span>
            </div>
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider ${getLabelColor(
                floorVulnerability
              )}`}
            >
              {floorVulnerability}
            </span>
          </div>

          {/* Building Vulnerability */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-secondary/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-foreground">Building Vulnerability</span>
            </div>
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider ${getLabelColor(
                buildingVulnerability
              )}`}
            >
              {buildingVulnerability}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Placeholder Card: Future Enhancement */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-dashed border-border/70 bg-card/40 backdrop-blur-xl p-4 shadow-sm space-y-2"
      >
        <div className="flex items-center gap-2 text-primary font-bold text-xs">
          <Box className="h-4 w-4 text-blue-400" />
          <span>Future Enhancement</span>
        </div>
        <p className="text-xs text-muted-foreground font-semibold">
          3D Walkthrough Integration
        </p>
      </motion.div>
    </div>
  );
}
