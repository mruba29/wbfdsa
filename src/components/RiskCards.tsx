import React from "react";
import { ShieldAlert, Users, User, Flame } from "lucide-react";
import { motion } from "framer-motion";
import type { RiskLevelType } from "@/types/floor";

interface RiskCardsProps {
  floorRisk: RiskLevelType;
  occupancyRisk: RiskLevelType;
  individualRisk: RiskLevelType;
  overallFireRisk: RiskLevelType;
}

const RISK_CONFIG = {
  LOW: {
    border: "border-t-risk-green",
    text: "text-risk-green",
  },
  MEDIUM: {
    border: "border-t-risk-yellow",
    text: "text-risk-yellow",
  },
  HIGH: {
    border: "border-t-risk-orange",
    text: "text-risk-orange",
  },
  CRITICAL: {
    border: "border-t-risk-red",
    text: "text-risk-red",
  },
};

export function RiskCards({
  floorRisk = "LOW",
  occupancyRisk = "LOW",
  individualRisk = "LOW",
  overallFireRisk = "LOW",
}: RiskCardsProps) {
  const cards = [
    {
      title: "Floor Risk",
      value: floorRisk,
      icon: ShieldAlert,
      desc: "Building structural & evacuation risk",
    },
    {
      title: "Occupancy Risk",
      value: occupancyRisk,
      icon: Users,
      desc: "Density & movement speed coefficient",
    },
    {
      title: "Individual Risk",
      value: individualRisk,
      icon: User,
      desc: "Vulnerable personnel & special needs",
    },
    {
      title: "Overall Fire Risk",
      value: overallFireRisk,
      icon: Flame,
      desc: "Aggregate audit score assessment",
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        const config = RISK_CONFIG[c.value] || RISK_CONFIG.LOW;

        return (
          <motion.div
            key={c.title}
            variants={item}
            whileHover={{ scale: 1.02, translateY: -2 }}
            className={`rounded-xl border border-border bg-card/60 backdrop-blur-sm flex items-center justify-between p-4 border-t-[3px] shadow-sm hover:shadow-md transition-shadow duration-300 ease-in-out ${config.border}`}
          >
            <div className="flex flex-col justify-between h-full gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">{c.title}</span>
              <span className={`text-[22px] font-bold uppercase tracking-wider ${config.text}`}>
                {c.value}
              </span>
            </div>

            <div className={`p-1.5 opacity-90 ${config.text}`}>
              <Icon className="h-8 w-8 stroke-[1.5]" />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
