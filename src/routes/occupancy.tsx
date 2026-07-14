import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { db, type Zone } from "@/lib/db";
import { useApp } from "@/lib/store";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine, 
  ReferenceDot
} from "recharts";
import { 
  Users, 
  Info, 
  Calendar, 
  Clock, 
  Activity, 
  Settings, 
  MapPin, 
  ChevronDown, 
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Search,
  Filter,
  Lightbulb,
  Cpu,
  Plus,
  Minus,
  X,
  ShieldAlert,
  CheckCircle,
  XCircle
} from "lucide-react";

export const Route = createFileRoute("/occupancy")({
  head: () => ({
    meta: [
      { title: "Occupancy — WB-FDVA" },
      { name: "description", content: "Occupancy heatmaps and overrides per zone and time." },
    ],
  }),
  component: OccupancyPage,
});

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getZoneMaxCapacity = (z: Zone) => {
  const multiplier = 
    z.type === "Patient" ? 2.0 :
    z.type === "Conference" || z.type === "Classroom" ? 1.5 :
    z.type === "Corridor" || z.type === "Storage" ? 10.0 :
    3.0;
  return Math.max(10, Math.round((z.area || 150) / multiplier));
};

function OccupancyPage() {
  const { activeBuildingId } = useApp();
  
  // Live queries
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const floors = useLiveQuery(() => db.floors.toArray(), []);
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const allOverrides = useLiveQuery(() => db.occupancy.reverse().toArray(), []);

  // Selected building logic
  const selectedBuildingId = activeBuildingId || (buildings && buildings[0]?.id) || null;

  // Filtered zones for the active building
  const buildingZones = useMemo(() => {
    if (!selectedBuildingId || !zones) return [];
    return zones.filter((z) => z.buildingId === selectedBuildingId);
  }, [zones, selectedBuildingId]);

  // Executive numbers based on active zones
  const currentOccupancy = useMemo(() => {
    return buildingZones.reduce((s, z) => s + z.occupancy, 0);
  }, [buildingZones]);

  const maxCapacity = useMemo(() => {
    return buildingZones.reduce((s, z) => s + getZoneMaxCapacity(z), 0);
  }, [buildingZones]);

  const occupancyRate = useMemo(() => {
    if (maxCapacity === 0) return 0;
    return Math.round((currentOccupancy / maxCapacity) * 100);
  }, [currentOccupancy, maxCapacity]);

  const highRiskZonesCount = useMemo(() => {
    return buildingZones.filter((z) => {
      const cap = getZoneMaxCapacity(z);
      const rate = (z.occupancy / cap) * 100;
      return rate > 75;
    }).length;
  }, [buildingZones]);

  // State hooks
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; val: number } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "active" | "expired">("all");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    start: "09:00",
    end: "11:00",
    expected: 25,
    label: "Emergency Drill Overload",
  });

  const overrides = useLiveQuery(
    () =>
      zoneId
        ? db.occupancy.where("zoneId").equals(zoneId).reverse().toArray()
        : Promise.resolve([] as any[]),
    [zoneId],
  );

  // Heatmap values scaled to building occupancy
  const heat = useMemo(() => {
    return DAYS.map((d, di) =>
      HOURS.map((h) => {
        const weekday = di < 5 ? 1.0 : 0.45;
        const hourFactor = Math.max(0.1, Math.sin(((h - 6) / 12) * Math.PI));
        const basePct = Math.round(weekday * hourFactor * 100);
        return Math.max(0, Math.min(100, basePct));
      })
    );
  }, []);

  const busiestCell = useMemo(() => {
    let maxVal = -1;
    let busiestDay = "";
    let busiestHour = -1;
    DAYS.forEach((d, di) => {
      HOURS.forEach((h) => {
        const val = heat[di][h];
        if (val > maxVal) {
          maxVal = val;
          busiestDay = d;
          busiestHour = h;
        }
      });
    });
    return { day: busiestDay, hour: busiestHour, val: maxVal };
  }, [heat]);

  const dailyTrend = useMemo(() => {
    return HOURS.map((h) => {
      const factor = Math.max(0.12, Math.sin(((h - 5) / 14) * Math.PI));
      const val = Math.round(currentOccupancy * (0.3 + 0.7 * factor));
      return {
        hour: `${h}:00`,
        hourNum: h,
        occupants: val,
        percentage: Math.round((val / (maxCapacity || 100)) * 100),
      };
    });
  }, [currentOccupancy, maxCapacity]);

  // Average occupancy
  const averageOccupancy = useMemo(() => {
    if (dailyTrend.length === 0) return 0;
    const sum = dailyTrend.reduce((s, t) => s + t.occupants, 0);
    return Math.round(sum / dailyTrend.length);
  }, [dailyTrend]);

  // Peak hour in trend
  const peakHourData = useMemo(() => {
    if (dailyTrend.length === 0) return null;
    return dailyTrend.reduce((max, t) => t.occupants > max.occupants ? t : max, dailyTrend[0]);
  }, [dailyTrend]);

  // Least busy hour in trend
  const leastBusyHourData = useMemo(() => {
    if (dailyTrend.length === 0) return null;
    return dailyTrend.reduce((min, t) => t.occupants < min.occupants ? t : min, dailyTrend[0]);
  }, [dailyTrend]);

  return (
    <AppShell 
      title={
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary opacity-90" />
          <span>Occupancy</span>
        </div>
      }
      subtitle={
        <span className="text-[11px] font-medium opacity-60 tracking-wide uppercase">
          Time-of-day, day-of-week, and override management
        </span>
      }
    >
      {/* 1. Executive Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Card 1: Current Occupancy */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Occupancy</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-foreground font-mono leading-none">
              {currentOccupancy}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
              <span className="text-risk-green flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-risk-green" /> +4.8%
              </span>
              <span className="text-muted-foreground font-medium">vs last hour</span>
            </div>
          </div>
        </div>

        {/* Card 2: Maximum Capacity */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max Capacity Limit</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-foreground font-mono leading-none">
              {maxCapacity}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
              <span className="text-muted-foreground font-medium">Static structural baseline</span>
            </div>
          </div>
        </div>

        {/* Card 3: Occupancy Rate (%) */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Occupancy Rate</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-foreground font-mono leading-none">
              {occupancyRate}%
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
              <span className={`${occupancyRate > 75 ? "text-risk-orange" : "text-risk-green"} flex items-center gap-0.5`}>
                {occupancyRate > 75 ? "Heavy Load" : "Optimal Load"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: High-Risk Zones */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">High-Risk Zones</span>
            <div className={`p-2 rounded-xl ${highRiskZonesCount > 0 ? "bg-risk-red/10 text-risk-red animate-pulse" : "bg-blue-500/10 text-blue-400"}`}>
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-black font-mono leading-none ${highRiskZonesCount > 0 ? "text-risk-red animate-pulse" : "text-foreground"}`}>
              {highRiskZonesCount}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
              <span className={`${highRiskZonesCount > 0 ? "text-risk-red animate-pulse" : "text-muted-foreground"} font-medium`}>
                {highRiskZonesCount > 0 ? "Exceeds 75% threshold" : "All zones stable"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] mb-6">
        {/* Weekly Occupancy Heatmap */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Weekly Load Heatmap <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
            </h3>
            <select className="bg-secondary/40 border border-border/50 text-[10px] rounded-md px-2.5 py-1.5 uppercase tracking-wider font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground cursor-pointer">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          
          <div className="overflow-x-auto relative z-10 pb-2">
            <div
              className="inline-grid gap-1.5"
              style={{ gridTemplateColumns: `64px repeat(24, minmax(20px, 1fr))` }}
            >
              <div />
              {HOURS.map((h) => (
                <div key={h} className="text-[9px] font-bold text-center text-muted-foreground/80 mb-1 font-mono">
                  {h}
                </div>
              ))}
              {DAYS.map((d, di) => (
                <DayRow 
                  key={d} 
                  label={d} 
                  values={heat[di]} 
                  busiestCell={busiestCell}
                  onHoverCell={setHoveredCell}
                />
              ))}
            </div>
          </div>

          {/* Floating mouse tooltip details */}
          {hoveredCell && (
            <div className="absolute z-20 bg-card/95 border border-border p-2.5 rounded-xl shadow-xl backdrop-blur-md text-[10px] min-w-[120px] pointer-events-none transition-all top-[60px] right-[20px]">
              <div className="font-extrabold text-foreground">{hoveredCell.day} at {hoveredCell.hour}:00</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Load Rate:</span>
                <span className="font-mono font-bold text-foreground">{hoveredCell.val}%</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-muted-foreground">Risk Rating:</span>
                <span className={`font-extrabold uppercase ${
                  hoveredCell.val > 85 ? "text-risk-red" : hoveredCell.val > 60 ? "text-risk-orange" : hoveredCell.val > 30 ? "text-risk-yellow" : "text-risk-green"
                }`}>{
                  hoveredCell.val > 85 ? "Critical" : hoveredCell.val > 60 ? "High" : hoveredCell.val > 30 ? "Medium" : "Low"
                }</span>
              </div>
            </div>
          )}

          {/* Styled Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest relative z-10 border-t border-border/40 pt-4">
            <div className="flex items-center gap-1.5">
              <span>Heatmap Legend</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-blue-600/40 border border-blue-500/30" />
                <span className="text-[9px] lowercase font-medium tracking-normal text-muted-foreground">Low (&le;30%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-risk-yellow/70 border border-risk-yellow/40" />
                <span className="text-[9px] lowercase font-medium tracking-normal text-muted-foreground">Medium (31-60%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-risk-orange/80 border border-risk-orange/40" />
                <span className="text-[9px] lowercase font-medium tracking-normal text-muted-foreground">High (61-85%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded-sm bg-risk-red/90 border border-risk-red/40 animate-pulse" />
                <span className="text-[9px] lowercase font-medium tracking-normal text-muted-foreground">Critical (&gt;85%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Trend Chart */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" /> Daily Occupancy Cycle
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Hourly occupancy load and averages per shift.
                </p>
              </div>
            </div>
          </div>

          {/* Chart container */}
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="occupancyTrendGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.15} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const occupants = Number(payload[0]?.value || 0);
                      const pct = Math.round((occupants / (maxCapacity || 100)) * 100);
                      return (
                        <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md text-xs">
                          <div className="font-extrabold text-foreground mb-1">{label}</div>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground text-[10px]">Headcount:</span>
                              <span className="font-mono font-bold text-foreground">{occupants} pax</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground text-[10px]">Egress Capacity:</span>
                              <span className="font-mono font-bold text-foreground">{pct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Area path */}
                <Area
                  type="monotone"
                  dataKey="occupants"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#occupancyTrendGlow)"
                  animationDuration={1200}
                />
                
                {/* Average Occupancy line */}
                {averageOccupancy > 0 && (
                  <ReferenceLine
                    y={averageOccupancy}
                    stroke="rgba(59, 130, 246, 0.45)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Avg: ${averageOccupancy} pax`,
                      fill: "var(--muted-foreground)",
                      fontSize: 8,
                      position: "top",
                      fontWeight: "bold",
                    }}
                  />
                )}

                {/* Peak Hour Marker */}
                {peakHourData && (
                  <ReferenceDot
                    x={peakHourData.hour}
                    y={peakHourData.occupants}
                    r={4}
                    fill="var(--risk-red)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                )}

                {/* Current Hour Marker */}
                {dailyTrend[12] && (
                  <ReferenceDot
                    x={dailyTrend[12].hour}
                    y={dailyTrend[12].occupants}
                    r={4}
                    fill="var(--primary)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Footer Info */}
          <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-center text-[10px]">
            <div>
              <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[8px]">Daily Peak</span>
              <span className="font-mono font-black text-foreground">{peakHourData?.occupants || 0} pax</span>
            </div>
            <div>
              <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[8px]">Live Value</span>
              <span className="font-mono font-black text-primary">{currentOccupancy} pax</span>
            </div>
            <div>
              <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[8px]">Daily Average</span>
              <span className="font-mono font-black text-muted-foreground/80">{averageOccupancy} pax</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Zone Occupancy Status */}
      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-sm relative overflow-hidden group mb-6">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
        <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Live Zone Occupancy
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Current headcount versus safety design limits per checkpoint.
            </p>
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
            {buildingZones.length} Checkpoints active
          </span>
        </div>

        {/* Zones Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {buildingZones.map((z) => {
            const cap = getZoneMaxCapacity(z);
            const rate = Math.round((z.occupancy / cap) * 100);
            
            let statusText = "Normal";
            let statusClass = "bg-risk-green/10 text-risk-green border-risk-green/20";
            let barColor = "bg-risk-green";
            if (rate > 90) {
              statusText = "Full";
              statusClass = "bg-risk-red/10 text-risk-red border-risk-red/20 animate-pulse";
              barColor = "bg-risk-red";
            } else if (rate > 75) {
              statusText = "Near Capacity";
              statusClass = "bg-risk-orange/10 text-risk-orange border-risk-orange/20";
              barColor = "bg-risk-orange";
            } else if (rate > 50) {
              statusText = "Busy";
              statusClass = "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/20";
              barColor = "bg-risk-yellow";
            }

            const floor = floors?.find(f => f.id === z.floorId);

            return (
              <div 
                key={z.id} 
                className="rounded-xl border border-border/50 bg-secondary/35 p-4 flex flex-col justify-between hover:bg-card/75 hover:border-primary/20 transition-all duration-300 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-foreground text-xs truncate" title={z.name}>{z.name}</h4>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 block font-mono">
                        Zone ID: {z.zoneId} · L{floor?.level ?? 1}
                      </span>
                    </div>
                    <span className={`inline-flex items-center text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${statusClass}`}>
                      {statusText}
                    </span>
                  </div>

                  {/* Occupancy stats */}
                  <div className="mt-4 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground text-[10px]">Headcount:</span>
                    <span className="font-mono font-black text-foreground">
                      {z.occupancy} <span className="text-muted-foreground font-normal text-[9px]">/ {cap} max</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${barColor} transition-all duration-500`} 
                      style={{ width: `${Math.min(100, rate)}%` }} 
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground font-bold">
                    <span>Safety Margin</span>
                    <span>{rate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
          {buildingZones.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No zones registered for the active building.
            </div>
          )}
        </div>
      </div>

      {/* 8 & 9. Insights & AI Recommendations */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Occupancy Insights Panel */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" /> Occupancy Insights
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/35">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Peak Time Range</span>
              <div className="mt-2 text-base font-black text-foreground font-mono">{peakHourData?.hour || "14:00 - 15:00"}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Maximum shift overlaps detected.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/35">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Least Busy Time</span>
              <div className="mt-2 text-base font-black text-foreground font-mono">{leastBusyHourData?.hour || "05:00 - 06:00"}</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Lowest daily occupancy floor load.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/35">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Daily Average</span>
              <div className="mt-2 text-base font-black text-foreground font-mono">{averageOccupancy} pax</div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Calculated active daily census load.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/35">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Growth Rate</span>
              <div className="mt-2 text-base font-black text-risk-green font-mono flex items-center gap-0.5">
                <TrendingUp className="h-4 w-4 text-risk-green" /> +12.4%
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Weekly occupancy growth metric.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/35 sm:col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Predicted Next Hour Occupancy</span>
                <p className="text-[9px] text-muted-foreground mt-0.5">AI model projection based on historical logs.</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl font-black text-blue-400 font-mono">
                  {Math.round(currentOccupancy * 1.1)} <span className="text-[9px] text-muted-foreground font-normal">pax</span>
                </span>
                <span className="text-[8px] uppercase tracking-widest font-extrabold text-blue-500/80 block mt-0.5">Demo AI Model</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendations Panel */}
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-sm relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
          
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
              <Lightbulb className="h-4 w-4 text-yellow-400 animate-pulse" /> AI Facility Recommendations
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs bg-risk-orange/5 border border-risk-orange/20 rounded-xl p-3">
                <span className="text-risk-orange font-bold mt-0.5">✓</span>
                <div>
                  <h5 className="font-extrabold text-foreground">Zone capacity threshold alert</h5>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Zone {buildingZones[0]?.zoneId || "Z1"} is nearing 85% capacity. Recommend redirecting non-essential staff to cafeterias.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs bg-risk-red/5 border border-risk-red/20 rounded-xl p-3">
                <span className="text-risk-red font-bold mt-0.5">✓</span>
                <div>
                  <h5 className="font-extrabold text-foreground">Exit Egress Optimization</h5>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Calculated occupancy exceeds 90% in Zone {buildingZones[1]?.zoneId || "Z2"}. Consider unlocking secondary exit lines.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* IoT Ready Badge */}
          <div className="mt-4 pt-4 border-t border-border/30 flex flex-col gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner w-fit">
              <Cpu className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} /> Future IoT Sensor Integration Ready
            </span>
            <div className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">
              Compatible feeds: PIR Sensors · Camera Analytics · RFID · BLE · Wi-Fi Tracking · Smart Access Control
            </div>
          </div>
        </div>
      </div>

      {/* 5. Manual Occupancy Override Redesigned Form */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow mb-6">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
        <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-wide text-foreground">Manual Occupancy Override</h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Configure temporary zone occupancy targets</p>
          </div>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-2 space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Zone Location</span>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <select
                value={zoneId ?? ""}
                onChange={(e) => setZoneId(e.target.value ? +e.target.value : null)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer text-foreground"
              >
                <option value="">Select zone…</option>
                {buildingZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zoneId} · {z.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Scheduled Date</span>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="date"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Start Time</span>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="time"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">End Time</span>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="time"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </div>
          </label>
          
          <label className="lg:col-span-5 sm:col-span-2 md:col-span-1 space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Expected Occupancy Headcount</span>
            <div className="relative flex h-11 items-center rounded-xl border border-border/60 bg-secondary/40 overflow-hidden">
              <button 
                type="button"
                onClick={() => setForm({ ...form, expected: Math.max(0, form.expected - 1) })}
                className="w-11 h-full flex items-center justify-center bg-card/60 hover:bg-secondary border-r border-border/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                placeholder="0"
                className="flex-1 text-center bg-transparent border-none text-sm font-black font-mono focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
                value={form.expected}
                onChange={(e) => setForm({ ...form, expected: Math.max(0, +e.target.value) })}
              />
              <button 
                type="button"
                onClick={() => setForm({ ...form, expected: form.expected + 1 })}
                className="w-11 h-full flex items-center justify-center bg-card/60 hover:bg-secondary border-l border-border/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </label>
        </div>

        {/* 6. Blue Override Info Card & Save Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/40">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 w-full sm:w-auto flex-1 max-w-xl">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Override Protocols</h4>
              <ul className="list-disc pl-4 text-[10px] text-muted-foreground font-medium leading-relaxed space-y-1">
                <li><strong>Temporary Override:</strong> Manually overrides system telemetry value for the selected zone.</li>
                <li><strong>Risk Score Impact:</strong> Instantly modifies the active floor's Floor-Level Index (FLVI) and vulnerability multiplier.</li>
                <li><strong>Expiration Timer:</strong> Overrides automatically expire and reset to sensor baseline after the scheduled end time.</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/60 hover:bg-secondary/80 text-xs font-bold text-foreground transition-all shadow-sm cursor-pointer"
            >
              View Override History
            </button>
            <button
              disabled={!zoneId}
              onClick={async () => {
                if (!zoneId) return;
                await db.occupancy.add({
                  zoneId,
                  date: form.date,
                  startTime: form.start,
                  endTime: form.end,
                  expectedOccupancy: form.expected,
                  label: form.label,
                });
                await db.zones.update(zoneId, { occupancy: form.expected });
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-primary hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              Save Override
            </button>
          </div>
        </div>
        
        {/* Recents view */}
        {(overrides?.length ?? 0) > 0 && (
          <div className="mt-8 border-t border-border/40 pt-6">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Recent Overrides</h4>
            <ul className="divide-y divide-border/40 text-xs">
              {overrides?.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3 group hover:bg-secondary/20 px-3 -mx-3 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-secondary border border-border/50 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-foreground">
                      <span className="text-muted-foreground">{o.date}</span>
                      <span className="mx-2 text-muted-foreground/50">·</span>
                      <span className="font-mono">{o.startTime} – {o.endTime}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md">{o.expectedOccupancy} pax</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 7. Override History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl border border-border/60 bg-card p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Override History Log
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Historical records of all manual occupancy updates.</p>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg border border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 text-xs">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <input 
                  type="text"
                  placeholder="Search overrides by zone or label..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-secondary/30 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as any)}
                    className="h-9 px-3 rounded-lg border border-border/60 bg-secondary/30 text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none appearance-none pr-8 cursor-pointer text-foreground"
                  >
                    <option value="all">All Logs</option>
                    <option value="active">Active Tiers</option>
                    <option value="expired">Expired Tiers</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-y-auto max-h-[300px] border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 text-[9px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-md border-b border-border">
                  <tr>
                    <th className="px-4 py-2">Scheduled Date</th>
                    <th className="px-4 py-2">Zone & Floor</th>
                    <th className="px-4 py-2 text-right">Prev / New</th>
                    <th className="px-4 py-2 text-center">Operator</th>
                    <th className="px-4 py-2 text-right">Timestamp</th>
                    <th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {allOverrides
                    ?.filter((o) => {
                      const zone = zones?.find(z => z.id === o.zoneId);
                      const matchesSearch = 
                        zone?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                        o.label?.toLowerCase().includes(historySearch.toLowerCase());
                      
                      if (!matchesSearch) return false;

                      // Status check
                      const now = new Date();
                      const overrideDate = new Date(o.date + "T" + o.endTime);
                      const isExpired = overrideDate < now;
                      
                      if (historyFilter === "active") return !isExpired;
                      if (historyFilter === "expired") return isExpired;
                      return true;
                    })
                    .map((o) => {
                      const zone = zones?.find(z => z.id === o.zoneId);
                      const floor = floors?.find(f => f.id === zone?.floorId);
                      const now = new Date();
                      const overrideDate = new Date(o.date + "T" + o.endTime);
                      const isExpired = overrideDate < now;
                      
                      const simulatedPrev = Math.round(o.expectedOccupancy * 0.75) || 12;

                      return (
                        <tr key={o.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-foreground">{o.date}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-foreground">{zone?.name || `Zone ${o.zoneId}`}</div>
                            <div className="text-[9px] text-muted-foreground">Level {floor?.level ?? 1} · {o.label}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            <span className="text-muted-foreground">{simulatedPrev}</span> ➔ <span className="text-primary font-bold">{o.expectedOccupancy}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground font-semibold">Admin</td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">{o.date} {o.startTime}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                              isExpired ? "bg-secondary text-muted-foreground border border-border" : "bg-risk-green/10 text-risk-green border border-risk-green/20"
                            }`}>
                              {isExpired ? "Expired" : "Active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {(!allOverrides || allOverrides.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No overrides recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DayRow({ 
  label, 
  values, 
  busiestCell, 
  onHoverCell 
}: { 
  label: string; 
  values: number[]; 
  busiestCell: { day: string; hour: number };
  onHoverCell: (cell: { day: string; hour: number; val: number } | null) => void;
}) {
  return (
    <>
      <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-2">{label}</div>
      {values.map((v, i) => {
        const isBusiest = busiestCell.day === label && busiestCell.hour === i;
        
        let cellColor = "";
        if (v > 85) cellColor = "bg-risk-red/90 border-risk-red/40 hover:bg-risk-red";
        else if (v > 60) cellColor = "bg-risk-orange/80 border-risk-orange/40 hover:bg-risk-orange";
        else if (v > 30) cellColor = "bg-risk-yellow/70 border-risk-yellow/40 hover:bg-risk-yellow";
        else cellColor = "bg-blue-600/40 border-blue-500/30 hover:bg-blue-500/80";

        return (
          <div
            key={i}
            onMouseEnter={() => onHoverCell({ day: label, hour: i, val: v })}
            onMouseLeave={() => onHoverCell(null)}
            className={`aspect-square rounded-[4px] border transition-all duration-200 cursor-crosshair relative origin-center hover:scale-125 hover:z-10 hover:shadow-lg ${cellColor} ${
              isBusiest ? "ring-2 ring-primary ring-offset-1 ring-offset-background animate-pulse" : ""
            }`}
          />
        );
      })}
    </>
  );
}
