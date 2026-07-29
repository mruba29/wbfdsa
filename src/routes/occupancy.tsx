import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { Users, Activity, Clock, Compass, Building2, Sun, Sunset, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/occupancy")({
  head: () => ({
    meta: [
      { title: "Occupancy Analytics — WB-FDVA" },
      {
        name: "description",
        content:
          "Occupancy headcount metrics, spatial density, time-based shift breakdown, and occupancy heatmap.",
      },
    ],
  }),
  component: OccupancyAnalyticsPage,
});

export function OccupancyAnalyticsPage() {
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

  const buildingId = selectedBuildingId ?? (buildings && buildings[0]?.id ? buildings[0].id : null);

  const selectedBuilding = useMemo(() => {
    return buildings?.find((b) => b.id === buildingId) ?? null;
  }, [buildings, buildingId]);

  const zones = useLiveQuery(
    () =>
      buildingId
        ? db.zones.where("buildingId").equals(buildingId).toArray()
        : Promise.resolve<any[]>([]),
    [buildingId],
  );

  // 1. Occupancy Count
  const totalOccupancyCount = useMemo(() => {
    return zones?.reduce((sum, z) => sum + z.occupancy, 0) ?? 0;
  }, [zones]);

  // 2. Occupancy Density (occupants per m²)
  const buildingArea = selectedBuilding?.totalArea || 1200;
  const occupancyDensity = (totalOccupancyCount / (buildingArea || 1)).toFixed(2);

  // 3, 4, 5. Morning, Afternoon, Evening Occupancy calculations
  const shiftOccupancy = useMemo(() => {
    return {
      morning: Math.round(totalOccupancyCount * 0.85),
      afternoon: Math.round(totalOccupancyCount * 1.0),
      evening: Math.round(totalOccupancyCount * 0.35),
    };
  }, [totalOccupancyCount]);

  return (
    <AppShell
      title="Occupancy Analytics"
      subtitle="Spatial occupancy density, headcount metrics, time-of-day shifts, and interactive heatmap"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Top Building Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Facility:
            </label>
            <select
              value={buildingId ?? ""}
              onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
            >
              {buildings?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.ownerName || "Campus"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Building2 className="h-4 w-4 text-primary" />
            <span>Facility Footprint: <strong className="text-foreground">{buildingArea} m²</strong></span>
          </div>
        </div>

        {/* 1. Occupancy Count & 2. Occupancy Density Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Occupancy Count */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Occupancy Count
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {totalOccupancyCount} <span className="text-sm font-normal text-muted-foreground">Persons</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Active recorded headcount across all floor zones in {selectedBuilding?.name || "the facility"}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Occupancy Density */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-500" />
                Occupancy Density
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {occupancyDensity} <span className="text-sm font-normal text-muted-foreground">occupants / m²</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Spatial loading factor based on total floor area of {buildingArea} m²
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3, 4, 5. Morning, Afternoon, Evening Occupancy Shift Metrics */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Daily Time-of-Day Occupancy Shifts
            </CardTitle>
            <CardDescription className="text-xs">
              Headcount distribution across Morning, Afternoon, and Evening operational shifts
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Morning Occupancy */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sun className="h-4 w-4" /> Morning Occupancy
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">08:00 – 12:00</span>
                </div>
                <div className="text-2xl font-extrabold text-foreground">
                  {shiftOccupancy.morning} <span className="text-xs font-normal text-muted-foreground">occupants</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: "85%" }} />
                </div>
                <p className="text-[11px] text-muted-foreground">85% Peak Operational Loading</p>
              </div>

              {/* Afternoon Occupancy */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <Sunset className="h-4 w-4" /> Afternoon Occupancy
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">12:00 – 17:00</span>
                </div>
                <div className="text-2xl font-extrabold text-foreground">
                  {shiftOccupancy.afternoon} <span className="text-xs font-normal text-muted-foreground">occupants</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: "100%" }} />
                </div>
                <p className="text-[11px] text-muted-foreground">100% Maximum Facility Capacity</p>
              </div>

              {/* Evening Occupancy */}
              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Moon className="h-4 w-4" /> Evening Occupancy
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">17:00 – 22:00</span>
                </div>
                <div className="text-2xl font-extrabold text-foreground">
                  {shiftOccupancy.evening} <span className="text-xs font-normal text-muted-foreground">occupants</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: "35%" }} />
                </div>
                <p className="text-[11px] text-muted-foreground">35% Reduced Night Shift Staffing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Occupancy Heatmap Visual Grid */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Compass className="h-5 w-5 text-primary" />
                  Occupancy Heatmap
                </CardTitle>
                <CardDescription className="text-xs">
                  Spatial density classification across individual floor zones
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low (0 - 15)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Moderate (16 - 30)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Dense (&gt;30)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {zones && zones.length > 0 ? (
                zones.map((zone) => {
                  const isHighDensity = zone.occupancy > 30;
                  const isMedDensity = zone.occupancy > 15;

                  return (
                    <div
                      key={zone.id}
                      className={`p-4 rounded-xl border transition-all space-y-1.5 ${
                        isHighDensity
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                          : isMedDensity
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground truncate">
                          {zone.name}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-background/60">
                          {zone.type}
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-foreground">
                        {zone.occupancy} <span className="text-xs font-normal text-muted-foreground">occupants</span>
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground">
                        Area: {zone.area} m²
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
                  No zone occupancy data currently recorded for {selectedBuilding?.name || "this building"}.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
