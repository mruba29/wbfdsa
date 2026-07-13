import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { db, type Building } from "@/lib/db";
import { assessBuilding, RISK_COLORS } from "@/lib/vulnerability";
import { RiskBadge } from "@/components/risk-badge";
import {
  Building2,
  Flame,
  Users,
  ShieldAlert,
  Gauge,
  ArrowRight,
  Activity,
  Calculator,
  HeartPulse,
  UserMinus,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  Layers,
  Package,
  CheckCircle,
  XCircle,
  CloudFog,
  Zap,
  Fuel,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — WB-FDVA" },
      {
        name: "description",
        content:
          "Executive view of buildings, incidents, occupancy, and vulnerability across your portfolio.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  // Tabs state: "executive" (original dashboard) or "vulnerability" (vulnerability assessment page)
  const [activeTab, setActiveTab] = useState<"executive" | "vulnerability">("executive");

  // Query database
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const floors = useLiveQuery(() => db.floors.toArray(), []);
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const incidents = useLiveQuery(() => db.incidents.orderBy("startedAt").reverse().toArray(), []);
  const activity = useLiveQuery(
    () => db.activity.orderBy("timestamp").reverse().limit(10).toArray(),
    [],
  );
  const fireInventory = useLiveQuery(() => db.fireInventory.toArray(), []);

  const totalOccupants = zones?.reduce((s, z) => s + z.occupancy, 0) ?? 0;
  const activeIncidents = incidents?.filter((i) => i.status === "active") ?? [];

  // Fire Inventory KPIs
  const totalFireInventory = fireInventory?.length ?? 0;
  const activeFireInventory = fireInventory?.filter((i) => {
    // Check if expired
    const isExpired = new Date() > new Date(i.expiryDate);
    // Logic: if today is before expiry date and status was marked Active (or simply calculate on the fly as requested)
    return !isExpired && i.status !== "Under Maintenance";
  }).length ?? 0;
  const expiredFireInventory = fireInventory?.filter((i) => {
    return new Date() > new Date(i.expiryDate) || i.status === "Expired";
  }).length ?? 0;

  const allImpacts = useMemo(() => {
    if (!buildings || !floors || !zones) return [];
    return buildings.flatMap((b) => {
      const bFloors = floors.filter((f) => f.buildingId === b.id);
      const bZones = zones.filter((z) => z.buildingId === b.id);
      const incident = activeIncidents.find((i) => i.buildingId === b.id);
      const incFloor = incident
        ? (bFloors.find((f) => f.id === incident.floorId)?.level ?? null)
        : null;
      return assessBuilding(bZones, bFloors, incFloor);
    });
  }, [buildings, floors, zones, activeIncidents]);

  const criticalZones = allImpacts.filter((z) => z.risk === "RED").length;
  const avgVuln = allImpacts.length
    ? Math.round(allImpacts.reduce((s, z) => s + z.breakdown.total, 0) / allImpacts.length)
    : 0;

  const occupancyTrend = Array.from({ length: 12 }, (_, i) => ({
    hour: `${i * 2}:00`,
    occupants: Math.round(totalOccupants * (0.4 + 0.6 * Math.sin((i / 12) * Math.PI))),
  }));

  const incidentTrend = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.now() - (6 - i) * 86400000);
    const count =
      incidents?.filter((inc) => new Date(inc.startedAt).toDateString() === day.toDateString())
        .length ?? 0;
    return { day: day.toLocaleDateString(undefined, { weekday: "short" }), count };
  });

  const riskDist = [
    {
      name: "Critical",
      value: allImpacts.filter((z) => z.risk === "RED").length,
      color: "var(--risk-red)",
    },
    {
      name: "High",
      value: allImpacts.filter((z) => z.risk === "ORANGE").length,
      color: "var(--risk-orange)",
    },
    {
      name: "Elevated",
      value: allImpacts.filter((z) => z.risk === "YELLOW").length,
      color: "var(--risk-yellow)",
    },
    {
      name: "Normal",
      value: allImpacts.filter((z) => z.risk === "SAFE").length,
      color: "var(--risk-green)",
    },
  ];

  // TAB 2: Vulnerability Profile specific states
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

  // Set default building for vulnerability profile tab
  useEffect(() => {
    if (!selectedBuildingId && buildings?.length) {
      setSelectedBuildingId(buildings[0].id!);
    }
  }, [buildings, selectedBuildingId]);

  const activeBuilding = buildings?.find((b) => b.id === selectedBuildingId);

  const selectedBuildingFloors = useMemo(() => {
    if (!selectedBuildingId || !floors) return [];
    return floors
      .filter((f) => f.buildingId === selectedBuildingId)
      .sort((a, b) => a.level - b.level);
  }, [floors, selectedBuildingId]);

  const selectedBuildingZones = useMemo(() => {
    if (!selectedBuildingId || !zones) return [];
    return zones.filter((z) => z.buildingId === selectedBuildingId);
  }, [zones, selectedBuildingId]);

  const selectedBuildingActiveIncident = useMemo(() => {
    if (!selectedBuildingId || !activeIncidents) return null;
    return activeIncidents.find((i) => i.buildingId === selectedBuildingId) || null;
  }, [activeIncidents, selectedBuildingId]);

  const selectedBuildingIncidentFloorLevel = useMemo(() => {
    if (!selectedBuildingActiveIncident || !selectedBuildingFloors) return null;
    return (
      selectedBuildingFloors.find((f) => f.id === selectedBuildingActiveIncident.floorId)?.level ??
      null
    );
  }, [selectedBuildingActiveIncident, selectedBuildingFloors]);

  // Checklist status for active building to scale risk
  const activeBuildingComplianceMultiplier = useMemo(() => {
    if (!selectedBuildingId) return 1.0;
    const saved = localStorage.getItem(`wb-checklist-status-${selectedBuildingId}`);
    if (saved) {
      try {
        const checklist = JSON.parse(saved);
        const total = 18; // total standard checklist items
        const passed = Object.values(checklist).filter((s) => s === "PASS").length;
        const percentage = Math.round((passed / total) * 100);
        return 1.2 - (percentage / 100) * 0.4; // 0.8x to 1.2x multiplier
      } catch {
        return 1.0;
      }
    }
    return 1.0;
  }, [selectedBuildingId]);

  const selectedBuildingImpacts = useMemo(() => {
    if (selectedBuildingZones.length === 0 || selectedBuildingFloors.length === 0) return [];
    return assessBuilding(
      selectedBuildingZones,
      selectedBuildingFloors,
      selectedBuildingIncidentFloorLevel,
    ).sort((a, b) => b.breakdown.total - a.breakdown.total);
  }, [selectedBuildingZones, selectedBuildingFloors, selectedBuildingIncidentFloorLevel]);

  const selectedBuildingTotalImpact = useMemo(() => {
    const base = selectedBuildingImpacts.reduce((s, i) => s + i.breakdown.total, 0);
    return base * activeBuildingComplianceMultiplier;
  }, [selectedBuildingImpacts, activeBuildingComplianceMultiplier]);

  const selectedBuildingCriticalCount = selectedBuildingImpacts.filter(
    (i) => i.risk === "RED",
  ).length;

  const selectedBuildingPvi = useMemo(() => {
    const patients = selectedBuildingZones.reduce((s, z) => s + z.occupancy, 0) || 0;
    return {
      total: patients,
      icu: Math.floor(patients * 0.1),
      critical: Math.floor(patients * 0.05),
      disabled: selectedBuildingZones.reduce((s, z) => s + z.specialNeeds, 0) || 0,
      elderly: Math.floor(patients * 0.15),
      score: Math.min(
        100,
        Math.floor((selectedBuildingTotalImpact / (selectedBuildingZones.length || 1)) * 1.3),
      ),
    };
  }, [selectedBuildingZones, selectedBuildingTotalImpact]);

  const getRiskLabel = (score: number) => {
    if (score > 80) return { label: "Critical", color: "text-risk-red", bg: "bg-risk-red" };
    if (score > 60) return { label: "High", color: "text-risk-orange", bg: "bg-risk-orange" };
    if (score > 30) return { label: "Medium", color: "text-risk-yellow", bg: "bg-risk-yellow" };
    return { label: "Low", color: "text-risk-green", bg: "bg-risk-green" };
  };

  const pviRisk = getRiskLabel(selectedBuildingPvi.score);

  return (
    <AppShell
      title="Operations Dashboard"
      subtitle="Real-time portfolio readiness and incident status"
      actions={
        <div className="flex gap-2">
          {activeTab === "vulnerability" && (
            <select
              className="h-9 rounded-md border border-border bg-secondary px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedBuildingId ?? ""}
              onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
            >
              <option value="" disabled>
                Select building
              </option>
              {buildings?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.ownerName ? `(${b.ownerName})` : ""}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/commander"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Commander View <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    >
      {/* HORIZONTAL TABS IN MAIN SCREEN */}
      <div className="flex border-b border-border mb-6 overflow-x-auto scrollbar-none gap-4 text-xs font-semibold px-2">
        <button
          onClick={() => setActiveTab("executive")}
          className={`flex items-center gap-2 px-4 py-3 transition-all relative shrink-0 rounded-t-lg ${
            activeTab === "executive"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Executive Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab("vulnerability")}
          className={`flex items-center gap-2 px-4 py-3 transition-all relative shrink-0 rounded-t-lg ${
            activeTab === "vulnerability"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Vulnerability Assessment</span>
        </button>
      </div>

      {/* TAB 1: EXECUTIVE VIEW */}
      {activeTab === "executive" && (
        <div className="space-y-6">
          {/* Executive KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard label="Total Buildings" value={buildings?.length ?? 0} icon={Building2} />
            <KpiCard
              label="Active Incidents"
              value={activeIncidents.length}
              icon={Flame}
              tone={activeIncidents.length ? "danger" : "success"}
            />
            <KpiCard label="CAD Files" value={(buildings?.length ?? 0) * 3} icon={Building2} />
            <KpiCard label="Total Occupants" value={totalOccupants.toLocaleString()} icon={Users} />
            <KpiCard
              label="Critical Buildings"
              value={criticalZones > 0 ? 1 : 0}
              icon={ShieldAlert}
              tone={criticalZones ? "danger" : "default"}
            />
            <KpiCard
              label="Avg Vulnerability"
              value={avgVuln}
              icon={Gauge}
              tone={avgVuln > 50 ? "warn" : "default"}
            />
            <Link to="/fire-inventory" className="block">
              <KpiCard 
                label="Total Fire Inventory" 
                value={totalFireInventory} 
                icon={Package} 
              />
            </Link>
            <Link to="/fire-inventory" search={{ filter: 'active' }} className="block">
              <KpiCard 
                label="Active Fire Inventory" 
                value={activeFireInventory} 
                icon={CheckCircle}
                tone="success"
              />
            </Link>
            <Link to="/fire-inventory" search={{ filter: 'expired' }} className="block">
              <KpiCard 
                label="Expired Fire Inventory" 
                value={expiredFireInventory} 
                icon={XCircle}
                tone="danger"
              />
            </Link>
          </div>

          {/* IoT Emergency Alerts */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-risk-green animate-pulse" />
                IoT Emergency Alerts
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                <Activity className="h-3.5 w-3.5" />
                Future IoT Sensor Integration Ready
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* CARD 1: Fire Alert */}
              <div className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-risk-red/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-red/80 to-risk-red/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-red/15 text-risk-red shadow-inner">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Alert</div>
                      <div className="font-bold text-foreground">Fire Alert</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-red/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-red border border-risk-red/20 animate-pulse">
                    Critical
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-muted-foreground">Building:</div>
                  <div className="font-semibold text-right text-foreground">Building A</div>
                  <div className="text-muted-foreground">Location:</div>
                  <div className="font-semibold text-right text-foreground">Flr 3, Zone Z4</div>
                  <div className="text-muted-foreground mt-2">Detected:</div>
                  <div className="font-mono font-medium text-right mt-2 text-risk-red">10:42 AM</div>
                </div>
              </div>

              {/* CARD 2: Smoke Alert */}
              <div className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-blue-400/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400/80 to-blue-400/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 shadow-inner">
                      <CloudFog className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Air Quality</div>
                      <div className="font-bold text-foreground">Smoke Alert</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-green border border-risk-green/20">
                    Normal
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-muted-foreground">Building:</div>
                  <div className="font-semibold text-right text-foreground">Building B</div>
                  <div className="text-muted-foreground">Location:</div>
                  <div className="font-semibold text-right text-foreground">Flr 2, Zone A1</div>
                  <div className="text-muted-foreground mt-2">Density:</div>
                  <div className="font-mono font-medium text-right mt-2 text-blue-400">12 AQI</div>
                </div>
              </div>

              {/* CARD 3: Electrical Short Circuit */}
              <div className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-risk-yellow/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-yellow/80 to-risk-yellow/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-yellow/15 text-risk-yellow shadow-inner">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Power Grid</div>
                      <div className="font-bold text-foreground truncate max-w-[100px]" title="Electrical Fault">Electrical Fault</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-yellow border border-risk-yellow/20">
                    Warning
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-muted-foreground">Building:</div>
                  <div className="font-semibold text-right text-foreground">Building C</div>
                  <div className="text-muted-foreground">Location:</div>
                  <div className="font-semibold text-right text-foreground">Flr 1, Panel E-12</div>
                  <div className="text-muted-foreground mt-2">Detected:</div>
                  <div className="font-mono font-medium text-right mt-2 text-risk-yellow">10:15 AM</div>
                </div>
              </div>

              {/* CARD 4: Gas Leak Alert */}
              <div className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-risk-orange/40 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-orange/80 to-risk-orange/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-orange/15 text-risk-orange shadow-inner">
                      <Fuel className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gas Monitor</div>
                      <div className="font-bold text-foreground">Gas Leak</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-orange/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-orange border border-risk-orange/20">
                    High
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div className="text-muted-foreground">Building:</div>
                  <div className="font-semibold text-right text-foreground">Building A</div>
                  <div className="text-muted-foreground">Location:</div>
                  <div className="font-semibold text-right text-foreground">Zone G2</div>
                  <div className="text-muted-foreground mt-2">Concentration:</div>
                  <div className="font-mono font-medium text-right mt-2 text-risk-orange">450 ppm</div>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Vulnerability Trends (Past 6 Months)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={Array.from({ length: 6 }, (_, i) => ({
                    month: new Date(
                      new Date().setMonth(new Date().getMonth() - (5 - i)),
                    ).toLocaleString("default", { month: "short" }),
                    score: 45 + Math.random() * 20,
                  }))}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Building Category Distribution">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={
                    buildings?.reduce((acc: any[], b) => {
                      const existing = acc.find((x) => x.category === b.type);
                      if (existing) existing.count++;
                      else acc.push({ category: b.type, count: 1 });
                      return acc;
                    }, []) || []
                  }
                >
                  <XAxis
                    dataKey="category"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Occupancy Trend (24h)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={occupancyTrend}>
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="occupants"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Incidents (7 days)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={incidentTrend}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Zone Risk Distribution">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={riskDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {riskDist.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground">
                {riskDist.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                    {d.name} · {d.value}
                  </span>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="border-b border-border/60 px-5 py-4 bg-secondary/30">
              <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Activity className="h-4 w-4" /> Recent Activity
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {(activity ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${a.kind === "incident" ? "bg-risk-red" : a.kind === "occupancy" ? "bg-risk-orange" : a.kind === "building" ? "bg-chart-4" : "bg-muted-foreground"}`}
                    />
                    <span className="truncate">{a.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-3">
                    {new Date(a.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
              {(activity ?? []).length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No activity yet
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: VULNERABILITY ASSESSMENT VIEW */}
      {activeTab === "vulnerability" && (
        <div className="space-y-6">
          {/* Header Status Bar */}
          {selectedBuildingId && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-card/60 rounded-lg border border-border shadow-sm">
              <div className="text-xs text-muted-foreground">
                Currently profiling:{" "}
                <strong className="text-foreground">{activeBuilding?.name}</strong>
              </div>
              {selectedBuildingActiveIncident ? (
                <div className="text-xs text-risk-red flex items-center gap-2 px-2.5 py-1.5 rounded bg-risk-red/10 border border-risk-red/20 font-bold animate-pulse">
                  <ShieldAlert className="h-3.5 w-3.5" /> Active incident{" "}
                  {selectedBuildingActiveIncident.incidentId} on Level{" "}
                  {selectedBuildingIncidentFloorLevel}
                </div>
              ) : (
                <div className="text-xs text-risk-green flex items-center gap-1.5 bg-risk-green/10 text-risk-green px-2.5 py-1.5 rounded border border-risk-green/20 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No Active Incident
                </div>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiBlock
              label="Total Impact Score"
              value={Math.round(selectedBuildingTotalImpact).toLocaleString()}
              icon={Gauge}
              tone={
                selectedBuildingTotalImpact > 800
                  ? "danger"
                  : selectedBuildingTotalImpact > 400
                    ? "warn"
                    : "default"
              }
              description="Calibrated by safety checklist compliance."
            />
            <KpiBlock
              label="Critical Risk Zones"
              value={selectedBuildingCriticalCount}
              icon={ShieldAlert}
              tone={selectedBuildingCriticalCount ? "danger" : "default"}
              description="Zones evaluated with critical safety hazards."
            />
            <KpiBlock
              label="Total Assessed Zones"
              value={selectedBuildingImpacts.length}
              icon={Layers}
              description="Registered floor zones in this building."
            />
          </div>

          {/* PVI */}
          <Card className="border-l-4 border-l-blue-500 bg-card/60 shadow-sm backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <HeartPulse className="h-5 w-5 text-blue-400" /> Patient Vulnerability Index (PVI)
              </CardTitle>
              <CardDescription className="text-xs">
                Evacuation difficulty demographics weighted risk score.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="col-span-2 md:col-span-1 rounded-lg border border-border bg-secondary/80 p-3.5 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                    PVI Score
                  </div>
                  <div className={`text-3xl font-black ${pviRisk.color}`}>
                    {selectedBuildingPvi.score}
                  </div>
                  <div
                    className={`mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${pviRisk.bg}/10 ${pviRisk.color} border border-${pviRisk.bg}/20`}
                  >
                    {pviRisk.label}
                  </div>
                </div>
                <PviStatItem
                  label="Total Occupants"
                  value={selectedBuildingPvi.total}
                  icon={Users}
                  color="var(--chart-2)"
                />
                <PviStatItem
                  label="ICU Patients"
                  value={selectedBuildingPvi.icu}
                  icon={Activity}
                  color="var(--risk-red)"
                />
                <PviStatItem
                  label="Critical Care"
                  value={selectedBuildingPvi.critical}
                  icon={ShieldAlert}
                  color="var(--risk-orange)"
                />
                <PviStatItem
                  label="Special Needs"
                  value={selectedBuildingPvi.disabled}
                  icon={UserMinus}
                  color="var(--risk-yellow)"
                />
                <PviStatItem
                  label="Elderly / Kids"
                  value={selectedBuildingPvi.elderly}
                  icon={UserCheck}
                  color="var(--chart-4)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Formula Accordion */}
          <Accordion
            type="single"
            collapsible
            className="w-full border border-border rounded-lg bg-card/60 overflow-hidden"
          >
            <AccordionItem value="formula" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:bg-secondary/40 hover:no-underline rounded-lg">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Calculator className="h-4 w-4 text-primary" /> Model Formula Breakdown
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t border-border bg-card/30 pt-3 text-xs">
                <div className="rounded-md bg-secondary/80 p-3.5 border border-border shadow-inner font-mono text-xs font-bold flex flex-wrap items-center gap-2">
                  <span className="text-foreground">Risk Score</span>
                  <span>=</span>
                  <span className="text-blue-400">
                    (Fire Load × Occ Density × Exposure × Evac Difficulty)
                  </span>
                  <span>÷</span>
                  <span className="text-risk-green">(Protection Systems × Exit Capacity)</span>
                  <span className="text-muted-foreground">×</span>
                  <span className="text-risk-orange">
                    Compliance Multiplier ({activeBuildingComplianceMultiplier.toFixed(2)}x)
                  </span>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Dual Tables for Floors & Zones */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* FLVI */}
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden flex flex-col shadow-sm">
              <div className="border-b border-border/60 px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30">
                Floor-Level Index (FLVI)
              </div>
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-md z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left">Level</th>
                      <th className="px-4 py-3 text-right">Occupancy</th>
                      <th className="px-4 py-3 text-right">Exits Available</th>
                      <th className="px-4 py-3 text-right">FLVI Score</th>
                      <th className="px-4 py-3 text-left">Indicator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {selectedBuildingFloors.map((f) => {
                      const fZones = selectedBuildingZones.filter((z) => z.floorId === f.id);
                      const fOcc = fZones.reduce((s, z) => s + z.occupancy, 0);
                      const fLoad = 250 + ((f.level * 45) % 300);
                      const score = Math.round(
                        ((fOcc * fLoad) / (f.availableExits || 1) / 100) *
                          activeBuildingComplianceMultiplier,
                      );
                      const risk = getRiskLabel(score);

                      return (
                        <tr key={f.id} className="hover:bg-muted/80 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold">
                            L{f.level} — {f.name}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">{fOcc}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {f.availableExits}/{f.totalExits}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${risk.color}`}>
                            {score}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${risk.bg}/10 ${risk.color} border border-${risk.bg}/20`}
                            >
                              {risk.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedBuildingFloors.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          No floors configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Zone Rankings */}
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden flex flex-col shadow-sm">
              <div className="border-b border-border/60 px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30">
                Zone Vulnerability Ranking
              </div>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 backdrop-blur-md z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left">Zone ID</th>
                      <th className="px-4 py-3 text-left">Floor</th>
                      <th className="px-4 py-3 text-right">Occupants</th>
                      <th className="px-4 py-3 text-right">Impact Score</th>
                      <th className="px-4 py-3 text-left">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {selectedBuildingImpacts.map((i) => (
                      <tr key={i.zone.id} className="hover:bg-muted/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold">{i.zone.zoneId}</td>
                        <td className="px-4 py-3 text-xs">Level {i.floor.level}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {i.zone.occupancy}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-mono font-bold"
                          style={{ color: RISK_COLORS[i.risk] }}
                        >
                          {Math.round(i.breakdown.total * activeBuildingComplianceMultiplier)}
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge level={i.risk} />
                        </td>
                      </tr>
                    ))}
                    {selectedBuildingImpacts.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          No zones configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm transition-all hover:shadow-lg">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function KpiBlock({
  label,
  value,
  icon: Icon,
  tone = "default",
  description,
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: "default" | "danger" | "warn";
  description?: string;
}) {
  const colors = {
    default: "text-foreground",
    danger: "text-risk-red",
    warn: "text-risk-orange",
  } as any;
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          {label}
        </div>
        <Icon className={`h-4 w-4 ${colors[tone]}`} />
      </div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${colors[tone]} font-mono`}>
        {value}
      </div>
      {description && <div className="mt-1 text-[10px] text-muted-foreground">{description}</div>}
    </div>
  );
}

function PviStatItem({ label, value, icon: Icon, color }: any) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3 flex flex-col items-center justify-center text-center shadow-sm">
      <Icon className="h-4 w-4 mb-2" style={{ color }} />
      <div className="text-xl font-black font-mono text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-1.5">
        {label}
      </div>
    </div>
  );
}
