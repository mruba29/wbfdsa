import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useMemo, useRef } from "react";
import { db, type Building as DbBuilding } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { FloorStatistics } from "@/components/FloorStatistics";
import { RiskSummary, type SimpleRiskLabel } from "@/components/RiskSummary";
import {
  Upload,
  Layers,
  Flame,
  Navigation,
  FileCheck,
  Building2,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/floor-plans")({
  head: () => ({
    meta: [
      { title: "Floor Plans — WB-FDVA" },
      { name: "description", content: "CAD floor plans, fire locations, and egress route visualization." },
    ],
  }),
  component: FloorPlansPage,
});

const CAMPUSES = ["All Campuses", "CM", "Velam Mall", "Sangam Mall"];

export function FloorPlansPage() {
  const buildings = useLiveQuery(() => db.buildings.toArray(), []) ?? [];

  // Filter Bar State
  const [selectedCampus, setSelectedCampus] = useState<string>("All Campuses");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedFloorLevel, setSelectedFloorLevel] = useState<number>(1);

  // Filtered Building list by selected Campus
  const campusBuildings = useMemo(() => {
    if (selectedCampus === "All Campuses") return buildings;
    return buildings.filter((b) => b.ownerName === selectedCampus);
  }, [buildings, selectedCampus]);

  // Current Building
  const activeBuildingId =
    selectedBuildingId ?? (campusBuildings.length > 0 ? campusBuildings[0].id! : null);
  const currentBuilding = useMemo(() => {
    return buildings.find((b) => b.id === activeBuildingId) ?? null;
  }, [buildings, activeBuildingId]);

  // Floors for current Building
  const floors = useLiveQuery(
    () =>
      activeBuildingId
        ? db.floors.where("buildingId").equals(activeBuildingId).sortBy("level")
        : Promise.resolve<any[]>([]),
    [activeBuildingId]
  ) ?? [];

  // Active Floor object
  const currentFloor = useMemo(() => {
    if (!floors.length) return null;
    return floors.find((f) => f.level === selectedFloorLevel) ?? floors[0];
  }, [floors, selectedFloorLevel]);

  // Query zones on active floor for occupancy stats
  const zones = useLiveQuery(
    () =>
      currentFloor?.id
        ? db.zones.where("floorId").equals(currentFloor.id).toArray()
        : Promise.resolve<any[]>([]),
    [currentFloor?.id]
  ) ?? [];

  const floorOccupancy = useMemo(() => {
    if (!zones.length) return currentBuilding?.peoplePerFloor || 35;
    return zones.reduce((sum, z) => sum + z.occupancy, 0);
  }, [zones, currentBuilding]);

  // CAD File upload state
  const [uploadedCadFile, setUploadedCadFile] = useState<{
    name: string;
    type: string;
    url: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["dwg", "dxf", "pdf"].includes(ext || "")) {
      toast.error("Invalid format. Accepted formats: DWG, DXF, PDF");
      return;
    }

    const objectUrl = file.type === "application/pdf" ? URL.createObjectURL(file) : null;
    setUploadedCadFile({
      name: file.name,
      type: (ext || "dxf").toUpperCase(),
      url: objectUrl,
    });
    toast.success(`CAD file "${file.name}" uploaded successfully`);
  };

  const handleClearCad = () => {
    if (uploadedCadFile?.url) {
      URL.revokeObjectURL(uploadedCadFile.url);
    }
    setUploadedCadFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("CAD file removed");
  };

  // Stats object conforming to FloorStatistics
  const floorStats = useMemo(() => {
    return {
      currentOccupancy: floorOccupancy,
      maxOccupancy: 100,
      directExits: currentFloor?.totalExits || 4,
      emergencyExits: 2,
      doors: currentBuilding?.numberOfWindows ? Math.round(currentBuilding.numberOfWindows * 0.6) : 12,
      windows: currentBuilding?.numberOfWindows || 18,
      staircases: currentBuilding?.numberOfStaircases || 2,
      lifts: currentBuilding?.numberOfLifts || 2,
      distanceToStaircase: "12 m",
      distanceToLift: "25 m",
    };
  }, [floorOccupancy, currentFloor, currentBuilding]);

  // Dynamic Risk Label logic
  const floorVulnerabilityLabel: SimpleRiskLabel = useMemo(() => {
    if (!currentFloor) return "Low";
    if (currentFloor.blockedExits > 0 || floorOccupancy > 60) return "High";
    if (floorOccupancy > 30 || !currentFloor.elevatorWorking) return "Medium";
    return "Low";
  }, [currentFloor, floorOccupancy]);

  const buildingVulnerabilityLabel: SimpleRiskLabel = useMemo(() => {
    if (!currentBuilding) return "Low";
    if (floorVulnerabilityLabel === "High") return "High";
    return "Medium";
  }, [currentBuilding, floorVulnerabilityLabel]);

  return (
    <AppShell
      title="Floor Plans"
      subtitle="CAD drawing visualization, fire location monitoring, and egress route management"
    >
      <div className="space-y-6 animate-fade-in">
        {/* 1. Top Horizontal Filter Bar: Campus ▼ -> Building ▼ -> Floor ▼ */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {/* Campus Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Campus:
              </label>
              <select
                value={selectedCampus}
                onChange={(e) => {
                  setSelectedCampus(e.target.value);
                  setSelectedBuildingId(null);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CAMPUSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-muted-foreground/40 font-bold hidden sm:inline">↓</span>

            {/* Building Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Building:
              </label>
              <select
                value={activeBuildingId ?? ""}
                onChange={(e) => {
                  setSelectedBuildingId(Number(e.target.value));
                  setSelectedFloorLevel(1);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
              >
                {campusBuildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-muted-foreground/40 font-bold hidden sm:inline">↓</span>

            {/* Floor Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Floor:
              </label>
              <select
                value={currentFloor?.level ?? selectedFloorLevel}
                onChange={(e) => setSelectedFloorLevel(Number(e.target.value))}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {floors.length > 0
                  ? floors.map((f) => (
                      <option key={f.id} value={f.level}>
                        Level {f.level} — {f.name}
                      </option>
                    ))
                  : [1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level {lvl}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Hidden File Input & Upload Action Button */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".dwg,.dxf,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploadedCadFile ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs text-emerald-500 font-bold">
                <FileCheck className="h-4 w-4" />
                <span className="truncate max-w-[140px]">{uploadedCadFile.name}</span>
                <button
                  onClick={handleClearCad}
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/20 transition-colors"
                  title="Remove CAD File"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Upload className="h-4 w-4" /> Upload CAD Drawing (.DWG, .DXF, .PDF)
              </button>
            )}
          </div>
        </div>

        {/* 2. Below Filters: Clean 2 × 4 Stat Card Layout (7 cards: Occupancy, Direct Exit, Emergency Exit, Doors, Windows, Staircases, Lifts) */}
        <div>
          <FloorStatistics stats={floorStats} />
        </div>

        {/* 3. Main Content Split: CAD Viewer (Primary Content) + Right-Side Risk Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* CAD Viewer Primary Container */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-md p-6 min-h-[480px] flex flex-col justify-between relative overflow-hidden">
            {uploadedCadFile ? (
              <div className="space-y-4">
                {/* CAD Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-border/40 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{uploadedCadFile.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Format: <span className="font-bold text-primary">{uploadedCadFile.type}</span> · {currentBuilding?.name} (Level {currentFloor?.level ?? 1})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                      <Flame className="h-3.5 w-3.5" /> Fire Location Monitored
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <Navigation className="h-3.5 w-3.5" /> Exit Routes Active
                    </span>
                  </div>
                </div>

                {/* Render File or Blueprint canvas */}
                {uploadedCadFile.type === "PDF" && uploadedCadFile.url ? (
                  <div className="w-full h-[400px] rounded-xl border border-border overflow-hidden">
                    <iframe
                      src={uploadedCadFile.url}
                      className="w-full h-full border-0"
                      title="CAD Floor Plan PDF"
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-[400px] bg-slate-950 rounded-xl border border-border/80 overflow-hidden flex flex-col items-center justify-center p-4">
                    {/* SVG Vector Floor Plan Simulation Overlay */}
                    <svg
                      viewBox="0 0 800 500"
                      className="w-full h-full opacity-90 stroke-slate-600"
                      fill="none"
                      strokeWidth="2"
                    >
                      {/* Outer Wall Boundaries */}
                      <rect x="50" y="40" width="700" height="420" stroke="#3b82f6" strokeWidth="3" rx="8" />
                      
                      {/* Interior Corridors & Rooms */}
                      <line x1="50" y1="200" x2="750" y2="200" stroke="#475569" strokeDasharray="4 4" />
                      <line x1="300" y1="40" x2="300" y2="460" stroke="#475569" />
                      <line x1="550" y1="40" x2="550" y2="460" stroke="#475569" />

                      {/* Room Labels */}
                      <text x="150" y="120" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Server Room A
                      </text>
                      <text x="425" y="120" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Main Executive Office
                      </text>
                      <text x="650" y="120" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Stairwell A
                      </text>
                      <text x="150" y="340" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Conference Zone
                      </text>
                      <text x="425" y="340" fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle">
                        Central Lobby
                      </text>

                      {/* Fire Location Marker */}
                      <g className="animate-bounce">
                        <circle cx="150" cy="150" r="24" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
                        <circle cx="150" cy="150" r="10" fill="#ef4444" />
                        <text x="150" y="188" fill="#ef4444" fontSize="12" fontWeight="extrabold" textAnchor="middle">
                          FIRE LOCATION
                        </text>
                      </g>

                      {/* Exit Route 1 (Green Arrow Path) */}
                      <path
                        d="M 425 340 L 425 460"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray="8 4"
                      />
                      <polygon points="425,460 418,445 432,445" fill="#10b981" />
                      <text x="450" y="445" fill="#10b981" fontSize="11" fontWeight="bold">
                        DIRECT EXIT
                      </text>

                      {/* Exit Route 2 (Emergency Egress to Stairwell) */}
                      <path
                        d="M 425 120 L 650 120 L 650 40"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray="8 4"
                      />
                      <polygon points="650,40 643,55 657,55" fill="#10b981" />
                      <text x="660" y="70" fill="#10b981" fontSize="11" fontWeight="bold">
                        EMERGENCY EXIT
                      </text>
                    </svg>

                    <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-[11px] font-mono text-muted-foreground">
                      CAD Floor Plan Overlay · Fire Location: Active · Exit Routes: Highlighted
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback message requirement when no CAD is uploaded */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="p-4 rounded-2xl bg-secondary/40 border border-border text-muted-foreground">
                  <Upload className="h-10 w-10 text-primary mx-auto" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h4 className="text-base font-bold text-foreground">No CAD File Uploaded</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No CAD file uploaded. Upload a CAD drawing to visualize the floor plan.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Upload CAD Drawing (.DWG, .DXF, .PDF)
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Simple Risk Summary + Future Enhancement Card */}
          <div>
            <RiskSummary
              floorVulnerability={floorVulnerabilityLabel}
              buildingVulnerability={buildingVulnerabilityLabel}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
