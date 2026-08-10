import React, { useMemo, useState } from "react";
import type { Zone } from "@/lib/db";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type OccupancyLevel = "Low" | "Medium" | "High" | "Critical";
type DateRange = "30days" | "6months" | "1year";

interface OccupancyHeatmapProps {
  campusName?: string;
  buildingName?: string;
  floorName?: string;
  zones?: Zone[];
}

function getHeatColorClass(level: OccupancyLevel) {
  switch (level) {
    case "Critical":
      return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.25)]";
    case "High":
      return "bg-emerald-500";
    case "Medium":
      return "bg-emerald-700";
    case "Low":
    default:
      return "bg-emerald-900/70";
  }
}

export function OccupancyHeatmap({
  buildingName = "Selected Building",
  floorName = "Selected Floor",
  zones = [],
}: OccupancyHeatmapProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30days");

  // Generate simulated historical grid data based on current floor occupancy
  const { 
    gridData, 
    monthLabels,
    totalOccupancy,
    maxOccupancy,
    maxOccupancyDate,
    avgOccupancy,
    startDateStr,
    endDateStr,
    validDays
  } = useMemo(() => {
    const baseOcc = zones.reduce((sum, z) => sum + z.occupancy, 0) || Math.floor(Math.random() * 50) + 10;
    const area = zones.reduce((sum, z) => sum + z.area, 0) || 500;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysToSimulate = dateRange === "1year" ? 365 : dateRange === "6months" ? 182 : 30;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToSimulate + 1);

    // Adjust to start on a Monday (0=Sun, 1=Mon, ..., 6=Sat)
    const startDayOfWeek = startDate.getDay();
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    startDate.setDate(startDate.getDate() - adjustedStartDay);

    const data = [];
    const months = [];
    let currentWeek = [];
    let currentDate = new Date(startDate);
    
    let colIndex = 0;
    let lastMonth = -1;

    let totalOccupancy = 0;
    let maxOccupancy = 0;
    let maxOccupancyDate = "";
    let validDays = 0;

    // Loop until we reach today AND finish the current week block
    while (currentDate <= today || currentWeek.length > 0) {
      if (currentWeek.length === 0) {
        const m = currentDate.getMonth();
        if (m !== lastMonth) {
          // Add month label if it's a new month
          months.push({ label: currentDate.toLocaleDateString("en-US", { month: "short" }), colIndex });
          lastMonth = m;
        }
      }

      if (currentDate <= today) {
        // Add realistic variations: weekends are lower, weekdays have small random noise
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const multiplier = isWeekend ? 0.2 + Math.random() * 0.3 : 0.6 + Math.random() * 0.8;
        
        const occ = Math.max(0, Math.round(baseOcc * multiplier));
        const density = area > 0 ? occ / area : 0;
        
        let level: OccupancyLevel = "Low";
        if (occ >= 100 || density >= 0.4) level = "Critical";
        else if (occ >= 50 || density >= 0.25) level = "High";
        else if (occ >= 20 || density >= 0.1) level = "Medium";
        
        totalOccupancy += occ;
        validDays++;
        
        const dateStr = currentDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
        
        if (occ > maxOccupancy) {
          maxOccupancy = occ;
          maxOccupancyDate = dateStr;
        }

        currentWeek.push({
          dateStr,
          occupancy: occ,
          level,
          isFuture: false,
        });
      } else {
        // Pad the rest of the week if 'today' isn't Sunday
        currentWeek.push({ isFuture: true });
      }

      currentDate.setDate(currentDate.getDate() + 1);
      
      if (currentWeek.length === 7) {
        data.push(currentWeek);
        currentWeek = [];
        colIndex++;
      }
    }

    const avgOccupancy = validDays > 0 ? Math.round(totalOccupancy / validDays) : 0;
    const startDateStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const endDateStr = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return { 
      gridData: data, 
      monthLabels: months,
      totalOccupancy,
      maxOccupancy,
      maxOccupancyDate,
      avgOccupancy,
      startDateStr,
      endDateStr,
      validDays
    };
  }, [zones, dateRange]);

  // Cell size + gap for absolute positioning of month labels
  // w-3 (12px) + gap-[3px] (3px) = 15px per column
  const COLUMN_WIDTH = 15;

  return (
    <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-lg overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40 bg-secondary/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <CalendarDays className="h-5 w-5 text-emerald-500" />
              Occupancy Calendar Heatmap
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Occupancy intensity over time for <strong className="text-foreground">{buildingName}</strong> ({floorName})
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Date Range:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="bg-secondary/30 border border-border/50 text-foreground font-medium text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-primary/50"
            >
              <option value="30days">Last 30 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last 1 Year</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col bg-background/50 rounded-xl border border-border/50 shadow-sm overflow-hidden w-full">
          
          {/* Top Section: Heatmap Grid */}
          <div className="p-6 overflow-x-auto flex justify-center">
            <div className="flex min-w-max">
              {/* Y-Axis: Days of the week */}
              <div className="flex flex-col gap-[3px] pr-3 text-[10px] text-muted-foreground font-medium pt-[20px]">
                <div className="h-3 flex items-center">Mon</div>
                <div className="h-3"></div>
                <div className="h-3 flex items-center">Wed</div>
                <div className="h-3"></div>
                <div className="h-3 flex items-center">Fri</div>
                <div className="h-3"></div>
                <div className="h-3"></div>
              </div>
              
              {/* X-Axis: Months and Grid */}
              <div className="flex flex-col">
                {/* Months Header */}
                <div className="relative h-[20px] w-full text-[10px] text-muted-foreground font-medium">
                  {monthLabels.map((m, idx) => (
                    <div 
                      key={idx} 
                      className="absolute bottom-1" 
                      style={{ left: m.colIndex * COLUMN_WIDTH }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid (Columns = Weeks, Rows = Days) */}
                <div className="flex gap-[3px]">
                  {gridData.map((week, colIndex) => (
                    <div key={colIndex} className="flex flex-col gap-[3px]">
                      {week.map((cell, rowIndex) => {
                        if (cell.isFuture) {
                          return <div key={rowIndex} className="w-3 h-3 rounded-[2px] bg-transparent"></div>;
                        }
                        
                        return (
                          <div
                            key={rowIndex}
                            className={`w-3 h-3 rounded-[2px] relative group cursor-pointer transition-all hover:ring-2 hover:ring-primary/80 z-0 hover:z-10 ${getHeatColorClass(
                              cell.level as OccupancyLevel
                            )}`}
                          >
                            {/* Hover Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-3 bg-slate-950 border border-slate-800 rounded-lg shadow-xl text-xs z-50 pointer-events-none">
                              <div className="font-bold text-slate-200 mb-2 pb-1.5 border-b border-slate-800">
                                Date: {cell.dateStr}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-6 text-slate-300">
                                  <span className="text-slate-400">Occupants:</span>
                                  <span className="font-semibold text-foreground">{cell.occupancy}</span>
                                </div>
                                <div className="flex justify-between gap-6 text-slate-300">
                                  <span className="text-slate-400">Density:</span>
                                  <span className="font-semibold text-foreground">{cell.level}</span>
                                </div>
                                <div className="flex justify-between gap-6 text-slate-300">
                                  <span className="text-slate-400">Level:</span>
                                  <span className="font-semibold text-foreground">{cell.level}</span>
                                </div>
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-1.5 mt-5 text-[10px] text-muted-foreground font-medium">
                  <span className="mr-1">Less</span>
                  <div className="w-3 h-3 rounded-[2px] bg-emerald-900/70"></div>
                  <div className="w-3 h-3 rounded-[2px] bg-emerald-700"></div>
                  <div className="w-3 h-3 rounded-[2px] bg-emerald-500"></div>
                  <div className="w-3 h-3 rounded-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.25)]"></div>
                  <span className="ml-1">More</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Section: Stats Panels */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border/50 divide-y md:divide-y-0 md:divide-x divide-border/50 bg-secondary/10">
            <div className="p-4 text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium">
                Occupants ({dateRange === "30days" ? "Last 30 Days" : dateRange === "6months" ? "Last 6 Months" : "Last 1 Year"})
              </div>
              <div className="text-2xl font-semibold text-foreground my-1.5">
                {totalOccupancy.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">total</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {startDateStr} - {endDateStr}
              </div>
            </div>
            
            <div className="p-4 text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium">Highest Daily Occupancy</div>
              <div className="text-2xl font-semibold text-foreground my-1.5">
                {maxOccupancy.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">occupants</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {maxOccupancyDate}
              </div>
            </div>

            <div className="p-4 text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground font-medium">Average Daily Occupancy</div>
              <div className="text-2xl font-semibold text-foreground my-1.5">
                {avgOccupancy.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ day</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Across {validDays} active days
              </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
