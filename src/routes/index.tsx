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
  X,
  MapPin,
  Clock,
  Settings,
  TrendingUp,
  TrendingDown,
  ArrowRightCircle,
  FileCheck2,
  Lightbulb,
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
  AreaChart,
  Area,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  LabelList,
  Label,
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

interface AlertDetails {
  id: string;
  title: string;
  category: string;
  building: string;
  floor: string;
  zone: string;
  sensorId: string;
  detectionTime: string;
  currentStatus: string;
  severity: "Critical" | "High" | "Warning" | "Normal";
  recommendedAction: string;
  metricLabel?: string;
  metricValue?: string;
  iconName: "Flame" | "CloudFog" | "Zap" | "Fuel";
}

const alertIcons = {
  Flame: Flame,
  CloudFog: CloudFog,
  Zap: Zap,
  Fuel: Fuel,
};

const IOT_ALERTS_DATA: Record<string, AlertDetails> = {
  fire: {
    id: "fire",
    title: "Fire Alert",
    category: "Active Alert",
    building: "Building A (Corporate HQ)",
    floor: "Floor 3",
    zone: "Zone Z4 (Server Room)",
    sensorId: "SNS-FIRE-304",
    detectionTime: "10:42 AM (Today)",
    currentStatus: "ACTIVE (TRIPPED)",
    severity: "Critical",
    recommendedAction: "Initiate immediate evacuation protocol, trigger FM-200 suppression system in Server Room Z4, notify city fire department, and dispatch building emergency response team.",
    metricLabel: "Temperature",
    metricValue: "84°C (Threshold: 55°C)",
    iconName: "Flame",
  },
  smoke: {
    id: "smoke",
    title: "Smoke Alert",
    category: "Air Quality",
    building: "Building B (Research Wing)",
    floor: "Floor 2",
    zone: "Zone A1 (Laboratory)",
    sensorId: "SNS-SMK-212",
    detectionTime: "09:30 AM (Today)",
    currentStatus: "RESOLVED (MONITORING)",
    severity: "Normal",
    recommendedAction: "No emergency action required. Resume normal operations. Schedule routine filter replacement for laboratory HVAC duct A1.",
    metricLabel: "Density",
    metricValue: "12 AQI (Normal)",
    iconName: "CloudFog",
  },
  electrical: {
    id: "electrical",
    title: "Electrical Fault",
    category: "Power Grid",
    building: "Building C (Data Center)",
    floor: "Floor 1",
    zone: "Zone E-12 (Power Distribution Panel)",
    sensorId: "SNS-ELEC-118",
    detectionTime: "10:15 AM (Today)",
    currentStatus: "INVESTIGATING",
    severity: "Warning",
    recommendedAction: "Dispatch on-duty electrical engineer to check main breaker panel E-12, isolate secondary busbar, and verify backup generator line status.",
    metricLabel: "Current Spike",
    metricValue: "140A (Normal: 80A)",
    iconName: "Zap",
  },
  gas: {
    id: "gas",
    title: "Gas Leak",
    category: "Gas Monitor",
    building: "Building A (Corporate HQ)",
    floor: "Basement 1",
    zone: "Zone G2 (Utility Room)",
    sensorId: "SNS-GAS-054",
    detectionTime: "08:05 AM (Today)",
    currentStatus: "ACTIVE (SHUTDOWN ENFORCED)",
    severity: "High",
    recommendedAction: "Isolate main gas supply valve A-HQ, initiate localized ventilation fans, restrict access to Basement 1, and dispatch hazmat compliance technician.",
    metricLabel: "Concentration",
    metricValue: "450 ppm (Threshold: 100 ppm)",
    iconName: "Fuel",
  },
};

function Index() {
  // Tabs state: "executive" (original dashboard) or "vulnerability" (vulnerability assessment page)
  const [activeTab, setActiveTab] = useState<"executive" | "vulnerability">("executive");
  const [selectedAlert, setSelectedAlert] = useState<AlertDetails | null>(null);

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

  // Stable data for Vulnerability Trends (past 6 months) to avoid random shifts each render
  const vulnerabilityData = useMemo(() => {
    const baseScores = [48, 55, 50, 68, 62, 75]; // realistic safety indicators
    return Array.from({ length: 6 }, (_, i) => {
      const month = new Date(
        new Date().setMonth(new Date().getMonth() - (5 - i)),
      ).toLocaleString("default", { month: "short" });
      return {
        month,
        score: baseScores[i],
      };
    });
  }, []);

  const { highestScore, lowestScore } = useMemo(() => {
    if (vulnerabilityData.length === 0) return { highestScore: null, lowestScore: null };
    let highest = vulnerabilityData[0];
    let lowest = vulnerabilityData[0];
    vulnerabilityData.forEach((d) => {
      if (d.score > highest.score) highest = d;
      if (d.score < lowest.score) lowest = d;
    });
    return { highestScore: highest, lowestScore: lowest };
  }, [vulnerabilityData]);

  // Compute building categories with counts dynamically
  const categoryData = useMemo(() => {
    if (!buildings) return [];
    return buildings.reduce((acc: any[], b) => {
      const existing = acc.find((x) => x.category === b.type);
      if (existing) existing.count++;
      else acc.push({ category: b.type, count: 1 });
      return acc;
    }, []);
  }, [buildings]);

  // Calculate sum of incidents in past 7 days to check for empty states gracefully
  const totalIncidentsInTrend = useMemo(() => {
    if (!incidentTrend) return 0;
    return incidentTrend.reduce((sum, item) => sum + item.count, 0);
  }, [incidentTrend]);

  // Find peak occupancy and value for 24h occupancy trend
  const peakOccupancy = useMemo(() => {
    if (occupancyTrend.length === 0) return null;
    return occupancyTrend.reduce((max, item) => (item.occupants > max.occupants ? item : max), occupancyTrend[0]);
  }, [occupancyTrend]);

  // Total zone count for donut chart center label
  const totalZonesCount = useMemo(() => {
    return riskDist.reduce((sum, d) => sum + d.value, 0);
  }, [riskDist]);

  // TAB 2: Vulnerability Profile specific states
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | null>(null);

  // Reset floor filter when building changes
  useEffect(() => {
    setSelectedFloorFilter(null);
  }, [selectedBuildingId]);

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

  const compliancePercentage = useMemo(() => {
    if (!selectedBuildingId) return 0;
    const saved = localStorage.getItem(`wb-checklist-status-${selectedBuildingId}`);
    if (saved) {
      try {
        const checklist = JSON.parse(saved);
        const total = 18; // total standard checklist items
        const passed = Object.values(checklist).filter((s) => s === "PASS").length;
        return Math.round((passed / total) * 100);
      } catch {}
    }
    return 0;
  }, [selectedBuildingId]);

  const highestRiskFloorId = useMemo(() => {
    if (selectedBuildingFloors.length === 0) return null;
    let maxScore = -1;
    let maxFloorId = null;
    selectedBuildingFloors.forEach((f) => {
      const fZones = selectedBuildingZones.filter((z) => z.floorId === f.id);
      const fOcc = fZones.reduce((s, z) => s + z.occupancy, 0);
      const fLoad = 250 + ((f.level * 45) % 300);
      const score = Math.round(
        ((fOcc * fLoad) / (f.availableExits || 1) / 100) *
          activeBuildingComplianceMultiplier,
      );
      if (score > maxScore) {
        maxScore = score;
        maxFloorId = f.id;
      }
    });
    return maxFloorId;
  }, [selectedBuildingFloors, selectedBuildingZones, activeBuildingComplianceMultiplier]);

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
              <div 
                onClick={() => setSelectedAlert(IOT_ALERTS_DATA.fire)}
                className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:border-risk-red/45 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-red/80 to-risk-red/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-red/15 text-risk-red shadow-inner transition-transform group-hover:scale-105">
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
              <div 
                onClick={() => setSelectedAlert(IOT_ALERTS_DATA.smoke)}
                className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:border-blue-400/45 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400/80 to-blue-400/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 shadow-inner transition-transform group-hover:scale-105">
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
              <div 
                onClick={() => setSelectedAlert(IOT_ALERTS_DATA.electrical)}
                className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:border-risk-yellow/45 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-yellow/80 to-risk-yellow/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-yellow/15 text-risk-yellow shadow-inner transition-transform group-hover:scale-105">
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
              <div 
                onClick={() => setSelectedAlert(IOT_ALERTS_DATA.gas)}
                className="group rounded-2xl border border-blue-500/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:border-risk-orange/45 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-risk-orange/80 to-risk-orange/20 opacity-80" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-risk-orange/15 text-risk-orange shadow-inner transition-transform group-hover:scale-105">
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
                <AreaChart data={vulnerabilityData}>
                  <defs>
                    <linearGradient id="vulnerabilityGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const score = Math.round(Number(payload[0]?.value || 0));
                        let statusText = "Stable";
                        let statusColor = "text-risk-yellow";
                        if (score > 65) {
                          statusText = "Increasing Risk";
                          statusColor = "text-risk-red animate-pulse";
                        } else if (score < 52) {
                          statusText = "Improving";
                          statusColor = "text-risk-green";
                        }
                        return (
                          <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-foreground font-mono">{score}</span>
                              <span className="text-[9px] text-muted-foreground">Index</span>
                            </div>
                            <div className={`text-[8px] font-extrabold uppercase mt-1.5 flex items-center gap-1 ${statusColor}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {statusText}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#vulnerabilityGlow)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                  {highestScore && (
                    <ReferenceDot
                      x={highestScore.month}
                      y={highestScore.score}
                      r={5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      label={{
                        value: `Max: ${highestScore.score}`,
                        position: "top",
                        fill: "#ef4444",
                        fontSize: 9,
                        fontWeight: "bold",
                      }}
                    />
                  )}
                  {lowestScore && (
                    <ReferenceDot
                      x={lowestScore.month}
                      y={lowestScore.score}
                      r={5}
                      fill="#22c55e"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      label={{
                        value: `Min: ${lowestScore.score}`,
                        position: "bottom",
                        fill: "#22c55e",
                        fontSize: 9,
                        fontWeight: "bold",
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Building Category Distribution">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <defs>
                    <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                    <linearGradient id="barOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#c2410c" />
                    </linearGradient>
                    <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                    <linearGradient id="barPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-foreground font-mono">
                                {payload[0]?.value !== undefined ? String(payload[0].value) : ""}
                              </span>
                              <span className="text-[9px] text-muted-foreground">Buildings</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={["url(#barBlue)", "url(#barOrange)", "url(#barGreen)", "url(#barPurple)"][index % 4]}
                        cursor="pointer"
                        className="transition-opacity duration-300 hover:opacity-85"
                      />
                    ))}
                    <LabelList dataKey="count" position="top" fill="var(--foreground)" fontSize={9} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Occupancy Trend (24h)">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={occupancyTrend}>
                  <defs>
                    <linearGradient id="occupancyGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-foreground font-mono">
                                {payload[0]?.value !== undefined ? Number(payload[0].value).toLocaleString() : ""}
                              </span>
                              <span className="text-[9px] text-muted-foreground">Occupants</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="occupants"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    fill="url(#occupancyGlow)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                  {peakOccupancy && (
                    <ReferenceDot
                      x={peakOccupancy.hour}
                      y={peakOccupancy.occupants}
                      r={5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      label={{
                        value: `Peak: ${peakOccupancy.occupants}`,
                        position: "top",
                        fill: "#ef4444",
                        fontSize: 8,
                        fontWeight: "bold",
                      }}
                    />
                  )}
                  {totalOccupants > 0 && (
                    <ReferenceLine
                      y={totalOccupants}
                      stroke="var(--risk-orange)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{
                        value: `Live: ${totalOccupants}`,
                        fill: "var(--risk-orange)",
                        fontSize: 8,
                        position: 'right',
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Incidents (7 days)">
              {totalIncidentsInTrend === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-green/10 text-risk-green mb-3 border border-risk-green/20">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="text-xs font-bold text-foreground mb-1">Clear Command Log</div>
                  <p className="text-[10px] text-muted-foreground max-w-[200px] leading-relaxed">
                    No active or historical fire incidents recorded across all campuses in the past 7 days.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={incidentTrend}>
                    <defs>
                      <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--risk-red)" />
                        <stop offset="100%" stopColor="#b91c1c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const val = Number(payload[0]?.value || 0);
                          return (
                            <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-base font-black text-foreground font-mono">{val}</span>
                                <span className="text-[9px] text-muted-foreground">{val === 1 ? "Incident" : "Incidents"}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="url(#incidentGrad)"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={1000}
                      className="cursor-pointer transition-opacity duration-300 hover:opacity-85"
                    >
                      <LabelList dataKey="count" position="top" fill="var(--foreground)" fontSize={9} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Zone Risk Distribution">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={riskDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    isAnimationActive={true}
                    animationDuration={1000}
                    label={({ percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {riskDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <Label
                      value={totalZonesCount}
                      position="center"
                      content={({ viewBox }) => {
                        const { cx, cy } = viewBox as any;
                        return (
                          <text x={cx} y={cy} className="text-center" textAnchor="middle" dominantBaseline="central">
                            <tspan x={cx} dy="-6" className="fill-foreground font-black font-mono text-base">{totalZonesCount}</tspan>
                            <tspan x={cx} dy="14" className="fill-muted-foreground text-[8px] uppercase tracking-wider font-bold">Total Zones</tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              <span className="h-2 w-2 rounded-sm" style={{ background: data.color }} />
                              {data.name}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-foreground font-mono">{data.value}</span>
                              <span className="text-[9px] text-muted-foreground">Zones</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
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
      {activeTab === "vulnerability" && (() => {
        const filteredBuildingImpacts = selectedFloorFilter === null
          ? selectedBuildingImpacts
          : selectedBuildingImpacts.filter((i) => i.floor.id === selectedFloorFilter);
        
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Status Bar / Assessment Summary Card */}
            {selectedBuildingId && (
              <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-lg">
                {/* Top ambient colored highlight */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-primary/5 opacity-80" />
                
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground block">
                        Building Under Assessment
                      </span>
                      <h2 className="text-xl font-black text-foreground mt-0.5 tracking-tight">
                        {activeBuilding?.name}
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-1.5 font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                        Current building selected for vulnerability analysis and risk assessment.
                      </p>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedBuildingActiveIncident ? (
                      <div className="text-xs text-risk-red flex items-center gap-2 px-3 py-1.5 rounded-full bg-risk-red/10 border border-risk-red/20 font-bold animate-pulse">
                        <ShieldAlert className="h-3.5 w-3.5" /> Active Incident L{selectedBuildingIncidentFloorLevel}
                      </div>
                    ) : (
                      <div className="text-xs text-risk-green flex items-center gap-1.5 bg-risk-green/10 text-risk-green px-3 py-1.5 rounded-full border border-risk-green/20 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Safe Baseline
                      </div>
                    )}
                    {selectedFloorFilter !== null && (
                      <button
                        onClick={() => setSelectedFloorFilter(null)}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 font-bold transition-all cursor-pointer"
                      >
                        Filter: Level {selectedBuildingFloors.find(f => f.id === selectedFloorFilter)?.level} <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Assessment Summary Attributes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/40 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Campus / Location</span>
                    <div className="font-semibold text-foreground truncate">{activeBuilding?.city || "Sangam Mall"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Floor Level</span>
                    <div className="font-semibold text-foreground">
                      {selectedFloorFilter !== null 
                        ? `Floor Level ${selectedBuildingFloors.find(f => f.id === selectedFloorFilter)?.level}` 
                        : "All Floors Assessed"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last Assessment</span>
                    <div className="font-semibold text-foreground">
                      {activeBuilding?.assessmentDate 
                        ? new Date(activeBuilding.assessmentDate).toLocaleDateString() + " 10:52 AM" 
                        : "Today 10:52 AM"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Completion Rate</span>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-foreground font-mono">100%</div>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-risk-green rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Executive KPI Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* KPI 1: Total Impact Score */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Impact Score</span>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Gauge className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground font-mono">
                    {Math.round(selectedBuildingTotalImpact).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${
                      selectedBuildingTotalImpact > 600 ? "bg-risk-red/10 text-risk-red border border-risk-red/20" : "bg-risk-green/10 text-risk-green border border-risk-green/20"
                    }`}>
                      {selectedBuildingTotalImpact > 600 ? "At Risk" : "Stable"}
                    </span>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 font-bold">
                      <TrendingDown className="h-3 w-3 text-risk-green" /> -2.4%
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Safety compliance factor.
                </div>
              </div>

              {/* KPI 2: Overall Vulnerability */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Vulnerability</span>
                  <div className="p-1.5 rounded-lg bg-red-500/10 text-risk-red">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground font-mono">
                    {selectedBuildingPvi.score}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${
                      selectedBuildingPvi.score > 60 ? "bg-risk-orange/10 text-risk-orange border border-risk-orange/20" : "bg-risk-yellow/10 text-risk-yellow border border-risk-yellow/20"
                    }`}>
                      {pviRisk.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-bold">Stable</span>
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Demographic evac risk.
                </div>
              </div>

              {/* KPI 3: Critical Risk Zones */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Critical Zones</span>
                  <div className="p-1.5 rounded-lg bg-orange-500/10 text-risk-orange">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className={`text-2xl font-black font-mono ${selectedBuildingCriticalCount > 0 ? "text-risk-red animate-pulse" : "text-foreground"}`}>
                    {selectedBuildingCriticalCount}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${
                      selectedBuildingCriticalCount > 0 ? "bg-risk-red/10 text-risk-red border border-risk-red/20" : "bg-risk-green/10 text-risk-green border border-risk-green/20"
                    }`}>
                      {selectedBuildingCriticalCount > 0 ? "Action Required" : "Optimal"}
                    </span>
                    {selectedBuildingCriticalCount > 0 && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 font-bold">
                        <TrendingUp className="h-3 w-3 text-risk-red" /> +1.2%
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Active RED danger zones.
                </div>
              </div>

              {/* KPI 4: Total Assessed Zones */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Assessed Zones</span>
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Layers className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground font-mono">
                    {selectedBuildingImpacts.length}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Monitored
                    </span>
                    <span className="text-[9px] text-muted-foreground font-bold">Stable</span>
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Building zone checkpoints.
                </div>
              </div>

              {/* KPI 5: Safety Compliance % */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Compliance</span>
                  <div className="p-1.5 rounded-lg bg-green-500/10 text-risk-green">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground font-mono">
                    {Math.round(activeBuildingComplianceMultiplier ? (1.2 - activeBuildingComplianceMultiplier) * 250 + 50 : 85)}%
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-risk-green/10 text-risk-green border border-risk-green/20">
                      Compliant
                    </span>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 font-bold">
                      <TrendingUp className="h-3 w-3 text-risk-green" /> +5%
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Safety checklist rating.
                </div>
              </div>

              {/* KPI 6: Fire Readiness Score */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Fire Readiness</span>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-foreground font-mono">
                    {Math.max(45, Math.round(100 - selectedBuildingCriticalCount * 12))}%
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${
                      Math.round(100 - selectedBuildingCriticalCount * 12) > 80 ? "bg-risk-green/10 text-risk-green border border-risk-green/20" : "bg-risk-orange/10 text-risk-orange border border-risk-orange/20"
                    }`}>
                      {Math.round(100 - selectedBuildingCriticalCount * 12) > 80 ? "High Ready" : "Vulnerable"}
                    </span>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 font-bold">
                      <TrendingUp className="h-3 w-3 text-risk-green" /> +1.5%
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[9px] text-muted-foreground border-t border-border/30 pt-2">
                  Hardware readiness factor.
                </div>
              </div>
            </div>

            {/* Patient Vulnerability Index (PVI) Card */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* PVI Gauge Card */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-blue-400" /> Patient Vulnerability Index (PVI)
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                    Evacuation difficulty demographic weighting rating. Critical patients count scale.
                  </p>
                </div>

                {/* Gauge Meter */}
                <div className="flex flex-col items-center justify-center my-6">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-36 transform -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="72"
                        cy="72"
                        r="58"
                        stroke="var(--border)"
                        strokeWidth="8"
                        fill="transparent"
                        className="opacity-20"
                      />
                      {/* Value circle */}
                      <circle
                        cx="72"
                        cy="72"
                        r="58"
                        stroke={
                          selectedBuildingPvi.score > 80 
                            ? "var(--risk-red)" 
                            : selectedBuildingPvi.score > 60 
                              ? "var(--risk-orange)" 
                              : selectedBuildingPvi.score > 30 
                                ? "var(--risk-yellow)" 
                                : "var(--risk-green)"
                        }
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 58}
                        strokeDashoffset={
                          2 * Math.PI * 58 - (selectedBuildingPvi.score / 100) * (2 * Math.PI * 58)
                        }
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center text-center">
                      <span className="text-3xl font-black font-mono text-foreground tracking-tight">
                        {selectedBuildingPvi.score}
                      </span>
                      <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
                        PVI Score
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${pviRisk.bg}/15 ${pviRisk.color} border border-${pviRisk.bg}/25`}>
                      {pviRisk.label} Risk Profile
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground text-center border-t border-border/30 pt-3">
                  Calculated on {selectedBuildingZones.length || 0} zone patient logs.
                </div>
              </div>

              {/* PVI Statistics Details Grid */}
              <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden group flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/30 via-transparent to-transparent opacity-80" />
                
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Demographics Evacuation Metrics
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Active patient census by evacuation difficulty tiers. Hover over items for details.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-6 my-2">
                  {/* Total Occupants */}
                  <div 
                    className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between shadow-sm relative group/item hover:border-blue-500/30 transition-all duration-300"
                    title="Total active occupants inside the selected building zones."
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Active</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-foreground font-mono">{selectedBuildingPvi.total}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Total Census</div>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  {/* ICU Patients */}
                  <div 
                    className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between shadow-sm relative group/item hover:border-risk-red/30 transition-all duration-300"
                    title="ICU patients requiring high priority oxygen and nurse assisted evacuation."
                  >
                    <div className="flex items-center justify-between text-risk-red">
                      <Activity className="h-4 w-4" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">ICU</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-foreground font-mono">{selectedBuildingPvi.icu}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-1">ICU Bed Count</div>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-risk-red h-full rounded-full" style={{ width: `${Math.min(100, (selectedBuildingPvi.icu / (selectedBuildingPvi.total || 1)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Critical Care */}
                  <div 
                    className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between shadow-sm relative group/item hover:border-risk-orange/30 transition-all duration-300"
                    title="Patients in critical care under telemetry monitoring."
                  >
                    <div className="flex items-center justify-between text-risk-orange">
                      <ShieldAlert className="h-4 w-4" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Critical</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-foreground font-mono">{selectedBuildingPvi.critical}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Critical Tier</div>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-risk-orange h-full rounded-full" style={{ width: `${Math.min(100, (selectedBuildingPvi.critical / (selectedBuildingPvi.total || 1)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Special Needs */}
                  <div 
                    className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between shadow-sm relative group/item hover:border-risk-yellow/30 transition-all duration-300"
                    title="People with visual, hearing, mobility, or cognitive special needs."
                  >
                    <div className="flex items-center justify-between text-risk-yellow">
                      <UserMinus className="h-4 w-4" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Needs</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-foreground font-mono">{selectedBuildingPvi.disabled}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Special Needs</div>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-risk-yellow h-full rounded-full" style={{ width: `${Math.min(100, (selectedBuildingPvi.disabled / (selectedBuildingPvi.total || 1)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Elderly / Children */}
                  <div 
                    className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between shadow-sm relative group/item hover:border-purple-500/30 transition-all duration-300"
                    title="Children, toddlers, or elderly occupants requiring extra physical evacuation support."
                  >
                    <div className="flex items-center justify-between text-purple-400">
                      <UserCheck className="h-4 w-4" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Age-risk</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-black text-foreground font-mono">{selectedBuildingPvi.elderly}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-1">Elderly & Kids</div>
                    </div>
                    <div className="w-full bg-secondary h-1 rounded-full mt-3 overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, (selectedBuildingPvi.elderly / (selectedBuildingPvi.total || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                  * All values represent current real-time counts from the database and checklist status. Evacuation routes priority is scaled based on these metrics.
                </div>
              </div>
            </div>

            {/* Formula Flowchart Panel */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
                <Calculator className="h-4 w-4 text-primary" /> Model Formula Flow Breakdown
              </h3>

              <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
                {/* Step 1 */}
                <div className="rounded-xl border border-border bg-secondary/40 p-4 w-full md:w-56 shadow-sm">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Inputs Tiers</div>
                  <div className="text-sm font-black text-foreground">Overall Vulnerability</div>
                  <p className="text-[9px] text-muted-foreground mt-1.5">Building category and construction type base parameters.</p>
                </div>

                {/* Arrow 1 */}
                <div className="flex flex-col items-center justify-center text-primary animate-pulse">
                  <ArrowRightCircle className="h-6 w-6 transform rotate-90 md:rotate-0" />
                </div>

                {/* Step 2 */}
                <div className="rounded-xl border border-border/60 bg-secondary/80 p-5 w-full md:w-96 shadow-md relative">
                  <div className="text-[9px] uppercase tracking-widest text-primary font-bold mb-2">Compounded Weighting Factors</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-card/85 border border-border flex flex-col items-center">
                      <span className="font-bold text-foreground">FLVI Level</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">Floor-Level Index</span>
                    </div>
                    <div className="p-2 rounded bg-card/85 border border-border flex flex-col items-center">
                      <span className="font-bold text-blue-400">PVI Weight</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">Patient evacuation load</span>
                    </div>
                    <div className="p-2 rounded bg-card/85 border border-border flex flex-col items-center col-span-2">
                      <span className="font-bold text-risk-orange">Fire Load & Exit Ratio</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">Exits status × Material combustion multiplier</span>
                    </div>
                  </div>
                </div>

                {/* Arrow 2 */}
                <div className="flex flex-col items-center justify-center text-primary animate-pulse">
                  <ArrowRightCircle className="h-6 w-6 transform rotate-90 md:rotate-0" />
                </div>

                {/* Step 3 */}
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 w-full md:w-56 shadow-lg border-l-4 border-l-primary">
                  <div className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1">Index Output</div>
                  <div className="text-sm font-black text-foreground">Total Fire Vulnerability Index (TFVI)</div>
                  <div className="mt-2 text-xl font-mono font-black text-primary">{selectedBuildingPvi.score} Score</div>
                </div>
              </div>
            </div>

            {/* Risk Heat Map Section */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary animate-bounce" /> Real-time Floor Risk Heat Map
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Click a floor block below to isolate that floor and filter the zone rankings automatically.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-risk-red animate-ping" /> Live Sensors Active
                </span>
              </div>

              {/* Heat Map Grid */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 mt-4">
                {selectedBuildingFloors.map((f) => {
                  const fZones = selectedBuildingZones.filter((z) => z.floorId === f.id);
                  const fOcc = fZones.reduce((s, z) => s + z.occupancy, 0);
                  const fLoad = 250 + ((f.level * 45) % 300);
                  const score = Math.round(
                    ((fOcc * fLoad) / (f.availableExits || 1) / 100) *
                      activeBuildingComplianceMultiplier,
                  );
                  const risk = getRiskLabel(score);
                  
                  // Determine Risk Color for Heatmap Grid Block
                  let colorClass = "";
                  if (score > 80) colorClass = "bg-risk-red/10 border-risk-red text-risk-red hover:bg-risk-red/20 shadow-risk-red/5";
                  else if (score > 60) colorClass = "bg-risk-orange/10 border-risk-orange text-risk-orange hover:bg-risk-orange/20 shadow-risk-orange/5";
                  else if (score > 30) colorClass = "bg-risk-yellow/10 border-risk-yellow text-risk-yellow hover:bg-risk-yellow/20 shadow-risk-yellow/5";
                  else colorClass = "bg-risk-green/10 border-risk-green text-risk-green hover:bg-risk-green/20 shadow-risk-green/5";

                  const isSelected = selectedFloorFilter === f.id;

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFloorFilter(isSelected ? null : f.id!)}
                      className={`cursor-pointer rounded-xl border p-4 text-center transition-all duration-300 shadow-md flex flex-col justify-between ${colorClass} ${
                        isSelected 
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" 
                          : "opacity-85 hover:opacity-100 hover:-translate-y-0.5"
                      }`}
                    >
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider opacity-85">Level {f.level}</div>
                        <h4 className="font-extrabold text-foreground mt-0.5 truncate">{f.name}</h4>
                      </div>
                      <div className="mt-4 pt-3 border-t border-current/25 flex flex-col items-center">
                        <div className="text-xl font-black font-mono leading-none">{score}</div>
                        <div className="text-[8px] uppercase tracking-wider font-extrabold mt-1">{risk.label} Risk</div>
                      </div>
                    </div>
                  );
                })}
                {selectedBuildingFloors.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                    No floor data found to generate risk heatmap.
                  </div>
                )}
              </div>
            </div>

            {/* Dual Sections for Floors & Zones */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Floor-Level Index (FLVI) Analysis */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden flex flex-col group col-span-1 lg:col-span-2">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" /> Floor-Level Risk Rating (FLVI)
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Individual floor risk indices weighted by occupants and egress exits.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-amber-500 font-extrabold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                    ⚠️ Golden Highlight = Highest Risk Level
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-[9px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">Floor Level</th>
                        <th className="px-4 py-2 text-left font-bold">Occupancy</th>
                        <th className="px-4 py-2 text-center font-bold">Egress Exit Status</th>
                        <th className="px-4 py-2 text-left font-bold">Combustible Load</th>
                        <th className="px-4 py-2 text-right font-bold">Index Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {selectedBuildingFloors.map((f) => {
                        const fZones = selectedBuildingZones.filter((z) => z.floorId === f.id);
                        const fOcc = fZones.reduce((s, z) => s + z.occupancy, 0);
                        const fLoad = 250 + ((f.level * 45) % 300);
                        const score = Math.round(
                          ((fOcc * fLoad) / (f.availableExits || 1) / 100) *
                            activeBuildingComplianceMultiplier,
                        );
                        const risk = getRiskLabel(score);
                        const isHighestRisk = highestRiskFloorId === f.id;

                        return (
                          <tr 
                            key={f.id} 
                            className={`transition-colors border-l-2 hover:bg-card/60 ${
                              isHighestRisk 
                                ? "border-l-amber-500 bg-amber-500/5 shadow-inner" 
                                : "border-l-transparent"
                            }`}
                          >
                            {/* Floor Level */}
                            <td className="px-4 py-3.5 flex items-center gap-2">
                              <Layers className={`h-4 w-4 shrink-0 ${isHighestRisk ? "text-amber-400" : "text-muted-foreground"}`} />
                              <div>
                                <div className="font-black text-foreground font-mono text-xs">Level {f.level}</div>
                                <div className="text-[9px] text-muted-foreground truncate max-w-[120px]" title={f.name}>{f.name}</div>
                              </div>
                            </td>

                            {/* Occupants Progress */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-foreground">
                                <span>{fOcc} occupants</span>
                              </div>
                              <div className="w-full bg-secondary/80 h-1.5 rounded-full overflow-hidden mt-1 max-w-[150px]">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${fOcc > 200 ? 'bg-risk-red' : fOcc > 100 ? 'bg-risk-orange' : 'bg-risk-green'}`} 
                                  style={{ width: `${Math.min(100, (fOcc / 300) * 100)}%` }} 
                                />
                              </div>
                            </td>

                            {/* Exit capacity */}
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono ${
                                f.availableExits === f.totalExits 
                                  ? "bg-risk-green/10 text-risk-green border border-risk-green/20" 
                                  : f.availableExits === 0 
                                    ? "bg-risk-red/10 text-risk-red border border-risk-red/20 animate-pulse" 
                                    : "bg-risk-yellow/10 text-risk-yellow border border-risk-yellow/20"
                              }`}>
                                {f.availableExits}/{f.totalExits} Exits
                              </span>
                            </td>

                            {/* Fire Load Progress */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-muted-foreground">
                                <span>{fLoad} MJ/m²</span>
                              </div>
                              <div className="w-full bg-secondary/80 h-1.5 rounded-full overflow-hidden mt-1 max-w-[150px]">
                                <div 
                                  className="h-full bg-risk-orange rounded-full transition-all duration-500" 
                                  style={{ width: `${(fLoad / 600) * 100}%` }} 
                                />
                              </div>
                            </td>

                            {/* Risk Badge & Score */}
                            <td className="px-4 py-3.5 text-right flex items-center justify-end gap-2.5">
                              <div className="text-right">
                                <div className={`font-mono font-black text-sm leading-none ${risk.color}`}>{score}</div>
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-muted-foreground mt-0.5 block">{risk.label}</span>
                              </div>
                              <span className={`h-2.5 w-2.5 rounded-full ${risk.bg} shadow-md`} />
                            </td>
                          </tr>
                        );
                      })}
                      {selectedBuildingFloors.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                            No floors configured for this building profile.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Zone Vulnerability Ranking interactive block */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden flex flex-col group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Active Zone Rankings
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Vulnerability zones sorted by impact.
                    </p>
                  </div>
                  {selectedFloorFilter !== null && (
                    <span className="text-[9px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      Filtered: L{selectedBuildingFloors.find(f => f.id === selectedFloorFilter)?.level}
                    </span>
                  )}
                </div>

                {/* Ranking Cards Container */}
                <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin">
                  {filteredBuildingImpacts.map((i, index) => {
                    const score = Math.round(i.breakdown.total * activeBuildingComplianceMultiplier);
                    return (
                      <div 
                        key={i.zone.id} 
                        className="group/card rounded-xl border border-border bg-secondary/35 p-3.5 hover:bg-card/70 hover:border-primary/20 transition-all duration-300 shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Number Indicator badge */}
                          <div className="h-6 w-6 rounded-lg bg-secondary border border-border flex items-center justify-center font-mono font-black text-[10px] text-muted-foreground shrink-0 group-hover/card:bg-primary/10 group-hover/card:text-primary transition-colors">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-foreground text-xs truncate" title={i.zone.name}>
                              {i.zone.name || i.zone.zoneId}
                            </h4>
                            <div className="text-[9px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>Level {i.floor.level}</span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                              <span>{i.zone.occupancy} occ</span>
                            </div>
                          </div>
                        </div>

                        {/* Right-side Stats */}
                        <div className="text-right shrink-0 flex items-center gap-2.5">
                          <div className="text-right">
                            <div className="font-mono font-black text-xs" style={{ color: RISK_COLORS[i.risk] }}>
                              {score}
                            </div>
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-muted-foreground mt-0.5 block">Impact</span>
                          </div>
                          <RiskBadge level={i.risk} />
                        </div>
                      </div>
                    );
                  })}
                  {filteredBuildingImpacts.length === 0 && (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No active zones configured or matching filter.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Safety Recommendations & Risk Analytics row */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* AI Safety Recommendations Panel */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2 mb-1">
                    <Lightbulb className="h-4 w-4 text-yellow-400 animate-pulse" /> AI Safety Recommendations
                  </h3>
                  <p className="text-[10px] text-muted-foreground mb-4">
                    Machine learning risk analysis output. Actionable upgrades.
                  </p>
                </div>

                {/* Suggestions List */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 text-xs bg-risk-red/5 border border-risk-red/20 rounded-xl p-3">
                    <span className="text-risk-red font-bold mt-0.5">✓</span>
                    <div>
                      <h5 className="font-extrabold text-foreground">Audit High-Density Zones</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Critical occupants count detected. Restrict peak hours on Level {selectedBuildingFloors[0]?.level || 1}.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs bg-risk-orange/5 border border-risk-orange/20 rounded-xl p-3">
                    <span className="text-risk-orange font-bold mt-0.5">✓</span>
                    <div>
                      <h5 className="font-extrabold text-foreground">Emergency Exit Capacity</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Add 1 egress door near Zone Z4 (Server Room) to optimize exit capacity ratio.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                    <span className="text-blue-400 font-bold mt-0.5">✓</span>
                    <div>
                      <h5 className="font-extrabold text-foreground">Sprinkler & Sensor Tuning</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Scheduled preventive maintenance required for primary smoke alarm busbars.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-[9px] text-muted-foreground text-center">
                  * Recommendations updated dynamically based on PVI and FLVI.
                </div>
              </div>

              {/* Risk Trend Analytics */}
              <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" /> Risk & Occupancy Trend Analytics
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Chart 1: Risk Trend */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Risk Index Trend (6m)</span>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={[
                        { m: "Jan", val: 42 },
                        { m: "Feb", val: 48 },
                        { m: "Mar", val: 45 },
                        { m: "Apr", val: 58 },
                        { m: "May", val: 52 },
                        { m: "Jun", val: selectedBuildingPvi.score || 60 }
                      ]}>
                        <defs>
                          <linearGradient id="trendRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--risk-red)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--risk-red)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="m" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 9, background: 'var(--card)' }} />
                        <Area type="monotone" dataKey="val" stroke="var(--risk-red)" strokeWidth={1.5} fill="url(#trendRed)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 2: Live Occupancy Trend */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Live Occupants Trend</span>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={occupancyTrend}>
                        <defs>
                          <linearGradient id="trendOrange" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--risk-orange)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--risk-orange)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 9, background: 'var(--card)' }} />
                        <Area type="monotone" dataKey="occupants" stroke="var(--risk-orange)" strokeWidth={1.5} fill="url(#trendOrange)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* TFVI Gauge & Emergency Readiness Status */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* TFVI Gauge */}
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" /> Total Fire Vulnerability Index (TFVI)
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Overall safety score threshold comparison.
                  </p>
                </div>

                {/* SVG Gauge */}
                <div className="flex flex-col items-center justify-center my-6">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle cx="72" cy="72" r="58" stroke="var(--border)" strokeWidth="8" fill="transparent" className="opacity-20" />
                      <circle
                        cx="72"
                        cy="72"
                        r="58"
                        stroke="var(--primary)"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 58}
                        strokeDashoffset={2 * Math.PI * 58 - (selectedBuildingPvi.score / 100) * (2 * Math.PI * 58)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center text-center">
                      <span className="text-3xl font-black font-mono text-foreground tracking-tight">{selectedBuildingPvi.score}</span>
                      <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">TFVI Index</span>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-xs font-bold text-foreground">Threshold Limit: 75</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Previous Assessment: 52</div>
                  </div>
                </div>

                <div className="bg-secondary/35 rounded-xl p-3 border border-border/50 text-[10px] text-foreground font-medium">
                  <strong>Safety Recommendation:</strong> {
                    selectedBuildingPvi.score > 75 
                      ? "Immediate evacuation drills, test secondary lines." 
                      : "Standard monthly checklist inspection approved."
                  }
                </div>
              </div>

              {/* Emergency Hardware Readiness Blocks */}
              <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-md relative overflow-hidden group flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-80" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-1">
                    <Settings className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: '6s' }} /> Emergency Hardware Readiness Matrix
                  </h3>
                  <p className="text-[10px] text-muted-foreground mb-4">
                    Diagnostic feed of active safety controllers, exit paths, and water pipelines.
                  </p>
                </div>

                {/* Status grid */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {/* Fire Alarm */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Fire Alarm</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>

                  {/* Smoke Detector */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Smoke Detector</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>

                  {/* Sprinklers */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Sprinkler System</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>

                  {/* Emergency Lights */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-orange/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Emergency Lights</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-orange shadow shadow-risk-orange animate-pulse" />
                      <span className="text-[10px] font-bold text-risk-orange">Maintenance</span>
                    </div>
                  </div>

                  {/* Exit Availability */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Exits Access</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>

                  {/* Electrical Health */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-red/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Power Grid</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-red shadow shadow-risk-red animate-ping" />
                      <span className="text-[10px] font-bold text-risk-red">Fault Panel E-12</span>
                    </div>
                  </div>

                  {/* Water Supply */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Water Supply</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>

                  {/* Backup Generator */}
                  <div className="rounded-xl border border-border/50 bg-secondary/35 p-3 flex flex-col justify-between hover:border-risk-green/30 transition-all duration-300">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Backup Generator</span>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex h-2 w-2 rounded-full bg-risk-green shadow shadow-risk-green" />
                      <span className="text-[10px] font-bold text-risk-green">Operational</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/30">
                  * Maintenance tickets generated automatically for Fault and Maintenance status levels.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Top color bar depending on severity */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
              selectedAlert.severity === "Critical"
                ? "from-risk-red to-risk-red/40"
                : selectedAlert.severity === "High"
                  ? "from-risk-orange to-risk-orange/40"
                  : selectedAlert.severity === "Warning"
                    ? "from-risk-yellow to-risk-yellow/40"
                    : "from-risk-green to-risk-green/40"
            }`} />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-secondary/20 p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-inner ${
                  selectedAlert.severity === "Critical"
                    ? "bg-risk-red/15 text-risk-red border border-risk-red/10"
                    : selectedAlert.severity === "High"
                      ? "bg-risk-orange/15 text-risk-orange border border-risk-orange/10"
                      : selectedAlert.severity === "Warning"
                        ? "bg-risk-yellow/15 text-risk-yellow border border-risk-yellow/10"
                        : "bg-risk-green/15 text-risk-green border border-risk-green/10"
                }`}>
                  {(() => {
                    const Icon = alertIcons[selectedAlert.iconName as keyof typeof alertIcons];
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                      Simulation Mode
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{selectedAlert.title}</h3>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border/50 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Building</span>
                  <div className="text-xs font-semibold text-foreground">{selectedAlert.building}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Floor</span>
                  <div className="text-xs font-semibold text-foreground">{selectedAlert.floor}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Zone</span>
                  <div className="text-xs font-semibold text-foreground">{selectedAlert.zone}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sensor ID</span>
                  <div className="text-xs font-mono font-semibold text-foreground">{selectedAlert.sensorId}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Detection Time</span>
                  <div className="text-xs font-semibold text-foreground">{selectedAlert.detectionTime}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Current Status</span>
                  <div className={`text-xs font-bold ${
                    selectedAlert.currentStatus.includes("ACTIVE") ? "text-risk-red" : "text-risk-green"
                  }`}>{selectedAlert.currentStatus}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Severity</span>
                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      selectedAlert.severity === "Critical"
                        ? "bg-risk-red/10 text-risk-red border-risk-red/20"
                        : selectedAlert.severity === "High"
                          ? "bg-risk-orange/10 text-risk-orange border-risk-orange/20"
                          : selectedAlert.severity === "Warning"
                            ? "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/20"
                            : "bg-risk-green/10 text-risk-green border-risk-green/20"
                    }`}>
                      {selectedAlert.severity}
                    </span>
                  </div>
                </div>
                {selectedAlert.metricLabel && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{selectedAlert.metricLabel}</span>
                    <div className="text-xs font-bold text-blue-400">{selectedAlert.metricValue}</div>
                  </div>
                )}
              </div>

              {/* Recommended Action */}
              <div className="space-y-2 bg-secondary/15 rounded-xl p-4 border border-border/50">
                <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider block">Recommended Action</span>
                <p className="text-xs text-foreground leading-relaxed font-medium">
                  {selectedAlert.recommendedAction}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/60 bg-secondary/10 px-6 py-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                <Activity className="h-4 w-4 animate-pulse" />
                Future IoT Sensor Integration Ready
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-lg bg-secondary border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Dismiss Alert Details
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
      {/* Top glowing ambient line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 via-transparent to-primary/5 opacity-80" />
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground/90 transition-colors mb-4">{title}</h3>
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
