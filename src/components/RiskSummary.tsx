import React from "react";
import { ShieldAlert, Flame, Users, User } from "lucide-react";
import { motion } from "framer-motion";

export type SimpleRiskLabel = "Low" | "Medium" | "High" | "Critical";

interface RiskSummaryProps {
  floorVulnerability?: SimpleRiskLabel;
  fireRisk?: SimpleRiskLabel;
  occupancyRisk?: SimpleRiskLabel;
  individualRisk?: SimpleRiskLabel;
  floorVulnerabilityScore?: number;
  fireRiskScore?: number;
  occupancyRiskScore?: number;
  individualRiskScore?: number;
}

const getLabelColor = (label: SimpleRiskLabel) => {
  switch (label) {
    case "Critical":
      return "text-rose-400 bg-rose-500/15 border-rose-500/30";
    case "High":
      return "text-orange-400 bg-orange-500/15 border-orange-500/30";
    case "Medium":
      return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    case "Low":
    default:
      return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
  }
};

export function RiskSummary({
  floorVulnerability = "Low",
  fireRisk = "Low",
  occupancyRisk = "Low",
  individualRisk = "Low",
  floorVulnerabilityScore = 20,
  fireRiskScore = 15,
  occupancyRiskScore = 25,
  individualRiskScore = 18,
}: RiskSummaryProps) {
  const metrics = [
    {
      title: "Floor Vulnerability",
      level: floorVulnerability,
      score: floorVulnerabilityScore,
      icon: ShieldAlert,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
      title: "Fire Risk",
      level: fireRisk,
      score: fireRiskScore,
      icon: Flame,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    {
      title: "Occupancy Risk",
      level: occupancyRisk,
      score: occupancyRiskScore,
      icon: Users,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Individual Risk",
      level: individualRisk,
      score: individualRiskScore,
      icon: User,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* FLOOR VULNERABILITY CARD */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-md space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Floor Vulnerability
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
            Selected Floor
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-secondary/30 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-lg ${m.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{m.title}</h4>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Score: <strong className="text-foreground">{m.score}%</strong>
                    </span>
                  </div>
                </div>

                {/* Risk Level Badge: Low, Medium, High, Critical */}
                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${getLabelColor(
                    m.level
                  )}`}
                >
                  {m.level}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
