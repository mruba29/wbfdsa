import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Map as MapIcon,
  Settings,
  Database,
  Users,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  MapPin,
  MapPinOff,
  ShieldAlert,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { AppShell } from "@/components/app-shell";
import { db, type Zone } from "@/lib/db";
import { FloorSelector } from "@/components/FloorSelector";
import { RiskCards } from "@/components/RiskCards";
import { FloorStatistics } from "@/components/FloorStatistics";
import { VulnerabilityDashboard } from "@/components/VulnerabilityDashboard";
import { EvacuationPriority } from "@/components/EvacuationPriority";
import { FloorInfoPanel } from "@/components/FloorInfoPanel";
import { FloorSimulationPanel } from "@/components/FloorSimulationPanel";
import { UploadCAD } from "@/components/UploadCAD";
import { CADOverlay } from "@/components/CADOverlay";
import { FloorPlan } from "@/components/floor-plan";
import { useFloorData } from "@/hooks/useFloorData";
import { getBackendConfig, saveBackendConfig, type BackendConfig } from "@/services/config";
import { syncFromService, createFloorOnService } from "@/services/dbSync";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { type RiskLevel } from "@/lib/vulnerability";

export const Route = createFileRoute("/floor-plans")({
  head: () => ({
    meta: [
      { title: "Floor Plans — WB-FDVA" },
      { name: "description", content: "Manage floors, CAD drawings, exits, and risks." },
    ],
  }),
  component: FloorPlansPage,
});

function FloorPlansPage() {
  // Local cache reactive queries for dropdown & selector list
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const [bId, setBId] = useState<number | null>(null);

  // Set default building ID
  useEffect(() => {
    if (!bId && buildings?.length) {
      setBId(buildings[0].id!);
    }
  }, [buildings, bId]);

  const floors = useLiveQuery(
    () =>
      bId ? db.floors.where("buildingId").equals(bId).sortBy("level") : Promise.resolve<any[]>([]),
    [bId],
  );

  const [fLevel, setFLevel] = useState<number | null>(null);

  // Set default floor level
  useEffect(() => {
    if (floors?.length) {
      const currentExists = floors.some((f) => f.level === fLevel);
      if (!currentExists) {
        setFLevel(floors[0].level);
      }
    } else {
      setFLevel(null);
    }
  }, [floors]);

  // Find the selected floor object
  const floor = useMemo(() => {
    return floors?.find((f) => f.level === fLevel);
  }, [floors, fLevel]);
  const fId = floor?.id ?? null;

  // Query zones for the selected floor
  const zones = useLiveQuery(
    () => (fId ? db.zones.where("floorId").equals(fId).toArray() : Promise.resolve<any[]>([])),
    [fId],
  );

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cadVisible, setCadVisible] = useState(true);
  const [simulationTime, setSimulationTime] = useState(0);
  const [heatmapMode, setHeatmapMode] = useState<"NONE" | "OCCUPANCY" | "FIRE_RISK" | "EVACUATION">(
    "OCCUPANCY",
  );

  // Get the selected building object for Google Maps
  const selectedBuilding = useMemo(() => {
    return buildings?.find((b) => b.id === bId) ?? null;
  }, [buildings, bId]);

  // Google Map state
  const floorMapRef = useRef<HTMLDivElement>(null);
  const [floorMapReady, setFloorMapReady] = useState(false);
  const [mapError, setMapError] = useState<"no-key" | "invalid-key" | "no-internet" | "no-location" | null>(null);
  const [floorMapInstance, setFloorMapInstance] = useState<any>(null);
  const floorMapMarkerRef = useRef<any>(null);
  const [cadOpacity, setCadOpacity] = useState(100);

  // Calculate occupants on this specific floor level
  const floorOccupants = useMemo(() => {
    if (!zones) return 0;
    return zones.reduce((s, z) => s + z.occupancy, 0);
  }, [zones]);

  // Create mock zone risks based on heatmap mode
  const zoneRisks = useMemo(() => {
    const risks: Record<number, RiskLevel> = {};
    if (zones) {
      zones.forEach((z) => {
        if (heatmapMode === "NONE") {
          risks[z.id!] = "SAFE";
        } else if (heatmapMode === "OCCUPANCY") {
          risks[z.id!] =
            z.occupancy > 30
              ? "RED"
              : z.occupancy > 20
                ? "ORANGE"
                : z.occupancy > 10
                  ? "YELLOW"
                  : "SAFE";
        } else if (heatmapMode === "FIRE_RISK") {
          // Mock fire risk based on zone type
          const isHighRisk = ["Server", "Storage"].includes(z.type);
          const isMedRisk = ["Lobby", "Retail"].includes(z.type);
          risks[z.id!] = isHighRisk ? "RED" : isMedRisk ? "ORANGE" : "SAFE";
        } else if (heatmapMode === "EVACUATION") {
          // Mock evacuation congestion based on special needs and occupancy
          const congestion = z.occupancy + z.specialNeeds * 5;
          risks[z.id!] = congestion > 40 ? "RED" : congestion > 20 ? "ORANGE" : "SAFE";
        }
      });
    }
    return risks;
  }, [zones, heatmapMode]);

  // Constants for heatmap & trend
  const HOURS_2H = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 2), []);
  const DAYS = useMemo(() => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], []);

  // Compute building-occupancy heatmap scaled to floor census
  const heatmapData = useMemo(() => {
    const scale = floorOccupants || 25; // fallback
    return DAYS.map((d, di) =>
      HOURS_2H.map((h) => {
        const weekday = di < 5 ? 1.0 : 0.45;
        const hourFactor = Math.max(0.15, Math.sin(((h - 5) / 12) * Math.PI));
        return Math.round(scale * weekday * hourFactor * 0.15);
      }),
    );
  }, [floorOccupants, DAYS, HOURS_2H]);

  // Compute daily trend for charts
  const dailyTrend = useMemo(() => {
    const scale = floorOccupants || 25;
    return HOURS_2H.map((h) => ({
      hour: `${h}:00`,
      occupants: Math.round(
        scale * (0.2 + 0.8 * Math.max(0.1, Math.sin(((h - 5) / 12) * Math.PI))),
      ),
    }));
  }, [floorOccupants, HOURS_2H]);

  const buildingIdStr = bId ? String(bId) : null;
  const { floorData, loading, uploadCADFile, deleteCADFile } = useFloorData(buildingIdStr, fLevel);

  // Compute dynamic vulnerability based on simulation time
  const dynamicVulnerability = useMemo(() => {
    if (!floorData || !floorData.vulnerability) return undefined;
    const baseVuln = floorData.vulnerability.overallVulnerability ?? 0;
    // Increase vulnerability by 5 points for every 30 seconds
    const increase = (simulationTime / 30) * 5;
    const newScore = Math.min(100, Math.round(baseVuln + increase));
    
    let riskCategory: RiskLevel = "SAFE";
    if (newScore > 75) riskCategory = "CRITICAL";
    else if (newScore > 55) riskCategory = "HIGH";
    else if (newScore > 35) riskCategory = "MEDIUM";
    else if (newScore > 15) riskCategory = "LOW";

    return {
      ...floorData.vulnerability,
      overallVulnerability: newScore,
      riskCategory,
    };
  }, [floorData, simulationTime]);

  const dynamicFloorData = useMemo(() => {
    if (!floorData) return null;
    return {
      ...floorData,
      vulnerability: dynamicVulnerability
    };
  }, [floorData, dynamicVulnerability]);

  // Load Google Maps API
  useEffect(() => {
    const win = window as any;
    const apiKey = localStorage.getItem("wb-maps-api-key") || "";
    if (!apiKey) {
      setFloorMapReady(false);
      setMapError("no-key");
      return;
    }
    
    win.gm_authFailure = () => {
      setMapError("invalid-key");
      setFloorMapReady(false);
    };

    if (win.google && win.google.maps) {
      setFloorMapReady(true);
      setMapError(null);
      return;
    }

    win.initFloorGoogleMap = () => {
      setFloorMapReady(true);
      setMapError(null);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initFloorGoogleMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setMapError("no-internet");
    document.head.appendChild(script);

    return () => {
      win.initFloorGoogleMap = undefined;
      win.gm_authFailure = undefined;
    };
  }, []);

  // Initialize Google Map instance for building location
  useEffect(() => {
    if (!floorMapReady || !floorMapRef.current) return;

    const win = window as any;
    const darkStyles = [
      { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#94a3b8" }],
      },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#475569" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
    ];

    const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru fallback
    const center =
      selectedBuilding?.latitude && selectedBuilding?.longitude
        ? { lat: selectedBuilding.latitude, lng: selectedBuilding.longitude }
        : defaultCenter;

    const map = new win.google.maps.Map(floorMapRef.current, {
      center,
      zoom: 15,
      styles: darkStyles,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      mapTypeControlOptions: {
         mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
      },
    });

    setFloorMapInstance(map);
  }, [floorMapReady]);

  // Update map center and marker when building changes
  useEffect(() => {
    if (!floorMapInstance || !selectedBuilding) return;
    const win = window as any;

    if (!selectedBuilding.latitude || !selectedBuilding.longitude) {
      setMapError("no-location");
      if (floorMapMarkerRef.current) floorMapMarkerRef.current.setMap(null);
      return;
    }
    
    // Clear location error if we have coords
    if (mapError === "no-location") {
      setMapError(null);
    }

    const latLng = { lat: selectedBuilding.latitude, lng: selectedBuilding.longitude };
    floorMapInstance.setCenter(latLng);
    floorMapInstance.setZoom(16);

    // Remove old marker
    if (floorMapMarkerRef.current) {
      floorMapMarkerRef.current.setMap(null);
      floorMapMarkerRef.current = null;
    }

    const marker = new win.google.maps.Marker({
      position: latLng,
      map: floorMapInstance,
      title: selectedBuilding.name,
      icon: {
        path: win.google.maps.SymbolPath.CIRCLE,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 10,
      },
    });

    const infoContent = `
      <div style="color: #0f172a; padding: 4px; font-family: sans-serif; min-width: 180px;">
        <div style="text-transform: uppercase; font-size: 9px; color: #64748b; font-weight: 600; letter-spacing: 0.05em;">${selectedBuilding.type || "Building"}</div>
        <h4 style="margin: 2px 0 4px 0; font-size: 13px; font-weight: 700; color: #1e293b;">${selectedBuilding.name}</h4>
        <p style="margin: 0; color: #475569; font-size: 10px; line-height: 1.3;">${selectedBuilding.address}</p>
        ${floor ? `<p style="margin: 4px 0 0 0; color: #3b82f6; font-size: 10px; font-weight: 600;">Viewing: ${floor.name} (Level ${floor.level})</p>` : ""}
      </div>
    `;

    const infoWindow = new win.google.maps.InfoWindow({ content: infoContent });
    marker.addListener("click", () => {
      infoWindow.open(floorMapInstance, marker);
    });

    // Auto-open info window
    infoWindow.open(floorMapInstance, marker);

    floorMarkerRef.current = marker;
  }, [floorMapInstance, selectedBuilding, floor]);

  // Integration settings state
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<BackendConfig>(getBackendConfig());
  const [syncing, setSyncing] = useState(false);

  const handleSaveConfig = (updates: Partial<BackendConfig>) => {
    const updated = saveBackendConfig(updates);
    setConfig(updated);
    toast.success(
      `Active storage set to: ${updated.serviceType === "googleSheets" ? "Google Sheets" : "Airtable"}`,
    );
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    toast.info("Syncing cached data from selected service...");
    try {
      await syncFromService();
      toast.success("Sync completed successfully!");
      if (buildings?.length) {
        setBId(buildings[0].id!);
      }
    } catch {
      toast.error("Failed to sync from backend service.");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddFloor = async () => {
    if (!bId) return;
    const nextLvl = (floors?.length ?? 0) + 1;
    toast.info(`Adding Floor ${nextLvl}...`);
    try {
      await createFloorOnService({
        buildingId: String(bId),
        level: nextLvl,
        name: `Floor ${nextLvl}`,
        totalExits: 2,
        availableExits: 2,
        blockedExits: 0,
        elevatorWorking: true,
      });
      toast.success(`Floor ${nextLvl} added successfully!`);
    } catch (err) {
      toast.error("Failed to add floor on active service.");
    }
  };

  return (
    <AppShell
      title="Floor Plans"
      subtitle="Visualize and edit rooms, exits, and elevator status"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            <Settings className="h-3.5 w-3.5" /> Configure Storage
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <Database className="h-3.5 w-3.5" /> {syncing ? "Syncing..." : "Sync Cache"}
          </button>
        </div>
      }
    >
      {/* Backend Integration Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="p-4 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-semibold flex items-center gap-2 text-foreground">
                  <Database className="h-4 w-4 text-primary" /> Active Storage Service Settings
                </h3>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <label className="block text-xs">
                  <span className="block text-muted-foreground mb-1">Active Backend Service</span>
                  <select
                    value={config.serviceType}
                    onChange={(e) => handleSaveConfig({ serviceType: e.target.value as any })}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="googleSheets">Google Sheets</option>
                    <option value="airtable">Airtable</option>
                  </select>
                </label>

                {config.serviceType === "googleSheets" ? (
                  <>
                    <label className="block text-xs">
                      <span className="block text-muted-foreground mb-1">Spreadsheet ID</span>
                      <input
                        type="text"
                        placeholder="Spreadsheet key..."
                        value={config.googleSheetsSpreadsheetId}
                        onChange={(e) =>
                          handleSaveConfig({ googleSheetsSpreadsheetId: e.target.value })
                        }
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block text-muted-foreground mb-1">
                        Apps Script Web App URL
                      </span>
                      <input
                        type="password"
                        placeholder="https://script.google.com/..."
                        value={config.googleSheetsApiKey}
                        onChange={(e) => handleSaveConfig({ googleSheetsApiKey: e.target.value })}
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block text-xs">
                      <span className="block text-muted-foreground mb-1">Base ID</span>
                      <input
                        type="text"
                        placeholder="app..."
                        value={config.airtableBaseId}
                        onChange={(e) => handleSaveConfig({ airtableBaseId: e.target.value })}
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block text-muted-foreground mb-1">
                        Personal Access Token (PAT)
                      </span>
                      <input
                        type="password"
                        placeholder="pat..."
                        value={config.airtableApiKey}
                        onChange={(e) => handleSaveConfig({ airtableApiKey: e.target.value })}
                        className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={config.useMockFallback}
                    onChange={(e) => handleSaveConfig({ useMockFallback: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  Use local storage mock sandbox if keys are unconfigured
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Configured:{" "}
                  {config.useMockFallback ? "Local Sandbox Sandbox" : "Remote Live Sync"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left Side Selector (Desktop Layout) */}
        <div className="space-y-4">
          <FloorSelector
            buildings={buildings ?? []}
            selectedBuildingId={bId ? String(bId) : null}
            onSelectBuilding={(id) => setBId(Number(id))}
            floors={floors ?? []}
            selectedFloorLevel={fLevel}
            onSelectFloor={(level) => setFLevel(level)}
            onAddFloor={handleAddFloor}
          />

          {floor && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
                Exit Management
              </h4>
              <ExitField
                label="Total Exits"
                value={floor.totalExits}
                onChange={(v) =>
                  db.floors.update(floor.id!, {
                    totalExits: v,
                    availableExits: Math.max(0, v - floor.blockedExits),
                  })
                }
              />
              <ExitField
                label="Blocked Exits"
                value={floor.blockedExits}
                onChange={(v) =>
                  db.floors.update(floor.id!, {
                    blockedExits: v,
                    availableExits: Math.max(0, floor.totalExits - v),
                  })
                }
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground text-xs font-medium">Elevator</span>
                <button
                  onClick={() =>
                    db.floors.update(floor.id!, { elevatorWorking: !floor.elevatorWorking })
                  }
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase transition-colors ${floor.elevatorWorking ? "bg-risk-green/15 text-risk-green hover:bg-risk-green/25" : "bg-risk-red/15 text-risk-red hover:bg-risk-red/25"}`}
                >
                  {floor.elevatorWorking ? "Operational" : "Offline"}
                </button>
              </div>
            </div>
          )}

          {/* Upload Widget under selector */}
          {floor && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5 flex items-center justify-between">
                <span>Layout Management</span>
                {floorData?.drawing && (
                  <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                    AI Ready
                  </span>
                )}
              </h4>
              <UploadCAD
                onUpload={(file) => uploadCADFile(file, floor.name)}
                onDelete={deleteCADFile}
                currentCAD={floorData?.drawing}
              />
            </div>
          )}

          {/* Evacuation Priority */}
          <EvacuationPriority
            floors={floors ?? []}
            currentFloorData={dynamicFloorData}
            onSelectFloor={(level) => setFLevel(level)}
            selectedFloorLevel={fLevel}
          />
        </div>

        {/* Right Side Content Pane */}
        <div className="space-y-4 min-w-0">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Loading floor blueprint data from active storage...
              </p>
            </div>
          ) : floor ? (
            <div className="space-y-4">
              {/* Risk Cards & Statistics (require floorData from backend) */}
              {floorData && (
                <>
                  <RiskCards
                    floorRisk={dynamicVulnerability?.riskCategory ?? floorData.risks.floorRisk}
                    occupancyRisk={floorData.risks.occupancyRisk}
                    individualRisk={floorData.risks.individualRisk}
                    overallFireRisk={floorData.risks.overallFireRisk}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
                    <div className="space-y-4">
                      <FloorStatistics stats={floorData.stats} />
                      <VulnerabilityDashboard vulnerability={dynamicVulnerability} />
                    </div>
                    <FloorSimulationPanel 
                      simulationTime={simulationTime}
                      onTimeChange={setSimulationTime}
                      stats={floorData.stats}
                      vulnerability={dynamicVulnerability}
                      floorRisk={dynamicVulnerability?.riskCategory}
                    />
                  </div>
                </>
              )}

              {/* SVG Floor Plan with CAD Overlay */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-2.5 gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <MapIcon className="h-4 w-4 text-primary" />
                    {floor.name} — Level {floor.level}
                  </div>

                  {/* Canvas Controls */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Heatmap Mode */}
                    <div className="flex items-center gap-1 border-r border-border pr-4">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground mr-1">
                        Heat Map:
                      </span>
                      {(["NONE", "OCCUPANCY", "FIRE_RISK", "EVACUATION"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setHeatmapMode(mode)}
                          className={`text-[9px] font-semibold px-2 py-1 rounded transition-colors ${
                            heatmapMode === mode
                              ? "bg-blue-500/20 text-blue-500"
                              : "bg-muted text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {mode === "NONE" ? "OFF" : mode.replace("_", " ")}
                        </button>
                      ))}
                    </div>

                    {/* CAD Settings */}
                    {floorData?.drawing && (
                      <div className="flex items-center gap-3 border-r border-border pr-4">
                        <button
                          onClick={() => setCadVisible(!cadVisible)}
                          className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase px-2 py-1 rounded transition-colors ${cadVisible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          <Layers className="h-3.5 w-3.5" /> {cadVisible ? "CAD ON" : "CAD OFF"}
                        </button>
                        {cadVisible && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Opacity
                            </span>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={cadOpacity}
                              onChange={(e) => setCadOpacity(Number(e.target.value))}
                              className="w-20 accent-primary"
                            />
                            <span className="text-[10px] text-muted-foreground font-mono w-8">
                              {cadOpacity}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Zoom */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                        className="grid h-7 w-7 place-items-center rounded border border-border hover:bg-secondary"
                      >
                        <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <span className="font-mono text-xs w-12 text-center text-muted-foreground">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                        className="grid h-7 w-7 place-items-center rounded border border-border hover:bg-secondary"
                      >
                        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setZoom(1)}
                        className="grid h-7 w-7 place-items-center rounded border border-border hover:bg-secondary"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scaled Container */}
                <div className="overflow-auto rounded-xl border border-border bg-secondary/20 relative min-h-[400px]">
                  <div
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                      width: `${100 / zoom}%`,
                    }}
                    className="relative"
                  >
                    {floorData && (
                      <CADOverlay
                        drawing={floorData.drawing}
                        visible={cadVisible}
                        opacity={cadOpacity}
                      />
                    )}
                    <FloorPlan
                      floor={floor}
                      zones={zones ?? []}
                      zoneRisks={zoneRisks}
                      onZoneClick={setSelectedZone}
                      selectedZoneId={selectedZone?.id ?? null}
                      transparentBackground={!!floorData?.drawing && cadVisible}
                      cadElements={floorData?.stats?.cadElements}
                      roomBoundaries={floorData?.stats?.roomBoundaries}
                      simulationTime={simulationTime}
                    />
                  </div>
                </div>
              </div>

              {selectedZone && floor && (
                <ZoneEditor zone={selectedZone} onClose={() => setSelectedZone(null)} />
              )}

              {/* Google Maps — Building Location */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" /> Building Location
                  </h3>
                  {selectedBuilding && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {selectedBuilding.city}
                      {selectedBuilding.latitude
                        ? ` · ${selectedBuilding.latitude.toFixed(4)}°N, ${selectedBuilding.longitude?.toFixed(4)}°E`
                        : ""}
                    </span>
                  )}
                </div>
                <div className="relative h-[300px] w-full bg-secondary/20">
                  <div ref={floorMapRef} className="h-full w-full transition-opacity duration-300 ease-in-out" style={{ opacity: floorMapReady && !mapError ? 1 : 0 }} />
                   {mapError === "no-key" && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                       <div className="bg-black/85 text-yellow-500 border border-yellow-500/20 px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                         <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0" />
                         <span>Google Maps API Key not configured.</span>
                       </div>
                     </div>
                   )}
                   {mapError === "invalid-key" && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                       <div className="bg-risk-red/10 text-risk-red border border-risk-red/20 px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                         <ShieldAlert className="h-5 w-5 shrink-0" />
                         <span>Invalid Google Maps API Key.</span>
                       </div>
                     </div>
                   )}
                   {mapError === "no-internet" && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                       <div className="bg-secondary text-risk-red border border-border px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                         <ShieldAlert className="h-5 w-5 shrink-0" />
                         <span>Unable to load Google Maps.</span>
                       </div>
                     </div>
                   )}
                   {mapError === "no-location" && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                       <div className="bg-secondary text-muted-foreground border border-border px-4 py-3 rounded-lg text-sm font-medium shadow-xl flex items-center gap-2">
                         <MapPinOff className="h-5 w-5 shrink-0" />
                         <span>Building location unavailable.</span>
                       </div>
                     </div>
                   )}
                </div>
              </div>

              {/* Floor Occupancy Heatmap & Daily Trends — always shown when floor is selected */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 mt-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-500" /> Floor Occupancy Heatmap & Trends
                  </h3>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {floor.name} · Active Census: {floorOccupants} occupants
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                  {/* Weekly Heatmap */}
                  <div className="space-y-2 overflow-hidden">
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Weekly Load Cycle
                    </h4>
                    <div className="overflow-x-auto">
                      <div
                        className="inline-grid gap-1 py-1"
                        style={{ gridTemplateColumns: `60px repeat(12, minmax(28px, 1fr))` }}
                      >
                        <div />
                        {HOURS_2H.map((h) => (
                          <div
                            key={h}
                            className="text-[9px] text-center text-muted-foreground font-mono"
                          >
                            {h}:00
                          </div>
                        ))}
                        {DAYS.map((d, di) => (
                          <DayRow
                            key={d}
                            label={d}
                            values={heatmapData[di]}
                            maxVal={floorOccupants * 0.15 || 1}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium mt-2">
                      <span>Low Load</span>
                      {[15, 35, 55, 75, 95].map((v) => (
                        <span
                          key={v}
                          className="h-3 w-8 rounded-sm"
                          style={{ background: `rgba(229, 90, 50, ${v / 100})` }}
                        />
                      ))}
                      <span>Peak Load</span>
                    </div>
                  </div>

                  {/* Daily Trend Line Chart */}
                  <div className="flex flex-col justify-between min-h-[140px]">
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                      Daily Census Cycle
                    </h4>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={dailyTrend}
                          margin={{ top: 5, right: 5, left: -30, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="hour"
                            tick={{ fill: "var(--muted-foreground)", fontSize: 8 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "var(--muted-foreground)", fontSize: 8 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              fontSize: 9,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="occupants"
                            stroke="rgba(229, 90, 50, 1)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
              <MapIcon className="mx-auto h-10 w-10 mb-3 text-muted-foreground/60" />
              <h4 className="font-semibold text-foreground mb-1">Select a Building & Floor</h4>
              <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
                Choose a registered building and floor level from the left selector pane to display
                details, risks, and drawing vector layouts.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ExitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-16 h-8 rounded border border-input bg-background px-2 text-right text-xs"
      />
    </div>
  );
}

function ZoneEditor({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const [form, setForm] = useState(zone);
  useEffect(() => setForm(zone), [zone]);
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Edit Zone {zone.zoneId}
        </h3>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Name</span>
          <input
            className="w-full h-9 rounded border border-input bg-background px-3"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Area (m²)</span>
          <input
            type="number"
            className="w-full h-9 rounded border border-input bg-background px-3"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: +e.target.value })}
          />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Occupancy</span>
          <input
            type="number"
            className="w-full h-9 rounded border border-input bg-background px-3"
            value={form.occupancy}
            onChange={(e) => setForm({ ...form, occupancy: +e.target.value })}
          />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Special Needs</span>
          <input
            type="number"
            className="w-full h-9 rounded border border-input bg-background px-3"
            value={form.specialNeeds}
            onChange={(e) => setForm({ ...form, specialNeeds: +e.target.value })}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={async () => {
            await db.zones.update(zone.id!, form);
            onClose();
          }}
          className="rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Save Zone Configuration
        </button>
      </div>
    </div>
  );
}

function DayRow({ label, values, maxVal }: { label: string; values: number[]; maxVal: number }) {
  return (
    <>
      <div className="flex items-center text-[10px] text-muted-foreground font-bold pr-2">
        {label}
      </div>
      {values.map((v, i) => {
        const opacity = maxVal > 0 ? Math.min(1.0, Math.max(0.1, v / maxVal)) : 0.1;
        return (
          <div
            key={i}
            className="aspect-square w-full rounded-sm border border-black/5"
            style={{
              background: `rgba(229, 90, 50, ${opacity})`,
            }}
            title={`${v} occupants`}
          />
        );
      })}
    </>
  );
}
