import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  X,
  AlertTriangle,
  Shield,
  Activity,
  Baby,
  User,
  Accessibility,
  HeartPulse,
  Heart,
  Users,
  RefreshCw,
  Building2,
  Layers,
  Grid,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db, type Personnel, type SpecialNeedCategory, type IVARiskClass } from "@/lib/db";
import { computeIndividualVulnerability, IVA_RISK_COLORS } from "@/lib/vulnerability";
import { seedIndianPersonnel } from "@/lib/seed";


export const Route = createFileRoute("/personnel")({
  head: () => ({
    meta: [
      { title: "Personnel — WB-FDVA" },
      {
        name: "description",
        content:
          "Personnel database with IVA scores, disability factors, and evacuation priorities.",
      },
    ],
  }),
  component: PersonnelPage,
});

const SPECIAL_NEED_OPTIONS: SpecialNeedCategory[] = [
  "None",
  "Pregnant Woman",
  "Elderly",
  "Child",
  "Toddler",
  "Wheelchair User",
  "Walking Stick User",
  "Vision Impaired",
  "Hearing Impaired",
  "Temporary Injury",
  "ICU Patient",
  "Critical Patient",
  "Oxygen Support",
];

const DISABILITY_OPTIONS: { label: string; value: number }[] = [
  { label: "1.00 — Perfectly fit", value: 1.0 },
  { label: "0.75 — Minor mobility limitation", value: 0.75 },
  { label: "0.50 — Moderate mobility limitation", value: 0.5 },
  { label: "0.25 — Severe disability", value: 0.25 },
  { label: "0.00 — Completely immobile / wheelchair dependent", value: 0.0 },
];

const EMPTY: Omit<Personnel, "id"> = {
  employeeId: "",
  name: "",
  age: 30,
  gender: "M",
  department: "Operations",
  assignedFloor: 1,
  cardId: "",
  deviceId: "",
  specialNeeds: false,
  emergencyContact: "",
  disabilityFactor: 1.0,
  specialNeedCategory: "None",
  individualVulnerabilityScore: 0,
  individualRiskClass: "Low",
  evacuationPriority: 7,
};

// Compute and attach IVA fields whenever a form is saved
function withIVA(form: Omit<Personnel, "id">): Omit<Personnel, "id"> {
  const iva = computeIndividualVulnerability({
    age: form.age,
    disabilityFactor: form.disabilityFactor,
    specialNeedCategory: form.specialNeedCategory,
    assignedFloor: form.assignedFloor,
    gender: form.gender,
  });
  return {
    ...form,
    specialNeeds: form.specialNeedCategory !== "None",
    individualVulnerabilityScore: iva.score,
    individualRiskClass: iva.riskClass,
    evacuationPriority: iva.evacuationPriority,
  };
}

// Risk class badge colours (CSS var-based, same as the rest of the app)
const IVA_BADGE_CLASS: Record<IVARiskClass, string> = {
  Low: "bg-[color:var(--risk-green)]/15 text-[color:var(--risk-green)] border border-[color:var(--risk-green)]/30",
  Medium: "bg-[color:var(--risk-yellow)]/15 text-[color:var(--risk-yellow)] border border-[color:var(--risk-yellow)]/30",
  High: "bg-[color:var(--risk-orange)]/15 text-[color:var(--risk-orange)] border border-[color:var(--risk-orange)]/30",
  Critical: "bg-[color:var(--risk-red)]/15 text-[color:var(--risk-red)] border border-[color:var(--risk-red)]/30",
};

const PRIORITY_ICON: Record<number, string> = {
  1: "🚨",
  2: "🤰",
  3: "♿",
  4: "👴",
  5: "👶",
  6: "🦺",
  7: "🟢",
};

function PersonnelPage() {
  const [q, setQ] = useState("");
  const [vulnFilter, setVulnFilter] = useState<string>("all");
  const list = useLiveQuery(() => db.personnel.toArray(), []);

  // Spatial & Vulnerability Data Queries
  const rawBuildings = useLiveQuery(() => db.buildings.toArray(), []);
  const rawFloors = useLiveQuery(() => db.floors.toArray(), []);
  const rawZones = useLiveQuery(() => db.zones.toArray(), []);
  const rawIncidents = useLiveQuery(() => db.incidents.where("status").equals("active").toArray(), []);

  // Selection States for Dynamic Heatmap & Filtering
  const [selectedCampus, setSelectedCampus] = useState<string>("All Campuses");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | "all">("all");
  const [selectedFloorLevel, setSelectedFloorLevel] = useState<number | "all">("all");

  const [editing, setEditing] = useState<Personnel | null>(null);
  const [creating, setCreating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (list !== undefined && list.length === 0) {
      console.log("[WB-FDVA] Personnel table is empty. Auto-seeding Indian personnel records...");
      seedIndianPersonnel().catch((err) => console.error("Auto-seed error:", err));
    }
  }, [list]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedIndianPersonnel();
    } catch (err) {
      console.error("Manual seed error:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Available Campuses
  const campuses = useMemo(() => {
    const set = new Set<string>(["All Campuses"]);
    if (rawBuildings) {
      rawBuildings.forEach((b) => {
        if (b.ownerName) set.add(b.ownerName);
      });
    }
    return Array.from(set);
  }, [rawBuildings]);

  // 1. COMPUTED & SORTED BUILDINGS BY VULNERABILITY SCORE (Highest Risk First)
  const sortedBuildings = useMemo(() => {
    if (!rawBuildings || rawBuildings.length === 0) {
      return [
        { id: 1, name: "Main Building (Corporate HQ)", ownerName: "CM", floors: 5, vulnerabilityScore: 88, riskClass: "Critical" as IVARiskClass, totalOccupants: 140, hasIncident: true },
        { id: 2, name: "Annex Tower B", ownerName: "Velam Mall", floors: 3, vulnerabilityScore: 62, riskClass: "High" as IVARiskClass, totalOccupants: 75, hasIncident: false },
        { id: 3, name: "Sangam Complex", ownerName: "Sangam Mall", floors: 2, vulnerabilityScore: 34, riskClass: "Medium" as IVARiskClass, totalOccupants: 45, hasIncident: false },
      ];
    }

    const filtered = selectedCampus === "All Campuses"
      ? rawBuildings
      : rawBuildings.filter((b) => b.ownerName === selectedCampus || (selectedCampus === "CM" && (!b.ownerName || b.ownerName === "CM")));

    return filtered.map((b) => {
      const bId = b.id ?? 1;
      const hasIncident = rawIncidents?.some((inc) => inc.buildingId === bId) ?? false;
      const bZones = rawZones?.filter((z) => z.buildingId === bId) ?? [];
      const totalOccupants = bZones.length > 0
        ? bZones.reduce((sum, z) => sum + z.occupancy, 0)
        : (b.peoplePerFloor || 35) * (b.floors || 1);

      // Compute occupant average IVA
      const bPersonnel = (list ?? []).filter((p) => p.assignedFloor <= b.floors);
      const avgIVA = bPersonnel.length > 0
        ? (bPersonnel.reduce((sum, p) => sum + (p.individualVulnerabilityScore ?? 0), 0) / bPersonnel.length) * 100
        : 25;

      let score = Math.round(avgIVA * 0.35 + (hasIncident ? 45 : 0) + (b.type === "Hospital" || b.type === "Hotel" ? 15 : 5) + (b.floors > 3 ? 12 : 4) + Math.min(20, totalOccupants / 8));
      score = Math.min(98, Math.max(18, score));

      let riskClass: IVARiskClass = "Low";
      if (score >= 75 || hasIncident) riskClass = "Critical";
      else if (score >= 55) riskClass = "High";
      else if (score >= 35) riskClass = "Medium";

      return {
        ...b,
        vulnerabilityScore: score,
        riskClass,
        totalOccupants,
        hasIncident,
      };
    }).sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
  }, [rawBuildings, selectedCampus, rawIncidents, rawZones, list]);

  // 2. COMPUTED & SORTED FLOORS BY VULNERABILITY SCORE (Highest Risk First)
  const sortedFloors = useMemo(() => {
    let targetBuildingId = selectedBuildingId;

    const availableFloors = (rawFloors && rawFloors.length > 0)
      ? (targetBuildingId === "all" ? rawFloors : rawFloors.filter((f) => f.buildingId === targetBuildingId))
      : [
          { id: 1, level: 4, name: "Floor 4 — Executive & Operations", buildingId: 1, availableExits: 1, blockedExits: 1, elevatorWorking: false },
          { id: 2, level: 3, name: "Floor 3 — Research & IT", buildingId: 1, availableExits: 2, blockedExits: 0, elevatorWorking: true },
          { id: 3, level: 2, name: "Floor 2 — Administration", buildingId: 1, availableExits: 2, blockedExits: 0, elevatorWorking: true },
          { id: 4, level: 1, name: "Floor 1 — Lobby & Reception", buildingId: 1, availableExits: 3, blockedExits: 0, elevatorWorking: true },
        ];

    return availableFloors.map((f) => {
      const fLevel = f.level;
      const bId = f.buildingId;
      const isIncidentOnFloor = rawIncidents?.some(
        (inc) => (targetBuildingId === "all" || inc.buildingId === bId) && inc.floorId === f.id
      ) ?? (fLevel === 4);

      const fZones = (rawZones ?? []).filter(
        (z) => z.floorId === f.id || (z.buildingId === bId && z.floorId === f.id)
      );
      const fPersonnel = (list ?? []).filter((p) => p.assignedFloor === fLevel);
      const fOccupancy = fZones.reduce((sum, z) => sum + z.occupancy, 0) || fPersonnel.length || (fLevel * 12 + 10);

      const avgIVA = fPersonnel.length > 0
        ? (fPersonnel.reduce((sum, p) => sum + (p.individualVulnerabilityScore ?? 0), 0) / fPersonnel.length) * 100
        : 22;

      let score = Math.round(avgIVA * 0.35 + (isIncidentOnFloor ? 45 : 0) + (f.blockedExits > 0 ? 15 : 0) + (!f.elevatorWorking ? 10 : 0) + (fLevel * 6) + Math.min(18, fOccupancy / 5));
      score = Math.min(99, Math.max(14, score));

      let riskClass: IVARiskClass = "Low";
      if (score >= 75 || isIncidentOnFloor) riskClass = "Critical";
      else if (score >= 55) riskClass = "High";
      else if (score >= 35) riskClass = "Medium";

      return {
        ...f,
        vulnerabilityScore: score,
        riskClass,
        occupancy: fOccupancy,
        isIncidentOnFloor,
      };
    }).sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);
  }, [rawFloors, selectedBuildingId, rawIncidents, rawZones, list]);

  // 3. COMPUTED HEATMAP ZONES (Filtered dynamically by Campus, Building, Floor)
  const heatmapZones = useMemo(() => {
    let zonesList: Array<{
      id: string | number;
      name: string;
      buildingName: string;
      floorLevel: number;
      occupancy: number;
      specialNeedsCount: number;
      densityCategory: "Low" | "Medium" | "High" | "Critical";
      colorClass: string;
      bgClass: string;
      borderClass: string;
      hasIncident?: boolean;
    }> = [];

    const activeBuilding = sortedBuildings.find((b) => selectedBuildingId !== "all" && b.id === selectedBuildingId) || sortedBuildings[0];
    const bName = activeBuilding?.name || "Main Building";

    if (rawZones && rawZones.length > 0) {
      const filtered = rawZones.filter((z) => {
        if (selectedBuildingId !== "all" && z.buildingId !== selectedBuildingId) return false;
        if (selectedFloorLevel !== "all") {
          const fl = rawFloors?.find((f) => f.id === z.floorId);
          if (fl && fl.level !== selectedFloorLevel) return false;
        }
        return true;
      });

      zonesList = filtered.map((z) => {
        const fl = rawFloors?.find((f) => f.id === z.floorId);
        const fLevel = fl?.level ?? 1;
        const occ = z.occupancy;
        const hasInc = rawIncidents?.some((inc) => inc.zoneId === z.id) || false;

        let densityCategory: "Low" | "Medium" | "High" | "Critical" = "Low";
        let colorClass = "text-emerald-400";
        let bgClass = "bg-emerald-500/10 hover:bg-emerald-500/20";
        let borderClass = "border-emerald-500/30";

        if (occ > 40 || hasInc) {
          densityCategory = "Critical";
          colorClass = "text-risk-red";
          bgClass = "bg-risk-red/15 hover:bg-risk-red/25";
          borderClass = "border-risk-red/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]";
        } else if (occ > 25) {
          densityCategory = "High";
          colorClass = "text-risk-orange";
          bgClass = "bg-risk-orange/15 hover:bg-risk-orange/25";
          borderClass = "border-risk-orange/40";
        } else if (occ > 10) {
          densityCategory = "Medium";
          colorClass = "text-risk-yellow";
          bgClass = "bg-risk-yellow/15 hover:bg-risk-yellow/25";
          borderClass = "border-risk-yellow/40";
        }

        return {
          id: z.id ?? z.zoneId,
          name: `${z.name} (${z.type})`,
          buildingName: bName,
          floorLevel: fLevel,
          occupancy: occ,
          specialNeedsCount: z.specialNeeds || 0,
          densityCategory,
          colorClass,
          bgClass,
          borderClass,
          hasIncident: hasInc,
        };
      });
    }

    if (zonesList.length === 0) {
      const activeLevel = selectedFloorLevel === "all" ? 1 : selectedFloorLevel;
      const fPersonnel = (list ?? []).filter((p) => selectedFloorLevel === "all" || p.assignedFloor === selectedFloorLevel);
      const totalP = fPersonnel.length || 45;

      const templateZones = [
        { name: "Zone A — Main Workstations", ratio: 0.35, type: "Office" },
        { name: "Zone B — Executive Suites", ratio: 0.20, type: "Office" },
        { name: "Zone C — Conference & Meeting Hall", ratio: 0.25, type: "Conference" },
        { name: "Zone D — Server & IT Infra Room", ratio: 0.08, type: "Server" },
        { name: "Zone E — Breakout Lounge & Kitchen", ratio: 0.12, type: "Lobby" },
      ];

      zonesList = templateZones.map((tz, idx) => {
        const occ = Math.max(4, Math.round(totalP * tz.ratio));
        const specCount = fPersonnel.filter((p, i) => i % (idx + 2) === 0 && p.specialNeeds).length;
        const hasInc = activeLevel === 4 && idx === 0;

        let densityCategory: "Low" | "Medium" | "High" | "Critical" = "Low";
        let colorClass = "text-emerald-400";
        let bgClass = "bg-emerald-500/10 hover:bg-emerald-500/20";
        let borderClass = "border-emerald-500/30";

        if (occ > 30 || hasInc) {
          densityCategory = "Critical";
          colorClass = "text-risk-red";
          bgClass = "bg-risk-red/15 hover:bg-risk-red/25";
          borderClass = "border-risk-red/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]";
        } else if (occ > 20) {
          densityCategory = "High";
          colorClass = "text-risk-orange";
          bgClass = "bg-risk-orange/15 hover:bg-risk-orange/25";
          borderClass = "border-risk-orange/40";
        } else if (occ > 10) {
          densityCategory = "Medium";
          colorClass = "text-risk-yellow";
          bgClass = "bg-risk-yellow/15 hover:bg-risk-yellow/25";
          borderClass = "border-risk-yellow/40";
        }

        return {
          id: `syn-${idx}`,
          name: tz.name,
          buildingName: bName,
          floorLevel: activeLevel,
          occupancy: occ,
          specialNeedsCount: specCount,
          densityCategory,
          colorClass,
          bgClass,
          borderClass,
          hasIncident: hasInc,
        };
      });
    }

    return zonesList;
  }, [rawZones, rawFloors, selectedBuildingId, selectedFloorLevel, sortedBuildings, rawIncidents, list]);

  const counts = {
    all: list?.length ?? 0,
    children: (list ?? []).filter((p) => p.age <= 5).length,
    women60: (list ?? []).filter((p) => p.gender === "F" && p.age >= 60).length,
    disabled: (list ?? []).filter((p) => (p.disabilityFactor ?? 1) < 1.0).length,
    patients: (list ?? []).filter((p) => ["Critical Patient", "Oxygen Support", "ICU Patient"].includes(p.specialNeedCategory ?? "")).length,
    pregnant: (list ?? []).filter((p) => p.specialNeedCategory === "Pregnant Woman").length,
    high: (list ?? []).filter((p) => 
      p.age <= 5 || 
      p.age >= 60 || 
      (p.disabilityFactor ?? 1) < 1.0 || 
      ["Critical Patient", "Oxygen Support", "ICU Patient"].includes(p.specialNeedCategory ?? "") || 
      p.specialNeedCategory === "Pregnant Woman"
    ).length,
  };

  const filtered = (list ?? []).filter((p) => {
    // Spatial floor filter if selected
    if (selectedFloorLevel !== "all" && p.assignedFloor !== selectedFloorLevel) {
      return false;
    }

    // Text search
    if (q) {
      const s = q.toLowerCase();
      if (
        !p.name.toLowerCase().includes(s) &&
        !p.employeeId.toLowerCase().includes(s) &&
        !p.department.toLowerCase().includes(s) &&
        !(p.specialNeedCategory ?? "").toLowerCase().includes(s)
      ) {
        return false;
      }
    }

    // Vulnerability filter
    if (vulnFilter === "all") return true;
    if (vulnFilter === "children") return p.age <= 5;
    if (vulnFilter === "women60") return p.gender === "F" && p.age >= 60;
    if (vulnFilter === "disabled") return (p.disabilityFactor ?? 1) < 1.0;
    if (vulnFilter === "patients") return ["Critical Patient", "Oxygen Support", "ICU Patient"].includes(p.specialNeedCategory ?? "");
    if (vulnFilter === "pregnant") return p.specialNeedCategory === "Pregnant Woman";
    if (vulnFilter === "high") {
      return (
        p.age <= 5 || 
        p.age >= 60 || 
        (p.disabilityFactor ?? 1) < 1.0 || 
        ["Critical Patient", "Oxygen Support", "ICU Patient"].includes(p.specialNeedCategory ?? "") || 
        p.specialNeedCategory === "Pregnant Woman"
      );
    }
    return true;
  });

  // Sort strictly by Individual Vulnerability Score descending (Highest vulnerability first)
  const sorted = [...filtered].sort((a, b) => {
    const scoreDiff = (b.individualVulnerabilityScore ?? 0) - (a.individualVulnerabilityScore ?? 0);
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
    const pa = a.evacuationPriority ?? 7;
    const pb = b.evacuationPriority ?? 7;
    return pa - pb;
  });

  return (
    <AppShell
      title="Personnel Management"
      subtitle={`${list?.length ?? 0} occupants registered · Prioritized by Individual Vulnerability Score`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
            title="Populate 50 sample Indian personnel records across all vulnerability categories"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${isSeeding ? "animate-spin" : ""}`} />
            {isSeeding ? "Seeding..." : "Seed Indian Data"}
          </button>
          <button
            onClick={() => {
              console.log("Add button clicked!");
              setCreating(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      }
    >
      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Total" value={list?.length ?? 0} />
        <StatCard label="Male" value={(list ?? []).filter((p) => p.gender === "M").length} />
        <StatCard label="Female" value={(list ?? []).filter((p) => p.gender === "F").length} />
        <StatCard label="Aged 60+" value={(list ?? []).filter((p) => p.age >= 60).length} />
        <StatCard label="Infants (≤5)" value={(list ?? []).filter((p) => p.age <= 5).length} />
        <StatCard
          label="Pregnant"
          value={(list ?? []).filter((p) => p.specialNeedCategory === "Pregnant Woman").length}
        />
        <StatCard
          label="Patients"
          value={
            (list ?? []).filter((p) =>
              ["Critical Patient", "Oxygen Support", "ICU Patient"].includes(
                p.specialNeedCategory ?? "",
              ),
            ).length
          }
        />
        <StatCard
          label="Disabilities"
          value={(list ?? []).filter((p) => (p.disabilityFactor ?? 1) < 1.0).length}
        />
      </div>

      {/* Campus Selector & Spatial Risk Filter Header */}
      <div className="mb-6 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Spatial Risk & Vulnerability Analysis
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Select Campus:</label>
            <select
              value={selectedCampus}
              onChange={(e) => {
                setSelectedCampus(e.target.value);
                setSelectedBuildingId("all");
                setSelectedFloorLevel("all");
              }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              {campuses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. Building Cards (Sorted automatically by Vulnerability Score - Descending) */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Building Cards <span className="text-primary">(Sorted by Highest Vulnerability Score First)</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Showing {sortedBuildings.length} buildings
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedBuildings.map((b) => {
              const isSelected = selectedBuildingId === b.id;
              const badgeClass = IVA_BADGE_CLASS[b.riskClass];
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBuildingId(isSelected ? "all" : b.id!);
                    setSelectedFloorLevel("all");
                  }}
                  className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      : "border-border/60 bg-secondary/40 hover:border-border hover:bg-secondary/70"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        {b.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {b.ownerName || "Campus"} · {b.floors} Floors
                      </div>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                      {b.riskClass}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <span className="text-muted-foreground text-[11px]">Vulnerability Score</span>
                    <span
                      className="font-mono font-bold text-sm"
                      style={{ color: IVA_RISK_COLORS[b.riskClass] }}
                    >
                      {b.vulnerabilityScore}%
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Occupants: <strong className="text-foreground">{b.totalOccupants}</strong></span>
                    {b.hasIncident && (
                      <span className="inline-flex items-center gap-1 text-risk-red font-semibold animate-pulse">
                        <AlertTriangle className="h-3 w-3" /> Active Incident
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Floor Cards (Sorted automatically by Vulnerability Score - Descending) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Floor Cards <span className="text-primary">(Sorted by Highest Vulnerability Score First)</span>
            </span>
            {selectedBuildingId !== "all" && (
              <button
                onClick={() => setSelectedFloorLevel("all")}
                className="text-[10px] text-primary hover:underline"
              >
                Reset Floor Selection
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {sortedFloors.map((f) => {
              const isSelected = selectedFloorLevel === f.level;
              const badgeClass = IVA_BADGE_CLASS[f.riskClass];
              return (
                <div
                  key={`${f.buildingId}-${f.id}-${f.level}`}
                  onClick={() => setSelectedFloorLevel(isSelected ? "all" : f.level)}
                  className={`cursor-pointer rounded-lg border p-2.5 transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                      : "border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-foreground">
                      Floor {f.level}
                    </span>
                    <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${badgeClass}`}>
                      {f.riskClass}
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground truncate" title={f.name}>
                    {f.name}
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-border/30 pt-1.5 text-[11px]">
                    <span className="text-muted-foreground">Vuln Score</span>
                    <span
                      className="font-mono font-bold"
                      style={{ color: IVA_RISK_COLORS[f.riskClass] }}
                    >
                      {f.vulnerabilityScore}%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between">
                    <span>{f.occupancy} occupants</span>
                    {f.isIncidentOnFloor && <span className="text-risk-red font-bold">🚨 Risk</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. OCCUPANCY HEATMAP SECTION (Positioned above Personnel Table) */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Occupancy Heatmap
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live spatial distribution by floor and room/zone · Updates dynamically on Campus, Building, and Floor filter
            </p>
          </div>

          {/* Color Coding Legend */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">Green = Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
              <span className="text-muted-foreground">Yellow = Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <span className="text-muted-foreground">Orange = High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
              <span className="text-muted-foreground">Red = Critical</span>
            </div>
          </div>
        </div>

        {/* Zone Heatmap Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {heatmapZones.map((z) => (
            <div
              key={z.id}
              className={`rounded-lg border ${z.borderClass} ${z.bgClass} p-3 transition-all duration-200 backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className="font-semibold text-xs text-foreground truncate pr-1" title={z.name}>
                  {z.name}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${z.colorClass} border ${z.borderClass}`}>
                  {z.densityCategory}
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground mb-2">
                {z.buildingName} · Floor {z.floorLevel}
              </div>

              <div className="flex items-baseline justify-between border-t border-border/40 pt-2">
                <span className="text-xs text-muted-foreground font-medium">Occupant Count:</span>
                <span className={`font-mono text-base font-black ${z.colorClass}`}>
                  {z.occupancy} <span className="text-[10px] font-normal text-muted-foreground">people</span>
                </span>
              </div>

              {z.specialNeedsCount > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {z.specialNeedsCount} special needs occupants
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, ID, department, or special need"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Personnel Vulnerability Filters */}
      <div className="mb-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Personnel Vulnerability Filters
        </h3>
        <div className="flex flex-wrap gap-2">
          <FilterChip 
            active={vulnFilter === "all"} 
            onClick={() => setVulnFilter("all")}
            icon={Users}
            label="All Personnel"
            count={counts.all}
          />
          <FilterChip 
            active={vulnFilter === "children"} 
            onClick={() => setVulnFilter("children")}
            icon={Baby}
            label="Children Below 5"
            count={counts.children}
            colorClass="text-blue-400"
          />
          <FilterChip 
            active={vulnFilter === "women60"} 
            onClick={() => setVulnFilter("women60")}
            icon={User}
            label="Women Above 60"
            count={counts.women60}
            colorClass="text-purple-400"
          />
          <FilterChip 
            active={vulnFilter === "disabled"} 
            onClick={() => setVulnFilter("disabled")}
            icon={Accessibility}
            label="Disabled Personnel"
            count={counts.disabled}
            colorClass="text-orange-400"
          />
          <FilterChip 
            active={vulnFilter === "patients"} 
            onClick={() => setVulnFilter("patients")}
            icon={HeartPulse}
            label="Patients"
            count={counts.patients}
            colorClass="text-pink-400"
          />
          <FilterChip 
            active={vulnFilter === "pregnant"} 
            onClick={() => setVulnFilter("pregnant")}
            icon={Heart}
            label="Pregnant Women"
            count={counts.pregnant}
            colorClass="text-rose-400"
          />
          <FilterChip 
            active={vulnFilter === "high"} 
            onClick={() => setVulnFilter("high")}
            icon={AlertTriangle}
            label="High Vulnerable"
            count={counts.high}
            colorClass="text-risk-red"
            isAlert
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Name / Age</th>
              <th className="px-3 py-2 text-left">Dept</th>
              <th className="px-3 py-2 text-center">Floor</th>
              <th className="px-3 py-2 text-left">Special Need</th>
              <th className="px-3 py-2 text-center">Disability</th>
              <th className="px-3 py-2 text-center">IVA Score</th>
              <th className="px-3 py-2 text-center">Risk</th>
              <th className="px-3 py-2 text-center">Priority</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.slice(0, 150).map((p) => {
              const riskClass: IVARiskClass = (p.individualRiskClass as IVARiskClass) ?? "Low";
              const priority = p.evacuationPriority ?? 7;
              const score = p.individualVulnerabilityScore ?? 0;
              return (
                <tr key={p.id} className="hover:bg-secondary/40">
                  <td className="px-3 py-2 font-mono text-xs">{p.employeeId}</td>
                  <td className="px-3 py-2">
                    {p.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {p.age}y · {p.gender}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{p.department}</td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    F{p.assignedFloor ?? 1}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.specialNeedCategory && p.specialNeedCategory !== "None" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-accent/20 text-accent px-1.5 py-0.5 text-[10px] font-semibold">
                        <AlertTriangle className="h-3 w-3" /> {p.specialNeedCategory}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono">
                    {(p.disabilityFactor ?? 1.0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs font-bold">
                    <span style={{ color: IVA_RISK_COLORS[riskClass] }}>
                      {(score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${IVA_BADGE_CLASS[riskClass]}`}
                    >
                      {riskClass}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-sm">
                    <span title={`Priority ${priority}`}>
                      {PRIORITY_ICON[priority] ?? "🟢"}{" "}
                      <span className="text-[10px] text-muted-foreground">P{priority}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing(p)}
                      className="mr-1 inline-grid h-7 w-7 place-items-center rounded hover:bg-secondary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => db.personnel.delete(p.id!)}
                      className="inline-grid h-7 w-7 place-items-center rounded text-risk-red hover:bg-risk-red/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No personnel match your search.
          </div>
        )}
      </div>

      {/* Form modal */}
      {(creating || editing) &&
        typeof document !== "undefined" &&
        createPortal(
          <PersonnelForm
            key={editing ? editing.id : "new"}
            initial={editing ?? EMPTY}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={async (data) => {
              const enriched = withIVA(data);
              if (editing) await db.personnel.update(editing.id!, enriched);
              else await db.personnel.add(enriched);
              setCreating(false);
              setEditing(null);
            }}
          />,
          document.body
        )}
    </AppShell>
  );
}

// ─── Personnel Form ──────────────────────────────────────────────────────────
function PersonnelForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Omit<Personnel, "id"> | Personnel;
  onClose: () => void;
  onSave: (p: Omit<Personnel, "id">) => void;
}) {
  const [form, setForm] = useState({ ...initial });

  console.log("PersonnelForm rendering! form:", form);

  // Live preview of the IVA result as the user edits
  const preview = computeIndividualVulnerability({
    age: form.age,
    disabilityFactor: form.disabilityFactor ?? 1.0,
    specialNeedCategory: form.specialNeedCategory ?? "None",
    assignedFloor: form.assignedFloor ?? 1,
    gender: form.gender,
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">
            {"id" in initial && (initial as Personnel).id ? "Edit Personnel" : "Add Personnel"}
          </h3>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const { id: _i, ...rest } = form as Personnel;
            onSave(rest);
          }}
          className="grid gap-3 p-5 sm:grid-cols-2"
        >
          {/* Basic info */}
          <TextInput
            label="Employee ID"
            value={form.employeeId}
            onChange={(v) => setForm({ ...form, employeeId: v })}
            required
          />
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <TextInput
            label="Age"
            type="number"
            value={String(form.age)}
            onChange={(v) => setForm({ ...form, age: +v })}
            required
          />

          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Gender</span>
            <select
              className="input w-full"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Personnel["gender"] })}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <TextInput
            label="Department"
            value={form.department}
            onChange={(v) => setForm({ ...form, department: v })}
            required
          />

          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">
              Assigned Floor <span className="text-risk-red">*</span>
            </span>
            <input
              className="input w-full"
              type="number"
              min={1}
              max={50}
              value={form.assignedFloor ?? 1}
              onChange={(e) => setForm({ ...form, assignedFloor: +e.target.value })}
            />
          </label>

          <TextInput
            label="Card ID"
            value={form.cardId}
            onChange={(v) => setForm({ ...form, cardId: v })}
          />
          <TextInput
            label="Device ID"
            value={form.deviceId}
            onChange={(v) => setForm({ ...form, deviceId: v })}
          />
          <TextInput
            label="Emergency Contact"
            value={form.emergencyContact}
            onChange={(v) => setForm({ ...form, emergencyContact: v })}
          />

          {/* IVA section */}
          <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <Activity className="h-3.5 w-3.5" /> Individual Vulnerability Assessment
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="block text-muted-foreground mb-1">Disability Factor</span>
                <select
                  className="input w-full"
                  value={form.disabilityFactor ?? 1.0}
                  onChange={(e) =>
                    setForm({ ...form, disabilityFactor: parseFloat(e.target.value) })
                  }
                >
                  {DISABILITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs">
                <span className="block text-muted-foreground mb-1">Special Need Category</span>
                <select
                  className="input w-full"
                  value={form.specialNeedCategory ?? "None"}
                  onChange={(e) =>
                    setForm({ ...form, specialNeedCategory: e.target.value as SpecialNeedCategory })
                  }
                >
                  {SPECIAL_NEED_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Live IVA preview */}
          <div className="sm:col-span-2 rounded-md border border-border bg-secondary/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Live IVA Preview
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-muted-foreground">IVA Score</div>
                <div
                  className="text-2xl font-bold tabular-nums mt-0.5"
                  style={{ color: IVA_RISK_COLORS[preview.riskClass] }}
                >
                  {(preview.score * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risk Class</div>
                <div
                  className="mt-1 inline-block rounded px-2 py-0.5 text-sm font-bold"
                  style={{
                    background: `${IVA_RISK_COLORS[preview.riskClass]}22`,
                    color: IVA_RISK_COLORS[preview.riskClass],
                  }}
                >
                  {preview.riskClass}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Evac Priority</div>
                <div className="text-2xl font-bold mt-0.5">
                  {PRIORITY_ICON[preview.evacuationPriority] ?? "🟢"}{" "}
                  <span className="text-base">P{preview.evacuationPriority}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">
        {label} {required && <span className="text-risk-red">*</span>}
      </span>
      <input
        className="input w-full"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/60 p-3 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-black text-foreground">{value}</div>
    </div>
  );
}

function FilterChip({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  count, 
  colorClass = "text-muted-foreground",
  isAlert = false
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  count: number;
  colorClass?: string;
  isAlert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border p-2 pr-3 text-left transition-all duration-300 ${
        active 
          ? isAlert 
            ? "border-risk-red/50 bg-risk-red/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
            : "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
          : "border-border/60 bg-card/60 hover:bg-secondary/80 hover:border-border"
      } backdrop-blur-md`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        active 
          ? isAlert ? "bg-risk-red/20 text-risk-red" : "bg-primary/20 text-primary" 
          : "bg-secondary text-muted-foreground group-hover:text-foreground"
      } transition-colors`}>
        <Icon className={`h-4 w-4 ${active ? (isAlert ? "text-risk-red" : "text-primary") : colorClass}`} />
      </div>
      <div className="flex flex-col">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
          {label}
        </span>
        <span className={`font-mono text-xs font-semibold ${active ? (isAlert ? "text-risk-red" : "text-primary") : "text-muted-foreground"}`}>
          {count} <span className="text-[9px] font-normal opacity-70">records</span>
        </span>
      </div>
    </button>
  );
}
