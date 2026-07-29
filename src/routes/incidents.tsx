import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useMemo } from "react";
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  BarChart3,
  Activity,
} from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { db, logActivity } from "@/lib/db";
import { seedAllModules } from "@/lib/seed";


export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Fire Incidents — WB-FDVA" },
      { name: "description", content: "Simulate, monitor, and resolve fire incidents." },
    ],
  }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const [bId, setBId] = useState<number | null>(null);
  useEffect(() => {
    if (!bId && buildings?.length) setBId(buildings[0].id!);
  }, [buildings, bId]);

  const floors = useLiveQuery(
    () =>
      bId
        ? db.floors.where("buildingId").equals(bId).sortBy("level")
        : Promise.resolve([] as any[]),
    [bId],
  );
  const [fId, setFId] = useState<number | null>(null);
  useEffect(() => {
    if (floors?.length) setFId(floors[0].id!);
  }, [floors]);

  const zones = useLiveQuery(
    () => (fId ? db.zones.where("floorId").equals(fId).toArray() : Promise.resolve([] as any[])),
    [fId],
  );
  const [zId, setZId] = useState<number | null>(null);
  useEffect(() => {
    if (zones?.length) setZId(zones[0].id!);
  }, [zones]);

  const incidents = useLiveQuery(() => db.incidents.orderBy("startedAt").reverse().toArray(), []);

  useEffect(() => {
    if (incidents !== undefined && incidents.length === 0) {
      console.log("[WB-FDVA] Incidents table empty. Auto-seeding all modules...");
      seedAllModules().catch((err) => console.error("Incidents seed error:", err));
    }
  }, [incidents]);


  // For mapping names dynamically
  const allFloors = useLiveQuery(() => db.floors.toArray(), []);
  const allZones = useLiveQuery(() => db.zones.toArray(), []);

  const startIncident = async () => {
    if (!bId || !fId || !zId) return;
    const id = `INC-${Date.now().toString().slice(-7)}`;
    await db.incidents.add({
      incidentId: id,
      buildingId: bId,
      floorId: fId,
      zoneId: zId,
      sensorId: `SNS-${Math.floor(Math.random() * 900 + 100)}`,
      startedAt: Date.now(),
      status: "active",
    });
    await logActivity("incident", `Incident ${id} reported — vulnerability assessment triggered`);
  };

  const active = (incidents ?? []).filter((i) => i.status === "active");
  const resolved = (incidents ?? []).filter((i) => i.status === "resolved");

  // Heat map logic (GitHub style)
  const heatMapDays = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 364); // 365 days
    const days = eachDayOfInterval({ start, end });

    const incidentCounts = (incidents ?? []).reduce(
      (acc, inc) => {
        const dayStr = format(startOfDay(new Date(inc.startedAt)), "yyyy-MM-dd");
        acc[dayStr] = (acc[dayStr] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return days.map((d) => ({
      date: d,
      dayStr: format(d, "yyyy-MM-dd"),
      count: incidentCounts[format(d, "yyyy-MM-dd")] || 0,
    }));
  }, [incidents]);

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const selectedDateIncidents = useMemo(() => {
    if (!selectedDateStr) return [];
    return (incidents ?? []).filter((inc) => {
      const dayStr = format(startOfDay(new Date(inc.startedAt)), "yyyy-MM-dd");
      return dayStr === selectedDateStr;
    });
  }, [incidents, selectedDateStr]);

  // Group heatmap days by weeks (rows = Sunday to Saturday)
  const weeks = useMemo(() => {
    const wks: (typeof heatMapDays)[] = [];
    let currentWeek: typeof heatMapDays = [];

    const firstDayOfWeek = heatMapDays[0].date.getDay(); // 0 = Sunday
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: new Date(0), dayStr: "", count: -1 });
    }

    heatMapDays.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        wks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      wks.push(currentWeek);
    }
    return wks;
  }, [heatMapDays]);

  const monthLabels = useMemo(() => {
    const labels: { text: string; index: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const firstValidDay = week.find((d) => d.count !== -1);
      if (firstValidDay) {
        const month = firstValidDay.date.getMonth();
        if (month !== lastMonth) {
          labels.push({ text: format(firstValidDay.date, "MMM"), index: wi });
          lastMonth = month;
        }
      }
    });
    return labels;
  }, [weeks]);

  // Streak & Summary stats
  const stats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    const total = incidents?.length || 0;

    const totalThisYear = (incidents ?? []).filter((inc) => {
      return new Date(inc.startedAt).getFullYear() === currentYear;
    }).length;

    const incidentCountsByDay = (incidents ?? []).reduce(
      (acc, inc) => {
        const dayStr = format(startOfDay(new Date(inc.startedAt)), "yyyy-MM-dd");
        acc[dayStr] = (acc[dayStr] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Longest Streak
    let longestStreak = 0;
    let tempStreak = 0;
    heatMapDays.forEach((day) => {
      if (day.count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });

    // Current Streak
    let currentStreak = 0;
    const todayStr = format(now, "yyyy-MM-dd");
    const yesterday = subDays(now, 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");

    let checkDate: Date | null = now;
    if (incidentCountsByDay[todayStr] > 0) {
      checkDate = now;
    } else if (incidentCountsByDay[yesterdayStr] > 0) {
      checkDate = yesterday;
    } else {
      checkDate = null;
    }

    if (checkDate) {
      let d = checkDate;
      while (true) {
        const dStr = format(d, "yyyy-MM-dd");
        if (incidentCountsByDay[dStr] > 0) {
          currentStreak++;
          d = subDays(d, 1);
        } else {
          break;
        }
      }
    }

    // Most Active Month
    const monthCounts = (incidents ?? []).reduce(
      (acc, inc) => {
        const monthStr = format(new Date(inc.startedAt), "MMMM yyyy");
        acc[monthStr] = (acc[monthStr] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    let mostActiveMonth = "N/A";
    let maxMonthCount = 0;
    Object.entries(monthCounts).forEach(([month, count]) => {
      if (count > maxMonthCount) {
        maxMonthCount = count;
        mostActiveMonth = `${month} (${count} incident${count > 1 ? "s" : ""})`;
      }
    });

    return {
      total,
      totalThisYear,
      longestStreak,
      currentStreak,
      mostActiveMonth,
    };
  }, [heatMapDays, incidents]);

  return (
    <AppShell title="Fire Incidents" subtitle="Simulate and manage active fire events">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Sim Panel */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" /> New Incident
          </h3>
          <label className="text-xs block">
            <span className="block text-muted-foreground mb-1">Building</span>
            <select
              className="input w-full"
              value={bId ?? ""}
              onChange={(e) => setBId(+e.target.value)}
            >
              {buildings?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs block">
            <span className="block text-muted-foreground mb-1">Floor</span>
            <select
              className="input w-full"
              value={fId ?? ""}
              onChange={(e) => setFId(+e.target.value)}
            >
              {floors?.map((f) => (
                <option key={f.id} value={f.id}>
                  L{f.level} · {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs block">
            <span className="block text-muted-foreground mb-1">Zone</span>
            <select
              className="input w-full"
              value={zId ?? ""}
              onChange={(e) => setZId(+e.target.value)}
            >
              {zones?.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneId} · {z.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={startIncident}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            <Flame className="h-4 w-4" /> Start Incident
          </button>
        </div>

        {/* Incidents List & History */}
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="rounded-lg border border-risk-red/40 bg-risk-red/10 p-4">
              <div className="flex items-center gap-2 text-risk-red font-bold uppercase text-xs tracking-wider">
                <AlertTriangle className="h-4 w-4 animate-pulse" /> {active.length} Active Incident
                {active.length > 1 ? "s" : ""}
              </div>
              <ul className="mt-3 space-y-2">
                {active.map((i) => {
                  const b = buildings?.find((x) => x.id === i.buildingId);
                  return (
                    <li
                      key={i.id}
                      className="flex items-center justify-between rounded-md bg-card/60 p-3 text-sm"
                    >
                      <div>
                        <div className="font-semibold">{i.incidentId}</div>
                        <div className="text-xs text-muted-foreground">
                          {b?.name} · Sensor {i.sensorId} · {new Date(i.startedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to="/commander"
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Commander <ArrowRight className="h-3 w-3" />
                        </Link>
                        <button
                          onClick={async () => {
                            await db.incidents.update(i.id!, {
                              status: "resolved",
                              resolvedAt: Date.now(),
                            });
                            await logActivity("incident", `Resolved ${i.incidentId}`);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Resolve
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">
              Incident History
            </div>
            <ul className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {resolved.map((i) => {
                const b = buildings?.find((x) => x.id === i.buildingId);
                return (
                  <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs">{i.incidentId}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {b?.name} · {new Date(i.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-risk-green">
                      Resolved
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* GitHub-style Calendar Heat Map Section */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Incident Activity Heat Map
        </h3>

        {/* Heat Map grid */}
        <div className="overflow-x-auto pb-2">
          <div className="relative mb-2 h-4 text-[9px] text-muted-foreground min-w-max">
            {monthLabels.map((lbl, li) => (
              <span key={li} className="absolute" style={{ left: `${lbl.index * 16 + 32}px` }}>
                {lbl.text}
              </span>
            ))}
          </div>
          <div className="flex gap-1 min-w-max">
            {/* Weekday labels */}
            <div className="flex flex-col gap-1 text-[9px] text-muted-foreground pr-2 justify-between h-[104px] pt-1">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>
            {/* Columns */}
            <div className="flex gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day, di) => {
                    if (day.count === -1)
                      return <div key={di} className="w-3 h-3 rounded-sm bg-transparent" />;

                    // Specific Color Intensity Logic
                    // No incidents = Dark background
                    // 1 incident = Light green
                    // 2-3 incidents = Medium green
                    // 4 or more incidents = Dark green
                    let bgColor = "bg-[#161b22]";
                    if (day.count === 1) bgColor = "bg-[#9be9a8]";
                    else if (day.count >= 2 && day.count <= 3) bgColor = "bg-[#40c463]";
                    else if (day.count >= 4) bgColor = "bg-[#216e39]";

                    const isSelected = selectedDateStr === day.dayStr;

                    return (
                      <button
                        key={day.dayStr}
                        onClick={() => setSelectedDateStr(isSelected ? null : day.dayStr)}
                        title={`${day.dayStr}: ${day.count} incident${day.count !== 1 ? "s" : ""}`}
                        className={`w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-primary ${bgColor} ${isSelected ? "ring-2 ring-primary scale-110" : ""}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-[#161b22] border border-border" />
            <div className="w-3 h-3 rounded-sm bg-[#9be9a8]" />
            <div className="w-3 h-3 rounded-sm bg-[#40c463]" />
            <div className="w-3 h-3 rounded-sm bg-[#216e39]" />
            <span>More</span>
          </div>
          {selectedDateStr && (
            <button
              onClick={() => setSelectedDateStr(null)}
              className="text-primary hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Selected day details */}
        {selectedDateStr && (
          <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
            <h4 className="text-xs font-semibold mb-3 text-foreground">
              Incidents on {format(new Date(selectedDateStr), "MMMM d, yyyy")}
            </h4>
            {selectedDateIncidents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No incidents occurred on this day.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Incident ID</th>
                      <th className="px-3 py-2">Building</th>
                      <th className="px-3 py-2">Floor</th>
                      <th className="px-3 py-2">Zone</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedDateIncidents.map((i) => {
                      const b = buildings?.find((x) => x.id === i.buildingId);
                      const f = allFloors?.find((x) => x.id === i.floorId);
                      const z = allZones?.find((x) => x.id === i.zoneId);
                      return (
                        <tr key={i.id} className="hover:bg-secondary/40">
                          <td className="px-3 py-2 font-mono font-bold text-primary">
                            {i.incidentId}
                          </td>
                          <td className="px-3 py-2">{b?.name || "Unknown"}</td>
                          <td className="px-3 py-2">
                            L{f?.level} - {f?.name || "Unknown"}
                          </td>
                          <td className="px-3 py-2">
                            {z?.zoneId} - {z?.name || "Unknown"}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {new Date(i.startedAt).toLocaleTimeString()}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                i.status === "active"
                                  ? "bg-risk-red/15 text-risk-red"
                                  : "bg-risk-green/15 text-risk-green"
                              }`}
                            >
                              {i.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Summary Statistics */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5 text-center">
          <div className="rounded-lg bg-secondary/30 p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Total Incidents
            </div>
            <div className="text-xl font-black font-mono text-foreground">{stats.total}</div>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Current Streak
            </div>
            <div className="text-xl font-black font-mono text-foreground">
              {stats.currentStreak}{" "}
              <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Longest Streak
            </div>
            <div className="text-xl font-black font-mono text-foreground">
              {stats.longestStreak}{" "}
              <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Most Active Month
            </div>
            <div className="text-sm font-black text-foreground pt-1 truncate">
              {stats.mostActiveMonth}
            </div>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Incidents This Year
            </div>
            <div className="text-xl font-black font-mono text-foreground">
              {stats.totalThisYear}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
