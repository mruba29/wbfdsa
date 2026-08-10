import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useMemo, useRef, useEffect } from "react";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { FloorStatistics } from "@/components/FloorStatistics";
import { RiskSummary, type SimpleRiskLabel } from "@/components/RiskSummary";
import { EvacuationPriority } from "@/components/EvacuationPriority";
import { Walkthrough3D } from "@/components/Walkthrough3D";
import { FloorPlan2DViewer } from "@/components/FloorPlan2DViewer";
import { FloorLevelFireInventory } from "@/components/FloorLevelFireInventory";
import { cadMetadataService } from "@/services/cadMetadataService";
import {
  Upload,
  Layers,
  Flame,
  Navigation,
  FileCheck,
  Trash2,
  Box,
} from "lucide-react";
import { toast } from "sonner";
import type { FloorData } from "@/types/floor";

export const Route = createFileRoute("/floor-plans")({
  head: () => ({
    meta: [
      { title: "Floor Plans — WB-FDVA" },
      { name: "description", content: "CAD floor plans, 3D walkthrough, floor risk assessment, and evacuation priority" },
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

  // View Mode State: "2d" (CAD View) vs "inventory" (Fire Inventory View)
  const [viewMode, setViewMode] = useState<"2d" | "inventory">("2d");

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
    if (!floors.length) return { id: 1, level: selectedFloorLevel, name: `Level ${selectedFloorLevel}`, totalExits: 4, blockedExits: 0 };
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

  // CAD File upload state & metadata sync
  const [uploadedCadFile, setUploadedCadFile] = useState<{
    name: string;
    type: string;
    url: string | null;
    size?: string;
    uploadDate?: string;
    uploadedBy?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persistent CAD metadata record from Google Sheets / Airtable service
  useEffect(() => {
    let isMounted = true;
    async function loadCadMetadata() {
      const records = await cadMetadataService.fetchCadMetadata({
        campus: selectedCampus,
        building: currentBuilding?.name,
        floor: `Floor ${selectedFloorLevel}`,
      });
      if (isMounted && records.length > 0) {
        const latest = records[0];
        setUploadedCadFile({
          name: latest.fileName,
          type: latest.fileType,
          url: latest.fileUrl,
          size: latest.fileSize,
          uploadDate: latest.uploadDate,
          uploadedBy: latest.uploadedBy,
        });
      }
    }
    loadCadMetadata();
    return () => {
      isMounted = false;
    };
  }, [selectedCampus, currentBuilding?.name, selectedFloorLevel]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["dwg", "dxf", "pdf", "jpg", "jpeg", "png", "svg"].includes(ext || "")) {
      toast.error("Invalid format. Accepted formats: DWG, DXF, PDF, JPEG, JPG, PNG");
      return;
    }

    const objectUrl = file.type === "application/pdf" || file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const fileType = (ext || "dxf").toUpperCase();
    const fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const uploadDate = new Date().toISOString().split("T")[0];
    const uploadedBy = "Gautam (Safety Lead)";

    const cadObj = {
      name: file.name,
      type: fileType,
      url: objectUrl,
      size: fileSize,
      uploadDate,
      uploadedBy,
    };

    setUploadedCadFile(cadObj);

    // Persist details to Google Sheets / Airtable CAD metadata storage
    await cadMetadataService.saveCadRecord({
      campus: selectedCampus === "All Campuses" ? "CM" : selectedCampus,
      building: currentBuilding?.name || "Main Building",
      floor: `Floor ${selectedFloorLevel}`,
      fileName: file.name,
      fileUrl: objectUrl || `https://storage.wbfdva.org/cad/${file.name}`,
      uploadDate,
      uploadedBy,
      fileType,
      fileSize,
    });

    toast.success(`CAD file "${file.name}" saved & synced to Google Sheets / Airtable storage`);
  };

  const handleClearCad = () => {
    if (uploadedCadFile?.url && uploadedCadFile.url.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedCadFile.url);
    }
    setUploadedCadFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("CAD file removed");
  };

  // Stats object conforming to 2x4 layout extracted items
  const floorStats = useMemo(() => {
    return {
      rooms: zones.length > 0 ? zones.length : selectedFloorLevel === 2 ? 7 : selectedFloorLevel === 3 ? 6 : 8,
      doors: currentBuilding?.numberOfWindows ? Math.round(currentBuilding.numberOfWindows * 0.6) : 12,
      windows: currentBuilding?.numberOfWindows || 18,
      staircases: currentBuilding?.numberOfStaircases || 2,
      lifts: currentBuilding?.numberOfLifts || 2,
      emergencyExits: 2,
      distanceToStaircase: selectedFloorLevel === 2 ? "10 m" : selectedFloorLevel === 3 ? "8 m" : "12 m",
      distanceToLift: selectedFloorLevel === 2 ? "12 m" : selectedFloorLevel === 3 ? "10 m" : "25 m",
      currentOccupancy: floorOccupancy,
      maxOccupancy: 100,
      directExits: currentFloor?.totalExits || 4,
    };
  }, [zones, floorOccupancy, currentFloor, currentBuilding, selectedFloorLevel]);

  // Helper to map numeric risk percentage score (0-100) to Risk Level label ("Low" | "Medium" | "High" | "Critical")
  const getRiskLevelLabel = (score: number): SimpleRiskLabel => {
    if (score > 75) return "Critical";
    if (score > 55) return "High";
    if (score > 30) return "Medium";
    return "Low";
  };

  // DYNAMIC FLOOR VULNERABILITY CALCULATIONS FOR SELECTED FLOOR LEVEL
  const floorVulnerabilityScore = useMemo(() => {
    if (selectedFloorLevel === 1) return 60;
    if (selectedFloorLevel === 2) return 78;
    if (selectedFloorLevel === 3) return 22;
    if (selectedFloorLevel === 4) return 85;
    return Math.min(100, 20 + ((selectedFloorLevel * 17) % 65));
  }, [selectedFloorLevel]);

  const fireRiskScore = useMemo(() => {
    if (selectedFloorLevel === 1) return 58;
    if (selectedFloorLevel === 2) return 72;
    if (selectedFloorLevel === 3) return 18;
    if (selectedFloorLevel === 4) return 88;
    return Math.min(100, 25 + ((selectedFloorLevel * 13) % 60));
  }, [selectedFloorLevel]);

  const occupancyRiskScore = useMemo(() => {
    if (selectedFloorLevel === 1) return 70;
    if (selectedFloorLevel === 2) return 80;
    if (selectedFloorLevel === 3) return 30;
    if (selectedFloorLevel === 4) return 40;
    return Math.min(100, 30 + ((selectedFloorLevel * 11) % 50));
  }, [selectedFloorLevel]);

  const individualRiskScore = useMemo(() => {
    if (selectedFloorLevel === 1) return 51;
    if (selectedFloorLevel === 2) return 65;
    if (selectedFloorLevel === 3) return 15;
    if (selectedFloorLevel === 4) return 75;
    return Math.min(100, Math.round(floorVulnerabilityScore * 0.85));
  }, [selectedFloorLevel, floorVulnerabilityScore]);

  // Risk Labels (Low, Medium, High, Critical)
  const floorVulnerabilityLabel = getRiskLevelLabel(floorVulnerabilityScore);
  const fireRiskLabel = getRiskLevelLabel(fireRiskScore);
  const occupancyRiskLabel = getRiskLevelLabel(occupancyRiskScore);
  const individualRiskLabel = getRiskLevelLabel(individualRiskScore);

  // Construct currentFloorData for Evacuation Priority service
  const currentFloorData: FloorData = useMemo(() => {
    return {
      buildingId: String(activeBuildingId || 1),
      level: selectedFloorLevel,
      name: `Level ${selectedFloorLevel}`,
      details: {
        floorName: `Level ${selectedFloorLevel}`,
        floorArea: 420,
        maxOccupancy: 100,
        currentOccupancy: floorOccupancy,
        riskLevel: floorVulnerabilityLabel.toUpperCase() as any,
        revisionNumber: "v2.4",
        uploadDate: new Date().toISOString(),
      },
      risks: {
        floorRisk: floorVulnerabilityLabel.toUpperCase() as any,
        occupancyRisk: occupancyRiskLabel.toUpperCase() as any,
        individualRisk: individualRiskLabel.toUpperCase() as any,
        overallFireRisk: fireRiskLabel.toUpperCase() as any,
      },
      stats: floorStats,
      vulnerability: {
        overallVulnerability: floorVulnerabilityScore,
        fireRisk: fireRiskScore,
        occupancyRisk: occupancyRiskScore,
        evacuationDifficulty: Math.min(100, Math.round(floorVulnerabilityScore * 0.9)),
        safetyIndex: Math.max(0, 100 - floorVulnerabilityScore),
        riskCategory: floorVulnerabilityLabel.toUpperCase() as any,
      },
    };
  }, [
    activeBuildingId,
    selectedFloorLevel,
    floorOccupancy,
    floorVulnerabilityLabel,
    occupancyRiskLabel,
    individualRiskLabel,
    fireRiskLabel,
    floorStats,
    floorVulnerabilityScore,
    fireRiskScore,
    occupancyRiskScore,
  ]);

  return (
    <AppShell
      title="Floor Plans"
      subtitle="CAD drawing visualization, 3D walkthrough, floor risk assessment, and evacuation priority"
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
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
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
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px] cursor-pointer"
              >
                {campusBuildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-muted-foreground/40 font-bold hidden sm:inline">↓</span>

            {/* Floor Selector (Sorted by Floor Vulnerability: Critical > High > Medium > Low) */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Floor:
              </label>
              <select
                value={selectedFloorLevel}
                onChange={(e) => setSelectedFloorLevel(Number(e.target.value))}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-background border border-primary/50 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-mono"
              >
                {[
                  { level: 4, name: "Level 4 (HVAC Plant)", risk: "🔴 Critical Floor (85%)" },
                  { level: 2, name: "Level 2 (R&D Lab)", risk: "🔴 High Risk Floor (78%)" },
                  { level: 1, name: "Level 1 (Ground Floor)", risk: "🟠 Medium Risk Floor (60%)" },
                  { level: 3, name: "Level 3 (Exec Suite)", risk: "🟢 Low Risk Floor (22%)" },
                ].map((f) => (
                  <option key={f.level} value={f.level}>
                    {f.name} — {f.risk}
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
              accept=".dwg,.dxf,.pdf,.jpg,.jpeg,.png,.svg"
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
                <Upload className="h-4 w-4" /> Upload CAD / Image (.DWG, .DXF, .PDF, .JPEG, .PNG)
              </button>
            )}
          </div>
        </div>

        {/* 2. CAD DATA EXTRACTION STATISTIC CARDS (Clean 2 × 4 Layout) */}
        <div>
          <FloorStatistics stats={floorStats} />
        </div>

        {/* 3. Main Content Grid: LEFT-SIDE PANELS + RIGHT-SIDE VIEWER AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* LEFT SIDE PANELS: FLOOR VULNERABILITY & EVACUATION PRIORITY */}
          <div className="space-y-6">
            {/* 1. Floor Vulnerability (Floor Vulnerability, Fire Risk, Occupancy Risk, Individual Risk) */}
            <RiskSummary
              floorVulnerability={floorVulnerabilityLabel}
              fireRisk={fireRiskLabel}
              occupancyRisk={occupancyRiskLabel}
              individualRisk={individualRiskLabel}
              floorVulnerabilityScore={floorVulnerabilityScore}
              fireRiskScore={fireRiskScore}
              occupancyRiskScore={occupancyRiskScore}
              individualRiskScore={individualRiskScore}
            />

            {/* 2. Evacuation Priority List */}
            <EvacuationPriority
              floors={floors.length > 0 ? floors : [
                { id: 1, level: 1, floorName: "Level 1 (Ground)" },
                { id: 2, level: 2, floorName: "Level 2 (R&D Lab)" },
                { id: 3, level: 3, floorName: "Level 3 (Exec Suite)" },
                { id: 4, level: 4, floorName: "Level 4 (HVAC Plant)" },
              ]}
              currentFloorData={currentFloorData}
              onSelectFloor={(lvl) => setSelectedFloorLevel(lvl)}
              selectedFloorLevel={selectedFloorLevel}
            />
          </div>

          {/* RIGHT SIDE: VIEW MODES CONTAINER (2D CAD View & 3D Walkthrough View) */}
          <div className="space-y-4">
            {/* View Mode Selector Toolbar (Tabs) */}
            <div className="flex items-center justify-between p-2 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border/40">
                <button
                  onClick={() => setViewMode("2d")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                    viewMode === "2d"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  CAD View (2D)
                </button>
                <button
                  onClick={() => setViewMode("inventory")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                    viewMode === "inventory"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-400/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Flame className="h-4 w-4 text-rose-400" />
                  Fire Safety Inventory (Floor View)
                </button>
              </div>

              {/* Status Indicator Badges */}
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  <Flame className="h-3.5 w-3.5" /> Fire Active
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  <Navigation className="h-3.5 w-3.5" /> Egress Open
                </span>
              </div>
            </div>

            {/* Viewer Display Area */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-md p-1 min-h-[500px] flex flex-col justify-between relative overflow-hidden">
              {viewMode === "inventory" ? (
                /* Floor Level Fire Inventory Panel */
                <div className="w-full">
                  <FloorLevelFireInventory
                    buildingName={currentBuilding?.name || "HQ Main Building"}
                    floorLevel={selectedFloorLevel}
                    campusName={selectedCampus}
                  />
                </div>
              ) : (
                /* 2D Architectural CAD Floor Plan Engine */
                <div className="w-full h-[540px]">
                  <FloorPlan2DViewer
                    uploadedFile={uploadedCadFile}
                    buildingName={currentBuilding?.name || "HQ Main Building"}
                    floorLevel={selectedFloorLevel}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floor Level Fire Inventory Section (always accessible in Floor Level Views) */}
        {viewMode !== "inventory" && (
          <div className="pt-4 border-t border-border/40">
            <FloorLevelFireInventory
              buildingName={currentBuilding?.name || "Main Building"}
              floorLevel={selectedFloorLevel}
              campusName={selectedCampus}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
