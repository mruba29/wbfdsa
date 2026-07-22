import React, { useState } from "react";
import { 
  ShieldAlert, 
  Flame, 
  AlertTriangle, 
  Clipboard, 
  Settings, 
  MapPin, 
  ThumbsUp, 
  ChevronRight,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle,
  Copy
} from "lucide-react";
import { toast } from "sonner";

interface AIAnalysisPanelProps {
  aiAnalysis: any;
  aiLoading: boolean;
  aiError: string | null;
  onSetApiKey: (key: string) => void;
  apiKey: string;
  onHighlightToggle: (element: string) => void;
  highlightedElement: string | null;
}

export function AIAnalysisPanel({
  aiAnalysis,
  aiLoading,
  aiError,
  onSetApiKey,
  apiKey,
  onHighlightToggle,
  highlightedElement
}: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"insights" | "json">("insights");
  const [showApiKey, setShowApiKey] = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);

  const handleSaveKey = () => {
    onSetApiKey(localKey);
    setShowApiKey(false);
    toast.success("Gemini API key saved successfully.");
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(aiAnalysis, null, 2));
    toast.success("Structured JSON copied to clipboard.");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-border rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
            AI Digital Twin Analyst
          </h3>
        </div>
        <button
          onClick={() => setShowApiKey(!showApiKey)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Configure API Key"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* API Key settings drawer */}
      {showApiKey && (
        <div className="p-4 bg-slate-950 border-b border-border/50 space-y-3">
          <label className="block text-[10px] uppercase font-bold text-slate-400">
            Gemini API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              className="flex-1 h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
            />
            <button
              onClick={handleSaveKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              Save
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Enter your Gemini API key to run live multimodal analyses on floor plan images, PDFs, and DXF drawings. Leaves keys empty to run the high-fidelity simulator.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-950/60 border-b border-border/40">
        <button
          onClick={() => setActiveTab("insights")}
          className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all ${
            activeTab === "insights"
              ? "border-blue-500 text-blue-400 bg-slate-900/30"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          AI Insights
        </button>
        <button
          onClick={() => setActiveTab("json")}
          className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all ${
            activeTab === "json"
              ? "border-blue-500 text-blue-400 bg-slate-900/30"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Structured JSON
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            {/* Pulsing scanning bar */}
            <div className="w-full max-w-[200px] h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
              <div className="absolute top-0 left-0 h-full w-12 bg-blue-500 rounded-full animate-infinite-scan" style={{
                animation: 'pulse 1.5s infinite ease-in-out'
              }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-400">Analyzing Egress & Safety...</p>
              <p className="text-[10px] text-slate-500 max-w-[220px] leading-relaxed">
                Scanning layouts, identifying rooms, corridors, and automatically planning fire safety equipment placements.
              </p>
            </div>
          </div>
        ) : aiError && !aiAnalysis ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-slate-400">Analysis Error</p>
              <p className="text-[10px] mt-1 text-slate-500 max-w-[200px]">{aiError}</p>
            </div>
          </div>
        ) : aiAnalysis ? (
          activeTab === "insights" ? (
            <div className="space-y-4">
              {/* Building overview card */}
              <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                <div>
                  <span className="text-[9px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                    {aiAnalysis.buildingType}
                  </span>
                  <h4 className="text-sm font-bold text-slate-200 mt-2">
                    {aiAnalysis.buildingName || "Extracted Model Twin"}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Structure Profile · {aiAnalysis.numberOfFloors} Floors, height: {aiAnalysis.floorHeight || 3.2}m
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[14px] font-bold text-slate-200">{aiAnalysis.roomsCount || aiAnalysis.rooms?.length || 0}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Rooms</span>
                  </div>
                  <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[14px] font-bold text-slate-200">{aiAnalysis.corridorsCount || 1}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Corridors</span>
                  </div>
                  <div className="p-2 bg-slate-950/70 border border-slate-800 rounded">
                    <span className="text-[14px] font-bold text-slate-200">{aiAnalysis.report?.estimatedOccupancy || 0}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Est. Pop</span>
                  </div>
                </div>
              </div>

              {/* Building Summary */}
              {aiAnalysis.report?.buildingSummary && (
                <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    Building Summary
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {aiAnalysis.report.buildingSummary}
                  </p>
                </div>
              )}

              {/* Physical CAD Features */}
              <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                  Physical CAD Features
                </h5>
                <div className="space-y-3 text-xs">
                  {/* Structural */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Structural Details</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>Walls: <span className="font-bold text-slate-100">{aiAnalysis.walls || "Concrete"}</span></div>
                      <div>Thickness: <span className="font-bold text-slate-100">{aiAnalysis.wallThickness || "N/A"}</span></div>
                      <div>Columns: <span className="font-bold text-slate-100">{aiAnalysis.columnsCount ?? aiAnalysis.columns ?? 0}</span></div>
                      <div>Beams: <span className="font-bold text-slate-100">{aiAnalysis.beamsCount ?? aiAnalysis.beams ?? 0}</span></div>
                      <div className="col-span-2">Roof: <span className="font-bold text-slate-100">{aiAnalysis.roofType ?? aiAnalysis.roof ?? "Flat Slab"}</span></div>
                    </div>
                  </div>
                  {/* Special Rooms */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/40">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Specialized Rooms</span>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {(aiAnalysis.electricalRoomsCount > 0 || aiAnalysis.electricalRoom) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">⚡ Elec ({aiAnalysis.electricalRoomsCount || 1})</span>}
                      {(aiAnalysis.serverRoomsCount > 0 || aiAnalysis.serverRoom) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">🖥️ Server ({aiAnalysis.serverRoomsCount || 1})</span>}
                      {(aiAnalysis.generatorRoomsCount > 0 || aiAnalysis.generatorRoom) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">⚙️ Gen ({aiAnalysis.generatorRoomsCount || 1})</span>}
                      {(aiAnalysis.storageAreasCount > 0 || aiAnalysis.storageAreas) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">📦 Storage ({aiAnalysis.storageAreasCount || 1})</span>}
                      {(aiAnalysis.kitchensCount > 0 || aiAnalysis.kitchen) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">🍳 Kitchen ({aiAnalysis.kitchensCount || 1})</span>}
                      {(aiAnalysis.laboratoriesCount > 0 || aiAnalysis.laboratory) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">🔬 Lab ({aiAnalysis.laboratoriesCount || 1})</span>}
                      {(aiAnalysis.parkingAreasCount > 0 || aiAnalysis.parking) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">🚗 Parking ({aiAnalysis.parkingAreasCount || 1})</span>}
                      {(aiAnalysis.lobbiesCount > 0 || aiAnalysis.lobby) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">🗺️ Lobby ({aiAnalysis.lobbiesCount || 1})</span>}
                      {(aiAnalysis.receptionsCount > 0 || aiAnalysis.reception) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">👤 Reception ({aiAnalysis.receptionsCount || 1})</span>}
                      {(aiAnalysis.assemblyPointsCount > 0 || aiAnalysis.assemblyPoint) && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">📍 Assembly ({aiAnalysis.assemblyPointsCount || 1})</span>}
                    </div>
                  </div>
                  {/* Fire Gear */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/40">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Fire Safety Gear Counts</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                      <div>🧯 Extinguishers: <span className="font-bold text-slate-100">{aiAnalysis.fireExtinguishersCount ?? aiAnalysis.fireExtinguishers ?? 0}</span></div>
                      <div>🔔 Smoke Detectors: <span className="font-bold text-slate-100">{aiAnalysis.smokeDetectorsCount ?? aiAnalysis.smokeDetectors ?? 0}</span></div>
                      <div>💦 Sprinklers: <span className="font-bold text-slate-100">{aiAnalysis.sprinklersCount ?? aiAnalysis.sprinklers ?? 0}</span></div>
                      <div>🚨 Alarm Panels: <span className="font-bold text-slate-100">{aiAnalysis.fireAlarmPanelsCount ?? aiAnalysis.fireAlarmPanels ?? 0}</span></div>
                      <div>🔋 Emergency Lights: <span className="font-bold text-slate-100">{aiAnalysis.emergencyLightingCount ?? aiAnalysis.emergencyLighting ?? 0}</span></div>
                      <div>🚪 Exit Signs: <span className="font-bold text-slate-100">{aiAnalysis.exitSignageCount ?? aiAnalysis.exitSignage ?? 0}</span></div>
                    </div>
                  </div>
                  {/* Measurements */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/40">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Measurements</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div>Area: <span className="font-bold text-slate-100">{aiAnalysis.floorArea ? `${aiAnalysis.floorArea} sqm` : "N/A"}</span></div>
                      <div>Room Dim: <span className="font-bold text-slate-100">{aiAnalysis.roomDimensions || "N/A"}</span></div>
                      <div>Corridor: <span className="font-bold text-slate-100">{aiAnalysis.corridorWidth || "N/A"}</span></div>
                      <div>Door Width: <span className="font-bold text-slate-100">{aiAnalysis.doorWidth || "N/A"}</span></div>
                      <div>Window Size: <span className="font-bold text-slate-100">{aiAnalysis.windowSize || "N/A"}</span></div>
                      <div>Dist. to Exits: <span className="font-bold text-slate-100">{aiAnalysis.distanceToExits || "N/A"}</span></div>
                      <div className="col-span-2">Dist. to Stairs: <span className="font-bold text-slate-100">{aiAnalysis.distanceToStaircases || "N/A"}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Twin Highlights Filter */}
              <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                  Twin Egress Highlights
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  {(["stairs", "exits", "path", "safe"] as const).map((elem) => (
                    <button
                      key={elem}
                      onClick={() => onHighlightToggle(elem)}
                      className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                        highlightedElement === elem
                          ? "bg-blue-600/10 border-blue-500 text-blue-400"
                          : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                      }`}
                    >
                      {elem === "stairs" && "🟢 Stairs"}
                      {elem === "exits" && "🔴 Fire Exits"}
                      {elem === "path" && "🔥 Evac Path"}
                      {elem === "safe" && "🛡️ Safe Zones"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Architectural Observations */}
              {aiAnalysis.report?.architecturalObservations && (
                <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    Architectural Observations
                  </h5>
                  <ul className="space-y-2">
                    {(Array.isArray(aiAnalysis.report.architecturalObservations)
                      ? aiAnalysis.report.architecturalObservations
                      : [aiAnalysis.report.architecturalObservations]
                    ).map((obs: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fire Safety Assessment & Risks */}
              {(aiAnalysis.report?.fireSafetyAssessment || aiAnalysis.report?.structuralRisks) && (
                <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    Fire & Structural Assessment
                  </h5>
                  {aiAnalysis.report.fireSafetyAssessment && (
                    <div className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded border border-slate-800/80 leading-relaxed">
                      {aiAnalysis.report.fireSafetyAssessment}
                    </div>
                  )}
                  {aiAnalysis.report.structuralRisks && (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase font-bold text-slate-500">Structural Risks</span>
                      <ul className="space-y-1.5">
                        {(Array.isArray(aiAnalysis.report.structuralRisks)
                          ? aiAnalysis.report.structuralRisks
                          : [aiAnalysis.report.structuralRisks]
                        ).map((risk: string, idx: number) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Hazards and Violations (STEP 7) */}
              <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  Detected Fire Hazards & Violations
                </h5>
                <ul className="space-y-2">
                  {(Array.isArray(aiAnalysis.report?.fireVulnerableAreas)
                    ? aiAnalysis.report.fireVulnerableAreas
                    : aiAnalysis.report?.fireVulnerableAreas
                      ? [aiAnalysis.report.fireVulnerableAreas]
                      : []
                  ).map((v: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Evacuation Challenges & Response */}
              {aiAnalysis.report?.evacuationChallenges && (
                <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
                    Evacuation & Response Operations
                  </h5>
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Evacuation Challenges</span>
                    <ul className="space-y-1.5">
                      {(Array.isArray(aiAnalysis.report.evacuationChallenges)
                        ? aiAnalysis.report.evacuationChallenges
                        : [aiAnalysis.report.evacuationChallenges]
                      ).map((ch: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>{ch}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {aiAnalysis.report.emergencyResponseSuggestions && (
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500">Response Suggestions</span>
                      <div className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded border border-slate-800/80 leading-relaxed">
                        {aiAnalysis.report.emergencyResponseSuggestions}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Safe Zones and Recommendations (STEP 7) */}
              <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-3">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  Code Compliance Recommendations
                </h5>
                <ul className="space-y-2">
                  {(Array.isArray(aiAnalysis.report?.fireCodeRecommendations)
                    ? aiAnalysis.report.fireCodeRecommendations
                    : aiAnalysis.report?.fireCodeRecommendations
                      ? [aiAnalysis.report.fireCodeRecommendations]
                      : []
                  ).map((r: string, idx: number) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Overall Risk Summary */}
              {aiAnalysis.report?.overallRiskSummary && (
                <div className="p-4 bg-slate-950/40 border border-border/50 rounded-xl space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
                    Overall Risk Summary
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    {aiAnalysis.report.overallRiskSummary}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Structured Schema Output</span>
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy JSON
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl font-mono text-[10.5px] text-blue-400 overflow-x-auto max-h-[450px]">
                {JSON.stringify(aiAnalysis, null, 2)}
              </pre>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-xs text-slate-500 py-16 space-y-3">
            <Clipboard className="h-8 w-8 text-slate-700" />
            <div>
              <p className="font-semibold text-slate-400">Awaiting AI Analysis</p>
              <p className="text-[10px] mt-1 max-w-[200px]">Upload a blueprint image, PDF, or DXF layout to trigger architectural analysis and vulnerability mapping.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
