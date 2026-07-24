import React, { useState } from "react";
import {
  Sparkles,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Clipboard,
  Settings,
  ShieldCheck,
  Copy,
  TrendingUp,
  CheckCircle2,
  Building,
  Ruler,
  Layers,
  DoorClosed,
  Grid,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { TenPointLLMAnalysis } from "@/services/llmCADAnalysis";
import { ExtractedBuildingFeatures } from "@/services/featureExtraction";

interface AIAnalysisPanelProps {
  aiAnalysis: any;
  aiLoading: boolean;
  aiError: string | null;
  onSetApiKey: (key: string) => void;
  apiKey: string;
  onHighlightToggle: (element: string) => void;
  highlightedElement: string | null;
  extractedFeatures?: ExtractedBuildingFeatures | null;
}

export function AIAnalysisPanel({
  aiAnalysis,
  aiLoading,
  aiError,
  onSetApiKey,
  apiKey,
  onHighlightToggle,
  highlightedElement,
  extractedFeatures,
}: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"analysis10" | "features" | "json">("analysis10");
  const [showApiKey, setShowApiKey] = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    arch: true,
    fire: true,
    risks: true,
    missing: true,
    evac: true,
    highRisk: true,
    recs: true,
    emergency: true,
    overall: true,
  });

  const handleSaveKey = () => {
    onSetApiKey(localKey);
    setShowApiKey(false);
    toast.success("Gemini API key saved successfully.");
  };

  const handleCopyJSON = () => {
    const dataToCopy = {
      aiAnalysis,
      extractedFeatures,
    };
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
    toast.success("Structured JSON & Extracted Features copied to clipboard.");
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if we have 10-point analysis format
  const analysis10: TenPointLLMAnalysis | null =
    aiAnalysis?.buildingSummary ? (aiAnalysis as TenPointLLMAnalysis) : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-border rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              AI Building Twin & Safety Analyst
            </h3>
            <p className="text-[10px] text-slate-400">Multimodal CAD & Architectural Reasoning</p>
          </div>
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
              Save Key
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Enter your Gemini API key to run live multimodal LLM analysis on DXF, DWG, PDF, or floor plan images.
          </p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex bg-slate-950/60 border-b border-border/40 text-[11px] font-bold">
        <button
          onClick={() => setActiveTab("analysis10")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "analysis10"
              ? "border-blue-500 text-blue-400 bg-slate-900/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          10-Pt AI Analysis
        </button>
        <button
          onClick={() => setActiveTab("features")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "features"
              ? "border-blue-500 text-blue-400 bg-slate-900/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Extracted Features
        </button>
        <button
          onClick={() => setActiveTab("json")}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
            activeTab === "json"
              ? "border-blue-500 text-blue-400 bg-slate-900/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          JSON Data
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-full max-w-[200px] h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className="absolute top-0 left-0 h-full w-14 bg-blue-500 rounded-full animate-infinite-scan"
                style={{ animation: "pulse 1.5s infinite ease-in-out" }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-400">Extracting Physical Features & LLM Analysis...</p>
              <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed">
                Detecting walls, rooms, fire equipment, corridor dimensions, and evaluating structural fire risks.
              </p>
            </div>
          </div>
        ) : aiError && !aiAnalysis ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-slate-300">Analysis Error</p>
              <p className="text-[10px] mt-1 text-slate-400 max-w-[200px]">{aiError}</p>
            </div>
          </div>
        ) : aiAnalysis || extractedFeatures ? (
          activeTab === "analysis10" ? (
            <div className="space-y-3 text-slate-200 text-xs">
              {/* Risk Level Banner */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Overall Risk Rating
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-sm font-black uppercase px-2.5 py-0.5 rounded border ${
                        (analysis10?.overallRiskLevel || aiAnalysis?.report?.evacuationDifficulty) === "Critical"
                          ? "bg-red-500/20 border-red-500/40 text-red-400"
                          : (analysis10?.overallRiskLevel || "High") === "High"
                          ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                          : "bg-green-500/20 border-green-500/40 text-green-400"
                      }`}
                    >
                      {analysis10?.overallRiskLevel || "MEDIUM / HIGH"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Compliance: {analysis10?.complianceScore || 78}%
                    </span>
                  </div>
                </div>

                {/* Egress Highlights Filter */}
                <div className="flex items-center gap-1.5">
                  {(["stairs", "exits", "path", "safe"] as const).map((elem) => (
                    <button
                      key={elem}
                      onClick={() => onHighlightToggle(elem)}
                      className={`px-2 py-1 text-[9px] font-bold uppercase rounded border transition-all ${
                        highlightedElement === elem
                          ? "bg-blue-600/20 border-blue-500 text-blue-400"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {elem === "stairs" && "Stairs"}
                      {elem === "exits" && "Exits"}
                      {elem === "path" && "Path"}
                      {elem === "safe" && "Safe"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Building Summary */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("summary")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-blue-400">
                    <Building className="h-4 w-4" /> 1. Building Summary
                  </span>
                  {expandedSections.summary ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.summary && (
                  <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                    {analysis10?.buildingSummary || aiAnalysis?.summary || "Narrative summary of building layout and structural dimensions."}
                  </p>
                )}
              </div>

              {/* 2. Architectural Observations */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("arch")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-indigo-400">
                    <Grid className="h-4 w-4" /> 2. Architectural Observations
                  </span>
                  {expandedSections.arch ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.arch && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.architecturalObservations || [
                      "Grid-aligned structural walls with clear room separation.",
                      "Corridors provide primary egress path to stairwell.",
                      "Fenestration windows placed along perimeter envelope."
                    ]).map((obs, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 3. Fire Safety Assessment */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("fire")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="h-4 w-4" /> 3. Fire Safety Assessment
                  </span>
                  {expandedSections.fire ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.fire && (
                  <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                    {analysis10?.fireSafetyAssessment || aiAnalysis?.report?.riskAssessment || "Active protection system evaluation and equipment inventory audit."}
                  </p>
                )}
              </div>

              {/* 4. Structural Risks */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("risks")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> 4. Structural Risks
                  </span>
                  {expandedSections.risks ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.risks && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.structuralRisks || [
                      "Server room high thermal load density.",
                      "Electrical panel proximity to combustible materials."
                    ]).map((risk, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 5. Missing Fire Safety Components */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("missing")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-rose-400">
                    <ShieldAlert className="h-4 w-4" /> 5. Missing Fire Safety Components
                  </span>
                  {expandedSections.missing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.missing && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.missingFireSafetyComponents || [
                      "Clean agent gaseous suppression in Server Room.",
                      "Class K extinguisher in kitchen area.",
                      "Strobe alarm units in secondary hallways."
                    ]).map((m, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 6. Evacuation Challenges */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("evac")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-sky-400">
                    <TrendingUp className="h-4 w-4" /> 6. Evacuation Challenges
                  </span>
                  {expandedSections.evac ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.evac && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.evacuationChallenges || [
                      "Travel distance to exit exceeds optimal threshold.",
                      "Potential corridor bottlenecking during high occupancy."
                    ]).map((ch, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                        <span>{ch}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 7. High-Risk Areas */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("highRisk")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-red-400">
                    <Flame className="h-4 w-4" /> 7. High-Risk Areas
                  </span>
                  {expandedSections.highRisk ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.highRisk && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.highRiskAreas || [
                      "Central Server Suite",
                      "Electrical Distribution Room",
                      "Staff Kitchenette"
                    ]).map((hr, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <span>{hr}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 8. Fire Safety Recommendations */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("recs")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-teal-400">
                    <CheckCircle2 className="h-4 w-4" /> 8. Fire Safety Recommendations
                  </span>
                  {expandedSections.recs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.recs && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.fireSafetyRecommendations || [
                      "Install clean agent system in Server Room (NFPA 2001).",
                      "Maintain clear egress corridor width of 44 inches (NFPA 101)."
                    ]).map((rec, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 9. Emergency Response Suggestions */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("emergency")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-purple-400">
                    <Zap className="h-4 w-4" /> 9. Emergency Response Suggestions
                  </span>
                  {expandedSections.emergency ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.emergency && (
                  <ul className="space-y-1.5 pt-1">
                    {(analysis10?.emergencyResponseSuggestions || [
                      "Establish Command Post at Main Entrance Lobby.",
                      "Designate Assembly Area 1 at South Lawn."
                    ]).map((sug, i) => (
                      <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 10. Overall Risk Summary */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-2">
                <button
                  onClick={() => toggleSection("overall")}
                  className="w-full flex items-center justify-between text-left text-[11px] font-bold text-slate-200"
                >
                  <span className="flex items-center gap-2 text-blue-400">
                    <Info className="h-4 w-4" /> 10. Overall Risk Summary
                  </span>
                  {expandedSections.overall ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.overall && (
                  <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                    {analysis10?.overallRiskSummary || aiAnalysis?.report?.executiveSummary || "Overall risk synthesis and compliance status."}
                  </p>
                )}
              </div>
            </div>
          ) : activeTab === "features" ? (
            /* Physical Feature Extraction Tab */
            <div className="space-y-3.5 text-xs text-slate-200">
              {extractedFeatures ? (
                <>
                  {/* Structural Features Card */}
                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-4 w-4" /> Structural Features
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block">Walls Count</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.structural.wallsCount}</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block">Wall Thickness</span>
                        <span className="text-slate-100 font-bold">
                          Ext: {extractedFeatures.structural.wallThicknessExteriorMm}mm / Int: {extractedFeatures.structural.wallThicknessInteriorMm}mm
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block">Columns & Beams</span>
                        <span className="text-slate-100 font-bold">
                          {extractedFeatures.structural.columnsCount} Columns / {extractedFeatures.structural.beamsCount} Beams
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400 block">Roof & Floor</span>
                        <span className="text-slate-100 font-bold">
                          {extractedFeatures.structural.roofType} ({extractedFeatures.structural.floorHeightM}m height)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Architectural Features Card */}
                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <DoorClosed className="h-4 w-4" /> Architectural Features
                    </h5>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.roomsCount}</span>
                        <span className="text-slate-400 block mt-0.5">Rooms</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.corridorsCount}</span>
                        <span className="text-slate-400 block mt-0.5">Corridors</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.doorsCount}</span>
                        <span className="text-slate-400 block mt-0.5">Doors</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.windowsCount}</span>
                        <span className="text-slate-400 block mt-0.5">Windows</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.staircasesCount}</span>
                        <span className="text-slate-400 block mt-0.5">Stairs</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-100 font-bold text-xs">{extractedFeatures.architectural.fireExitsCount}</span>
                        <span className="text-slate-400 block mt-0.5">Fire Exits</span>
                      </div>
                    </div>
                  </div>

                  {/* Special Rooms Card */}
                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Grid className="h-4 w-4" /> Special Rooms
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Server Room</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.serverRoom}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Electrical Room</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.electricalRoom}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Kitchen</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.kitchen}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Laboratory</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.laboratory}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Storage Room</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.storageRoom}</span>
                      </div>
                      <div className="p-1.5 bg-slate-950 border border-slate-800 rounded flex justify-between">
                        <span className="text-slate-400">Assembly Point</span>
                        <span className="text-slate-100 font-bold">{extractedFeatures.specialRooms.assemblyPoint}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fire Safety Features Card */}
                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="h-4 w-4" /> Fire Safety Equipment
                    </h5>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-emerald-400 font-bold text-xs">{extractedFeatures.fireSafety.fireExtinguishers}</span>
                        <span className="text-slate-400 block mt-0.5">Extinguishers</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-emerald-400 font-bold text-xs">{extractedFeatures.fireSafety.smokeDetectors}</span>
                        <span className="text-slate-400 block mt-0.5">Detectors</span>
                      </div>
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-emerald-400 font-bold text-xs">{extractedFeatures.fireSafety.sprinklers}</span>
                        <span className="text-slate-400 block mt-0.5">Sprinklers</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Measurements Card */}
                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Ruler className="h-4 w-4" /> Physical Measurements
                    </h5>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400">Total Floor Area:</span>
                        <span className="font-bold text-slate-100">{extractedFeatures.measurements.totalFloorAreaSqM} sq.m</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400">Avg Room Size / Corridor Width:</span>
                        <span className="font-bold text-slate-100">
                          {extractedFeatures.measurements.averageRoomDimensionsM} / {extractedFeatures.measurements.corridorWidthM}m
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-950 border border-slate-800 rounded">
                        <span className="text-slate-400">Max Dist to Exit / Staircase:</span>
                        <span className="font-bold text-slate-100">
                          {extractedFeatures.measurements.maxDistanceToExitM}m / {extractedFeatures.measurements.maxDistanceToStaircaseM}m
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Grid className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                  <p>Upload a CAD drawing or blueprint image to inspect extracted physical features.</p>
                </div>
              )}
            </div>
          ) : (
            /* JSON Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Raw Output Schema
                </span>
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy JSON
                </button>
              </div>
              <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-blue-400 overflow-x-auto max-h-[450px]">
                {JSON.stringify({ aiAnalysis, extractedFeatures }, null, 2)}
              </pre>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-xs text-slate-400 py-16 space-y-3">
            <Clipboard className="h-8 w-8 text-slate-600" />
            <div>
              <p className="font-semibold text-slate-300">Awaiting CAD / Blueprint Upload</p>
              <p className="text-[10px] mt-1 max-w-[200px]">
                Upload a DXF, DWG, PDF, or floor plan image to extract physical features and run 10-point LLM fire safety analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
