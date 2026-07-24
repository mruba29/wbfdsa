import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { db } from "@/lib/db";
import { assessBuilding } from "@/lib/vulnerability";
import {
  Building2,
  Flame,
  Users,
  ShieldAlert,
  Gauge,
  Layers,
  CheckCircle,
  XCircle,
  CloudFog,
  Zap,
  Fuel,
  X,
  AlertTriangle,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — WB-FDVA" },
      {
        name: "description",
        content: "Executive view of fire vulnerability, incidents, and infrastructure assets.",
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
    recommendedAction:
      "Initiate immediate evacuation protocol, trigger FM-200 suppression system in Server Room Z4, notify city fire department, and dispatch building emergency response team.",
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
    recommendedAction:
      "No emergency action required. Resume normal operations. Schedule routine filter replacement for laboratory HVAC duct A1.",
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
    recommendedAction:
      "Dispatch on-duty electrical engineer to check main breaker panel E-12, isolate secondary busbar, and verify backup generator line status.",
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
    recommendedAction:
      "Isolate main gas supply valve A-HQ, initiate localized ventilation fans, restrict access to Basement 1, and dispatch hazmat compliance technician.",
    metricLabel: "Concentration",
    metricValue: "450 ppm (Threshold: 100 ppm)",
    iconName: "Fuel",
  },
};

function Index() {
  const [selectedAlert, setSelectedAlert] = useState<AlertDetails | null>(null);

  // Database Queries
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const floors = useLiveQuery(() => db.floors.toArray(), []);
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const incidents = useLiveQuery(() => db.incidents.orderBy("startedAt").reverse().toArray(), []);
  const fireInventory = useLiveQuery(() => db.fireInventory.toArray(), []);

  // Data Aggregation
  const totalBuildings = buildings?.length ?? 0;
  const activeIncidents = incidents?.filter((i) => i.status === "active") ?? [];
  const activeIncidentsCount = activeIncidents.length;

  const totalCadFiles =
    buildings?.reduce((sum, b) => sum + (b.cadFiles ? b.cadFiles.length : 0), 0) ?? 0;

  const totalOccupants = zones?.reduce((sum, z) => sum + z.occupancy, 0) ?? 0;

  const allImpacts = useMemo(() => {
    if (!buildings || !floors || !zones) return [];
    return buildings.flatMap((b) => {
      const bFloors = floors.filter((f) => f.buildingId === b.id);
      const bZones = zones.filter((z) => z.buildingId === b.id);
      const incident = activeIncidents.find((i) => i.buildingId === b.id);
      const incFloor = incident
        ? bFloors.find((f) => f.id === incident.floorId)?.level ?? null
        : null;
      return assessBuilding(bZones, bFloors, incFloor);
    });
  }, [buildings, floors, zones, activeIncidents]);

  const avgVulnScore = allImpacts.length
    ? Math.round(allImpacts.reduce((s, z) => s + z.breakdown.total, 0) / allImpacts.length)
    : 28;

  const criticalBuildingsCount = useMemo(() => {
    if (!buildings) return 0;
    return buildings.filter((b) => {
      const hasActiveIncident = activeIncidents.some((i) => i.buildingId === b.id);
      const bFloors = floors?.filter((f) => f.buildingId === b.id) ?? [];
      const bZones = zones?.filter((z) => z.buildingId === b.id) ?? [];
      const bImpacts = assessBuilding(bZones, bFloors, null);
      const isHighRisk = bImpacts.some((imp) => imp.risk === "RED" || imp.risk === "ORANGE");
      return hasActiveIncident || isHighRisk;
    }).length;
  }, [buildings, activeIncidents, floors, zones]);

  const activeFireInventory =
    fireInventory?.filter((i) => {
      const isExpired = new Date() > new Date(i.expiryDate);
      return !isExpired && i.status !== "Under Maintenance";
    }).length ?? 0;

  const expiredFireInventory =
    fireInventory?.filter((i) => {
      return new Date() > new Date(i.expiryDate) || i.status === "Expired";
    }).length ?? 0;

  return (
    <AppShell
      title="Executive Dashboard"
      subtitle="Web-Based Fire Vulnerability Dynamic Assessment Platform"
    >
      <div className="space-y-8 animate-fade-in">
        {/* 1. Essential KPI Cards (4x2 Grid) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Key Performance Indicators
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time metrics across registered campus infrastructure
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Monitoring Active
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Buildings */}
            <KpiCard
              label="Total Buildings"
              value={totalBuildings}
              hint="Registered Facilities"
              icon={Building2}
              tone="default"
            />

            {/* Card 2: Active Incidents */}
            <KpiCard
              label="Active Incidents"
              value={activeIncidentsCount}
              hint="Unresolved Emergency Events"
              icon={Flame}
              tone={activeIncidentsCount > 0 ? "danger" : "success"}
            />

            {/* Card 3: CAD Files */}
            <KpiCard
              label="CAD Files"
              value={totalCadFiles}
              hint="Floor Plans & CAD Drawings"
              icon={Layers}
              tone="default"
            />

            {/* Card 4: Total Occupants */}
            <KpiCard
              label="Total Occupants"
              value={totalOccupants}
              hint="Personnel & Visitors Counted"
              icon={Users}
              tone="default"
            />

            {/* Card 5: Critical Buildings */}
            <KpiCard
              label="Critical Buildings"
              value={criticalBuildingsCount}
              hint="Priority Inspection Required"
              icon={ShieldAlert}
              tone={criticalBuildingsCount > 0 ? "warn" : "success"}
            />

            {/* Card 6: Average Vulnerability */}
            <KpiCard
              label="Average Vulnerability"
              value={`${avgVulnScore}%`}
              hint={avgVulnScore > 40 ? "Elevated Risk Index" : "Low Risk Profile"}
              icon={Gauge}
              tone={avgVulnScore > 40 ? "warn" : "success"}
            />

            {/* Card 7: Active Fire Inventory */}
            <KpiCard
              label="Active Fire Inventory"
              value={activeFireInventory}
              hint="Operational Safety Equipment"
              icon={CheckCircle}
              tone="success"
            />

            {/* Card 8: Expired Fire Inventory */}
            <KpiCard
              label="Expired Fire Inventory"
              value={expiredFireInventory}
              hint="Requires Replacement/Refill"
              icon={XCircle}
              tone={expiredFireInventory > 0 ? "danger" : "default"}
            />
          </div>
        </div>

        {/* 2. IoT Emergency Alerts (Fire, Smoke, Electrical Fault, Gas Leak) */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  IoT Emergency Sensor Network
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time telemetry and hazard alert status from deployed environmental sensors
                </CardDescription>
              </div>
              <Link
                to="/floor-plans"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                View Egress Plans <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(IOT_ALERTS_DATA).map(([key, alert]) => {
                const IconComponent = alertIcons[alert.iconName];
                const isCritical = alert.severity === "Critical";
                const isHigh = alert.severity === "High";
                const isWarning = alert.severity === "Warning";

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedAlert(alert)}
                    className={`group cursor-pointer p-4 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                      isCritical
                        ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60"
                        : isHigh
                          ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60"
                          : isWarning
                            ? "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/60"
                            : "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`p-2.5 rounded-lg ${
                          isCritical
                            ? "bg-rose-500/20 text-rose-500"
                            : isHigh
                              ? "bg-amber-500/20 text-amber-500"
                              : isWarning
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-emerald-500/20 text-emerald-500"
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isCritical
                            ? "bg-rose-500 text-white"
                            : isHigh
                              ? "bg-amber-500 text-black"
                              : isWarning
                                ? "bg-yellow-500 text-black"
                                : "bg-emerald-500 text-white"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-foreground mb-1 group-hover:text-primary transition-colors">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mb-2">{alert.building}</p>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{alert.floor}</span>
                      <span className="font-medium text-foreground">{alert.metricValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Modal / Drawer for Selected Alert Details */}
        {selectedAlert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {alertIcons[selectedAlert.iconName] &&
                      (() => {
                        const Icon = alertIcons[selectedAlert.iconName];
                        return <Icon className="h-6 w-6" />;
                      })()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{selectedAlert.title}</h3>
                    <p className="text-xs text-muted-foreground">Sensor: {selectedAlert.sensorId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Building</span>
                  <p className="font-bold text-foreground truncate">{selectedAlert.building}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Floor / Zone</span>
                  <p className="font-bold text-foreground">
                    {selectedAlert.floor} - {selectedAlert.zone}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Detection Time</span>
                  <p className="font-bold text-foreground">{selectedAlert.detectionTime}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Telemetry Level</span>
                  <p className="font-bold text-primary">{selectedAlert.metricValue}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  Recommended Action
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {selectedAlert.recommendedAction}
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors"
                >
                  Close Diagnostic View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
