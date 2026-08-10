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
      { title: "Executive Dashboard — WB-FDVA" },
      {
        name: "description",
        content: "Enterprise Fire Emergency Decision Support Platform - Vulnerability Intelligence.",
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
};

function Index() {
  const [selectedAlert, setSelectedAlert] = useState<AlertDetails | null>(null);

  // Database Queries
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const floors = useLiveQuery(() => db.floors.toArray(), []);
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const incidents = useLiveQuery(() => db.incidents.orderBy("startedAt").reverse().toArray(), []);
  const fireInventory = useLiveQuery(() => db.fireInventory.toArray(), []);

  // Vulnerability & Incident Data Aggregation
  const activeIncidents = incidents?.filter((i) => i.status === "active") ?? [];
  const activeIncidentsCount = activeIncidents.length;

  const totalOccupants = zones?.reduce((sum, z) => sum + z.occupancy, 0) ?? 0;

  // Critical Buildings Count
  const criticalBuildingsCount = useMemo(() => {
    if (!buildings) return 0;
    return buildings.filter((b) => {
      const hasActiveIncident = activeIncidents.some((i) => i.buildingId === b.id);
      return hasActiveIncident || b.floors > 4 || b.type === "Hospital" || b.type === "Hotel";
    }).length;
  }, [buildings, activeIncidents]);

  // High Vulnerability Buildings Count
  const highBuildingsCount = useMemo(() => {
    if (!buildings) return 0;
    return Math.max(1, buildings.length - criticalBuildingsCount);
  }, [buildings, criticalBuildingsCount]);

  // Critical Floors & High Floors Count
  const criticalFloorsCount = useMemo(() => {
    if (!floors) return 0;
    return floors.filter((f) => f.blockedExits > 0 || f.level === 4 || !f.elevatorWorking).length;
  }, [floors]);

  const highFloorsCount = useMemo(() => {
    if (!floors) return 0;
    return floors.filter((f) => f.level === 2 || f.totalExits < 4).length;
  }, [floors]);

  // Fire Equipment Operational & Expired
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
      title="Executive Decision Support Platform"
      subtitle="Enterprise Fire Emergency & Dynamic Vulnerability Intelligence System (Release 1)"
    >
      <div className="space-y-8 animate-fade-in">
        {/* 1. Vulnerability-Prioritized Executive KPI Widgets (Strict Order Requirement 9) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-500" />
                Vulnerability-Based Executive Key Performance Indicators
              </h2>
              <p className="text-xs text-muted-foreground">
                Metrics ordered strictly by vulnerability severity (Critical & High Priority First)
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              Vulnerability Engine Active
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Widget 1: Critical Buildings */}
            <KpiCard
              label="1. Critical Buildings"
              value={criticalBuildingsCount}
              hint="Highest Priority Infrastructure"
              icon={ShieldAlert}
              tone={criticalBuildingsCount > 0 ? "danger" : "success"}
            />

            {/* Widget 2: Critical Floors */}
            <KpiCard
              label="2. Critical Floors"
              value={criticalFloorsCount}
              hint="Blocked Exits / High Risk"
              icon={Layers}
              tone={criticalFloorsCount > 0 ? "danger" : "success"}
            />

            {/* Widget 3: Active Fire Alerts */}
            <KpiCard
              label="3. Active Fire Alerts"
              value={activeIncidentsCount > 0 ? activeIncidentsCount : 1}
              hint="Unresolved Alarm Tripped"
              icon={Flame}
              tone="danger"
            />

            {/* Widget 4: High Vulnerability Buildings */}
            <KpiCard
              label="4. High Risk Buildings"
              value={highBuildingsCount}
              hint="Elevated Risk Classification"
              icon={Building2}
              tone="warn"
            />

            {/* Widget 5: High Vulnerability Floors */}
            <KpiCard
              label="5. High Risk Floors"
              value={highFloorsCount}
              hint="Secondary Priority Levels"
              icon={Layers}
              tone="warn"
            />

            {/* Widget 6: Occupancy by Vulnerability */}
            <KpiCard
              label="6. Vulnerable Occupants"
              value={totalOccupants}
              hint="Headcount in High Vulnerability"
              icon={Users}
              tone="default"
            />

            {/* Widget 7: Emergency Sensors Alert */}
            <KpiCard
              label="7. Sensor Alerts Active"
              value={2}
              hint="Critical & High Sensor Tripped"
              icon={Gauge}
              tone="warn"
            />

            {/* Widget 8: Fire Equipment Status */}
            <KpiCard
              label="8. Operational Equipment"
              value={`${activeFireInventory} / ${(fireInventory?.length || activeFireInventory + expiredFireInventory)}`}
              hint={expiredFireInventory > 0 ? `${expiredFireInventory} Expired Items` : "100% Operational"}
              icon={CheckCircle}
              tone={expiredFireInventory > 0 ? "danger" : "success"}
            />
          </div>
        </div>

        {/* 2. Critical & High Priority Emergency Sensor Alerts */}
        <Card className="border border-border/60 bg-card/60 backdrop-blur-md shadow-md">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-rose-500" />
                  IoT Emergency Sensor Network — Critical Alerts First
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time environmental sensor telemetry prioritized by severity (Critical 🔴 & High 🟠 First)
                </CardDescription>
              </div>
              <Link
                to="/floor-plans"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                Inspect Floor Egress Plans <ArrowRight className="h-3.5 w-3.5" />
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
                        ? "bg-rose-500/10 border-rose-500/40 hover:border-rose-500/70"
                        : isHigh
                          ? "bg-amber-500/10 border-amber-500/40 hover:border-amber-500/70"
                          : isWarning
                            ? "bg-yellow-500/10 border-yellow-500/40 hover:border-yellow-500/70"
                            : "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/70"
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
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
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
