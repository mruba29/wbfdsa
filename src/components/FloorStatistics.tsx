import React from "react";
import {
  LogOut,
  DoorOpen,
  LayoutGrid,
  Landmark,
  ArrowUpDown,
  AlertTriangle,
  Compass,
  Building,
  Navigation,
} from "lucide-react";
import { motion } from "framer-motion";
import type { FloorStatistics as FloorStatsType } from "@/types/floor";

interface FloorStatisticsProps {
  stats: FloorStatsType;
}

export function FloorStatistics({ stats }: FloorStatisticsProps) {
  const items = [
    {
      label: "Rooms",
      value: stats.rooms ?? 8,
      icon: Building,
      color: "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20",
    },
    {
      label: "Doors",
      value: stats.doors,
      icon: DoorOpen,
      color: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
    },
    {
      label: "Windows",
      value: stats.windows,
      icon: LayoutGrid,
      color: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
    },
    {
      label: "Staircases",
      value: stats.staircases,
      icon: Landmark,
      color: "text-orange-400 bg-orange-500/10 border border-orange-500/20",
    },
    {
      label: "Lifts",
      value: stats.lifts,
      icon: ArrowUpDown,
      color: "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20",
    },
    {
      label: "Emergency Exits",
      value: stats.emergencyExits ?? 2,
      icon: AlertTriangle,
      color: "text-rose-400 bg-rose-500/10 border border-rose-500/20",
    },
    {
      label: "Dist. to Staircase",
      value: stats.distanceToStaircase || "12 m",
      icon: Compass,
      color: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
    },
    {
      label: "Dist. to Lift",
      value: stats.distanceToLift || "25 m",
      icon: Navigation,
      color: "text-teal-400 bg-teal-500/10 border border-teal-500/20",
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  const cardVariant = {
    hidden: { opacity: 0, scale: 0.93, y: 6 },
    show: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <motion.div
      key={`${stats.doors}-${stats.staircases}-${stats.rooms}-${stats.windows}`}
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-3 grid-cols-2 md:grid-cols-4"
    >
      {items.map((it) => {
        const Icon = it.icon;
        const isString = typeof it.value === "string";
        return (
          <motion.div
            key={it.label}
            variants={cardVariant}
            whileHover={{ scale: 1.02, translateY: -2 }}
            className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-md p-3.5 shadow-sm flex flex-col justify-between gap-1.5 hover:border-primary/40 transition-all duration-200"
          >
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-full truncate">
              {it.label}
            </p>
            <div className="flex items-center gap-2.5 w-full">
              <div className={`p-1.5 rounded-lg shrink-0 ${it.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <h4
                className={`${isString ? "text-sm md:text-base" : "text-xl"} font-extrabold text-foreground truncate leading-none`}
                title={String(it.value)}
              >
                {it.value}
              </h4>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
