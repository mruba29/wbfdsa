import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useMemo, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { db, type Building } from "@/lib/db";
import { assessBuilding } from "@/lib/vulnerability";
import { googleSheetsService } from "@/services/googleSheets";
import { 
  generateBuildingAnalysis, 
  sendChatMessage, 
  type AIAnalysisResponse,
  type BuildingAnalysisInput
} from "@/services/aiAnalysisService";
import { 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  Send, 
  FileText, 
  Printer, 
  Copy, 
  Building2, 
  UserMinus, 
  ChevronRight, 
  Settings, 
  Eye, 
  Download,
  Info,
  Clock,
  RefreshCw,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-analysis")({
  head: () => ({
    meta: [
      { title: "AI Building Analysis — WB-FDVA" },
      {
        name: "description",
        content: "Intelligent building fire vulnerability analysis, hazard identification, and prioritized safety recommendations.",
      },
    ],
  }),
  component: AIAnalysisPage,
});

function AIAnalysisPage() {
  const buildings = useLiveQuery(() => db.buildings.toArray(), []);
  const allFloors = useLiveQuery(() => db.floors.toArray(), []);
  const allZones = useLiveQuery(() => db.zones.toArray(), []);
  const allPersonnel = useLiveQuery(() => db.personnel.toArray(), []);
  const allInventory = useLiveQuery(() => db.fireInventory.toArray(), []);
  const allIncidents = useLiveQuery(() => db.incidents.toArray(), []);

  const [bId, setBId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "hazards" | "recommendations" | "chat" | "report">("overview");

  // State for AI response
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: "user" | "model"; content: string }>>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // API Key config state
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gemini_api_key") || localStorage.getItem("wb-gemini-api-key") || "";
    }
    return "";
  });

  // Select first building as default
  useEffect(() => {
    if (!bId && buildings?.length) {
      setBId(buildings[0].id!);
    }
  }, [buildings, bId]);

  const selectedBuilding = useMemo(() => {
    return buildings?.find((b) => b.id === bId) || null;
  }, [buildings, bId]);

  // Compute building-specific datasets
  const buildingFloors = useMemo(() => {
    if (!bId || !allFloors) return [];
    return allFloors.filter((f) => f.buildingId === bId).sort((a, b) => a.level - b.level);
  }, [allFloors, bId]);

  const floorLevels = useMemo(() => buildingFloors.map((f) => f.level), [buildingFloors]);

  const buildingZones = useMemo(() => {
    if (!bId || !allZones) return [];
    return allZones.filter((z) => z.buildingId === bId);
  }, [allZones, bId]);

  const buildingPersonnel = useMemo(() => {
    if (floorLevels.length === 0 || !allPersonnel) return [];
    return allPersonnel.filter((p) => floorLevels.includes(p.assignedFloor));
  }, [allPersonnel, floorLevels]);

  const buildingInventory = useMemo(() => {
    if (!selectedBuilding || !allInventory) return [];
    return allInventory.filter((item) => item.building === selectedBuilding.name);
  }, [allInventory, selectedBuilding]);

  const buildingIncidents = useMemo(() => {
    if (!bId || !allIncidents) return [];
    return allIncidents.filter((i) => i.buildingId === bId);
  }, [allIncidents, bId]);

  const activeIncident = useMemo(() => {
    return buildingIncidents.find((i) => i.status === "active") || null;
  }, [buildingIncidents]);

  // Load checklist compliance score
  const complianceData = useMemo(() => {
    if (!bId) return { percentage: 0, status: {} };
    const saved = localStorage.getItem(`wb-checklist-status-${bId}`);
    if (saved) {
      try {
        const status = JSON.parse(saved);
        const total = 18; // default standard checklist items count
        const passed = Object.values(status).filter((s) => s === "PASS").length;
        const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
        return { percentage, status };
      } catch {
        return { percentage: 0, status: {} };
      }
    }
    return { percentage: 0, status: {} };
  }, [bId]);

  // Re-run AI analysis when selected building, floors, zones, or compliance change
  const triggerAIAnalysis = async () => {
    if (!selectedBuilding) return;
    setAiLoading(true);
    setAiError(null);
    try {
      // Gather CAD extraction reports for floors
      const enrichedFloors = await Promise.all(
        buildingFloors.map(async (f) => {
          const detailed = await googleSheetsService.fetchFloorData(String(bId), f.level);
          return {
            ...f,
            aiAnalysis: detailed?.aiAnalysis || null,
            stats: detailed?.stats || null,
            vulnerability: detailed?.vulnerability || null
          };
        })
      );

      const input: BuildingAnalysisInput = {
        building: selectedBuilding,
        floors: enrichedFloors,
        zones: buildingZones,
        personnel: buildingPersonnel,
        inventory: buildingInventory,
        incidents: buildingIncidents,
        checklistCompliance: complianceData.percentage,
        checklistStatus: complianceData.status,
      };

      const result = await generateBuildingAnalysis(input);
      setAiAnalysis(result);

      // Prepopulate Chat history
      setMessages([
        {
          role: "model",
          content: `### Fire Safety Digital Twin Assistant
 
I have completed the structural audit and risk assessment for **${selectedBuilding.name}**. 
 
*   **Vulnerability Explanation**: ${result.riskExplanation}
*   **Active Hazards**: Detected ${result.hazards.length} fire code safety concerns.
*   **Main Recommendation**: ${result.recommendations[0]?.recommendation || "Maintain standard safety checklist audits."}
 
How can I help you improve emergency operations or compliance today?`,
        },
      ]);
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setAiError(err.message || "Failed to parse building safety files.");
      toast.error("Failed to run AI Building analysis.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBuilding && buildingFloors.length > 0) {
      triggerAIAnalysis();
    }
  }, [bId, buildingFloors.length, complianceData.percentage]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSaveApiKey = () => {
    localStorage.setItem("gemini_api_key", apiKey.trim());
    localStorage.setItem("wb-gemini-api-key", apiKey.trim());
    setShowKeyConfig(false);
    toast.success("Gemini API Key saved. Re-analyzing...");
    triggerAIAnalysis();
  };

  const handleSendChat = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || !selectedBuilding || chatLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: query }]);
    if (!textToSend) setChatInput("");
    setChatLoading(true);

    try {
      const enrichedFloors = await Promise.all(
        buildingFloors.map(async (f) => {
          const detailed = await googleSheetsService.fetchFloorData(String(bId), f.level);
          return {
            ...f,
            aiAnalysis: detailed?.aiAnalysis || null,
            stats: detailed?.stats || null,
            vulnerability: detailed?.vulnerability || null
          };
        })
      );

      const input: BuildingAnalysisInput = {
        building: selectedBuilding,
        floors: enrichedFloors,
        zones: buildingZones,
        personnel: buildingPersonnel,
        inventory: buildingInventory,
        incidents: buildingIncidents,
        checklistCompliance: complianceData.percentage,
        checklistStatus: complianceData.status,
      };

      const response = await sendChatMessage(input, messages, query);
      setMessages((prev) => [...prev, { role: "model", content: response }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: "⚠️ I encountered an error communicating with the AI host. Please verify your credentials or network link.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const copyReportToClipboard = () => {
    if (!aiAnalysis) return;
    const reportText = `
# Fire Safety Audit Report: ${selectedBuilding?.name}
Generated by Protect Scope AI Analyst on ${new Date().toLocaleDateString()}

## Executive Summary
${aiAnalysis.report.executiveSummary}

## Building Overview
${aiAnalysis.report.buildingOverview}

## Detected Hazards & Violations
${aiAnalysis.report.detectedHazards}

## Risk Assessment & Vulnerability Analysis
${aiAnalysis.report.riskAssessment}
${aiAnalysis.report.vulnerabilityAnalysis}

## Prioritized Recommendations
${aiAnalysis.report.recommendations}

## Emergency Preparedness & Egress Flow
${aiAnalysis.report.emergencyPreparedness}

## Inspection Notes & Field Operations
${aiAnalysis.report.inspectionNotes}

## Code Compliance Suggestions
${aiAnalysis.report.complianceSuggestions}
    `.trim();

    navigator.clipboard.writeText(reportText);
    toast.success("Markdown report copied to clipboard.");
  };

  const printReport = () => {
    window.print();
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical": return "bg-risk-red/10 text-risk-red border-risk-red/30";
      case "high": return "bg-risk-orange/10 text-risk-orange border-risk-orange/30";
      case "medium": return "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/30";
      default: return "bg-risk-green/10 text-risk-green border-risk-green/30";
    }
  };

  const getPriorityBadgeColor = (prio: number) => {
    if (prio === 1) return "bg-risk-red text-white";
    if (prio === 2) return "bg-risk-orange text-white";
    if (prio === 3) return "bg-risk-yellow text-slate-900";
    return "bg-slate-700 text-white";
  };

  // Re-calculate the vulnerability score for display
  const calculatedStats = useMemo(() => {
    if (!buildingZones || !buildingFloors) return { totalImpact: 0, level: "Low" };
    const incidentFloorLevel = activeIncident && allFloors
      ? allFloors.find((f) => f.id === activeIncident.floorId)?.level ?? null
      : null;
    const impacts = assessBuilding(buildingZones, buildingFloors, incidentFloorLevel);
    const complianceMultiplier = 1.2 - (complianceData.percentage / 100) * 0.4;
    const totalImpact = impacts.reduce((s, i) => s + i.breakdown.total, 0) * complianceMultiplier;

    let level = "Low";
    if (totalImpact > 800) level = "Critical";
    else if (totalImpact > 500) level = "High";
    else if (totalImpact > 250) level = "Medium";

    return { totalImpact: Math.round(totalImpact), level };
  }, [buildingZones, buildingFloors, activeIncident, complianceData.percentage, allFloors]);

  return (
    <AppShell
      title="AI Building Analysis"
      subtitle="Intelligent risk insights, hazard modeling, and prioritized recommendations"
      actions={
        <div className="flex gap-2 relative z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="border-primary/30 text-primary-foreground hover:bg-primary/10 gap-1.5 h-9"
          >
            <Settings className="h-4 w-4" /> Credentials
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerAIAnalysis}
            disabled={aiLoading || !bId}
            className="gap-1.5 h-9"
          >
            <RefreshCw className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} /> Recalculate
          </Button>
        </div>
      }
    >
      {/* Credentials config drawer */}
      {showKeyConfig && (
        <div className="mb-6 p-4 rounded-xl border border-[#2A5FFF]/30 bg-[#0B1220]/90 backdrop-blur-xl shadow-xl space-y-3 max-w-xl animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Brain className="h-4.5 w-4.5 text-[#2A5FFF]" /> AI Model Connection Settings
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setShowKeyConfig(false)} className="h-6 w-6 p-0 text-slate-400">
              ✕
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Google Gemini API Key (AIzaSy...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-background/60 text-xs"
            />
            <Button size="sm" onClick={handleSaveApiKey} className="h-10">
              Save & Apply
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-normal">
            Configure your Gemini API key to run direct multimodal explanations and chat diagnostics. Leaves empty to utilize the local high-fidelity rules-based simulator fallback.
          </p>
        </div>
      )}

      {/* Building Selector & Active Incident alert banner */}
      <div className="mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/40 p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
            Select Asset:
          </span>
          <select
            className="h-10 rounded-lg border border-border bg-secondary px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary w-64 cursor-pointer"
            value={bId ?? ""}
            onChange={(e) => {
              setBId(+e.target.value);
              setAiAnalysis(null);
            }}
          >
            <option value="" disabled>
              Select building...
            </option>
            {buildings?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.type})
              </option>
            ))}
          </select>
        </div>

        {activeIncident ? (
          <div className="text-xs text-risk-red flex items-center gap-2 px-3 py-2 rounded-lg bg-risk-red/10 border border-risk-red/20 font-bold animate-pulse">
            <AlertTriangle className="h-4.5 w-4.5" />
            Active incident reported on Floor level {buildingFloors.find(f => f.id === activeIncident.floorId)?.level ?? 1}! Egress priorities escalated.
          </div>
        ) : (
          <div className="text-xs text-risk-green flex items-center gap-2 bg-risk-green/10 text-risk-green px-3 py-2 rounded-lg border border-risk-green/20 font-bold">
            <CheckCircle2 className="h-4 w-4" />
            Asset Baseline Secured — No active alarms.
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto scrollbar-none gap-2 text-xs relative z-10">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all ${
            activeTab === "overview"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <Building2 className="h-4 w-4" /> Overview & Risk
        </button>
        <button
          onClick={() => setActiveTab("hazards")}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all ${
            activeTab === "hazards"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <AlertTriangle className="h-4 w-4" /> Hazards & Evacuation
        </button>
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all ${
            activeTab === "recommendations"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> Recommendations
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all ${
            activeTab === "chat"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <Brain className="h-4 w-4" /> Safety Assistant
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all ${
            activeTab === "report"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <FileText className="h-4 w-4" /> Report Generator
        </button>
      </div>

      {/* Main Viewport Content */}
      <div className="min-h-[400px]">
        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
              <Brain className="h-8 w-8 text-primary animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">AI Safety Audit in Progress...</h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Reading building layout, analyzing floor egress, calculating density ratios, and generating safety recommendations.
              </p>
            </div>
          </div>
        ) : aiError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card/30 border border-border rounded-2xl">
            <AlertTriangle className="h-10 w-10 text-risk-red" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">AI Analysis Error</h3>
              <p className="text-xs text-muted-foreground max-w-sm">{aiError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={triggerAIAnalysis} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : !selectedBuilding ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-card/30 border border-border rounded-2xl">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Select a building from the dropdown to start the assessment.</p>
          </div>
        ) : aiAnalysis ? (
          <div className="space-y-6 animate-fade-in">
            
            {/* TAB 1: OVERVIEW & RISK */}
            {activeTab === "overview" && (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Building Summary Card */}
                <Card className="col-span-2 bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Building Summary
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Natural language narrative generated from structural metrics and databases.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-xs leading-relaxed text-slate-300 font-medium">
                      {aiAnalysis.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Score & Risk Summary Card */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm hover:border-primary/30 transition-all duration-300 flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Risk Index Profile
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Derived from active safety standards.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center py-4">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">
                      Calibrated Vulnerability Score
                    </div>
                    <div className={`text-5xl font-extrabold tracking-tighter ${
                      calculatedStats.level === "Critical" ? "text-risk-red" : 
                      calculatedStats.level === "High" ? "text-risk-orange" : 
                      calculatedStats.level === "Medium" ? "text-risk-yellow" : "text-risk-green"
                    }`}>
                      {calculatedStats.totalImpact}
                    </div>
                    <div className="mt-2">
                      <Badge className={`uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        calculatedStats.level === "Critical" ? "bg-risk-red/10 text-risk-red border border-risk-red/20" : 
                        calculatedStats.level === "High" ? "bg-risk-orange/10 text-risk-orange border border-risk-orange/20" : 
                        calculatedStats.level === "Medium" ? "bg-risk-yellow/10 text-risk-yellow border border-risk-yellow/20" : "bg-risk-green/10 text-risk-green border border-risk-green/20"
                      }`}>
                        {calculatedStats.level} Risk Rating
                      </Badge>
                    </div>
                    <div className="mt-4 w-full flex items-center justify-between text-[10px] text-muted-foreground px-4 border-t border-border pt-3">
                      <span>AI Confidence: {aiAnalysis.confidence}%</span>
                      <span>Checklist Compliance: {complianceData.percentage}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Risk Explanation Card */}
                <Card className="col-span-3 bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      AI Risk Analysis
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detailed explanation of the safety index scoring reasoning.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-xs leading-relaxed text-slate-300 bg-secondary/30 p-3 rounded-lg border border-border/50">
                      {aiAnalysis.riskExplanation}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 2: HAZARDS & EVACUATION */}
            {activeTab === "hazards" && (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Fire Hazard Detections Table */}
                <Card className="col-span-3 bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-risk-red animate-pulse" />
                      Fire Hazard Detection & Code Violations
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Safety hazards identified dynamically within the building and floor registries.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-secondary/80 border-b border-border text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                            <th className="p-3">Hazard Description</th>
                            <th className="p-3 w-28">Severity</th>
                            <th className="p-3">Reason / Vector</th>
                            <th className="p-3">AI Recommendation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {aiAnalysis.hazards.map((hz, idx) => (
                            <tr key={idx} className="hover:bg-secondary/40 transition-colors">
                              <td className="p-3 font-semibold text-slate-200 flex items-start gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-risk-orange mt-1.5 shrink-0" />
                                {hz.description}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${getSeverityColor(hz.severity)}`}>
                                  {hz.severity}
                                </Badge>
                              </td>
                              <td className="p-3 text-muted-foreground leading-normal">{hz.reason}</td>
                              <td className="p-3 text-slate-300 font-medium leading-normal">{hz.recommendation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Evacuation Assessment Details */}
                <Card className="col-span-2 bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Evacuation Assessment
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Critical analysis of egress paths, staircase transit, and elevator locking constraints.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-4">
                    <p className="text-xs leading-relaxed text-slate-300 bg-secondary/35 p-3.5 rounded-lg border border-border/60">
                      {aiAnalysis.evacuationAssessment.details}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-semibold px-1">
                      <span className="text-muted-foreground">Evacuation Difficulty:</span>
                      <Badge className={`uppercase text-[9px] font-bold px-2 py-0.5 rounded ${
                        aiAnalysis.evacuationAssessment.difficulty === "Critical" || aiAnalysis.evacuationAssessment.difficulty === "Difficult"
                          ? "bg-risk-red/20 text-risk-red border border-risk-red/30" 
                          : "bg-risk-green/20 text-risk-green border border-risk-green/30"
                      }`}>
                        {aiAnalysis.evacuationAssessment.difficulty}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Immediate Evacuation Priorities */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm hover:border-primary/30 transition-all duration-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserMinus className="h-5 w-5 text-primary" />
                      Evacuation Priorities
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Highest vulnerability individuals requiring assistance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {aiAnalysis.evacuationAssessment.immediatePriorities.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No special-needs personnel registered.</p>
                    ) : (
                      <div className="space-y-3">
                        {aiAnalysis.evacuationAssessment.immediatePriorities.map((item, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-border/50 bg-secondary/20 flex flex-col gap-1 text-[11px] hover:border-primary/30 transition-colors">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-200">{item.name}</span>
                              <Badge className="text-[8px] bg-primary/20 text-primary border border-primary/30">L{item.floor}</Badge>
                            </div>
                            <span className="text-muted-foreground text-[10px]">Emp ID: {item.employeeId}</span>
                            <span className="text-slate-300 text-[10px] italic leading-tight mt-1">Reason: {item.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 3: RECOMMENDATIONS */}
            {activeTab === "recommendations" && (
              <div className="grid gap-6">
                {/* Prioritized Recommendations Card */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Prioritized Safety Recommendations
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Mitigation steps ordered by priority and impact level to reduce the Total Vulnerability score.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {aiAnalysis.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-xl border border-border/60 bg-secondary/20 hover:border-primary/30 transition-all duration-300">
                          <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${getPriorityBadgeColor(rec.priority)}`}>
                            {rec.priority}
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-slate-100">{rec.recommendation}</h4>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                              <strong>Expected Impact:</strong> {rec.impact}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Status:</span>
                              <Badge variant="outline" className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                                rec.status.toLowerCase() === "implemented" ? "bg-risk-green/10 text-risk-green border-risk-green/30" :
                                rec.status.toLowerCase() === "in progress" ? "bg-risk-yellow/10 text-risk-yellow border-risk-yellow/30" :
                                "bg-slate-800 text-slate-400 border-slate-700"
                              }`}>
                                {rec.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 4: CHAT ASSISTANT */}
            {activeTab === "chat" && (
              <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
                {/* Chat window */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm flex flex-col h-[520px] overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI Fire Safety Assistant
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ask questions regarding vulnerability calculations, escape route layouts, and personnel evac lists.
                    </CardDescription>
                  </CardHeader>
                  
                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3.5 py-2.5 border leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-slate-200 border-border/80"
                          }`}
                        >
                          <div className="prose prose-invert prose-xs max-w-none">
                            {/* Standard markdown paragraphs rendering */}
                            {msg.content.split("\n\n").map((para, pIdx) => {
                              // Render headers
                              if (para.startsWith("### ")) {
                                return <h4 key={pIdx} className="text-xs font-bold text-slate-100 mt-2 mb-1 uppercase tracking-wider">{para.replace("### ", "")}</h4>;
                              }
                              if (para.startsWith("## ")) {
                                return <h3 key={pIdx} className="text-sm font-extrabold text-slate-100 mt-3 mb-1.5 border-b border-border/40 pb-1">{para.replace("## ", "")}</h3>;
                              }
                              
                              // Render bullet points
                              if (para.includes("\n* ") || para.includes("\n- ") || para.startsWith("* ") || para.startsWith("- ")) {
                                const lines = para.split("\n").filter(Boolean);
                                return (
                                  <ul key={pIdx} className="list-disc list-inside space-y-1 my-1">
                                    {lines.map((l, lIdx) => {
                                      const cleanLine = l.replace(/^[*-\s]+/, "").trim();
                                      // Render bold text in bullets
                                      const boldParts = cleanLine.split("**");
                                      if (boldParts.length > 1) {
                                        return (
                                          <li key={lIdx}>
                                            {boldParts.map((part, ptIdx) => ptIdx % 2 === 1 ? <strong key={ptIdx} className="text-slate-100">{part}</strong> : part)}
                                          </li>
                                        );
                                      }
                                      return <li key={lIdx}>{cleanLine}</li>;
                                    })}
                                  </ul>
                                );
                              }

                              // Render numbered lists
                              if (/^\d+\./.test(para.trim())) {
                                const lines = para.split("\n").filter(Boolean);
                                return (
                                  <ol key={pIdx} className="list-decimal list-inside space-y-1 my-1">
                                    {lines.map((l, lIdx) => {
                                      const cleanLine = l.replace(/^\d+\.[\s]*/, "").trim();
                                      const boldParts = cleanLine.split("**");
                                      if (boldParts.length > 1) {
                                        return (
                                          <li key={lIdx}>
                                            {boldParts.map((part, ptIdx) => ptIdx % 2 === 1 ? <strong key={ptIdx} className="text-slate-100">{part}</strong> : part)}
                                          </li>
                                        );
                                      }
                                      return <li key={lIdx}>{cleanLine}</li>;
                                    })}
                                  </ol>
                                );
                              }

                              // Render plain text with possible bolding
                              const boldParts = para.split("**");
                              if (boldParts.length > 1) {
                                return (
                                  <p key={pIdx} className="my-1">
                                    {boldParts.map((part, ptIdx) => ptIdx % 2 === 1 ? <strong key={ptIdx} className="text-slate-100">{part}</strong> : part)}
                                  </p>
                                );
                              }

                              return <p key={pIdx} className="my-1">{para}</p>;
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {chatLoading && (
                      <div className="flex justify-start items-center gap-2 text-muted-foreground italic text-[11px] animate-pulse">
                        <Sparkles className="h-4 w-4 text-primary animate-spin" /> Analyst typing...
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  
                  {/* Chat input form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="p-3 bg-secondary/40 border-t border-border flex gap-2"
                  >
                    <Input
                      placeholder="Ask about risk, floor priorities, compliance suggestions..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatLoading}
                      className="flex-1 bg-background/50 h-10 text-xs"
                    />
                    <Button type="submit" disabled={chatLoading || !chatInput.trim()} className="h-10 px-4">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </Card>

                {/* Quick suggestions */}
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Inquiries</div>
                  <div className="flex flex-col gap-2">
                    {[
                      "Analyze this building.",
                      "Why is this building high risk?",
                      "Which floor is most vulnerable?",
                      "Which occupants require immediate evacuation?",
                      "Suggest safety improvements.",
                      "Explain the vulnerability score.",
                      "Generate inspection notes.",
                      "Create emergency response recommendations."
                    ].map((qText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(qText)}
                        disabled={chatLoading}
                        className="text-left p-2.5 rounded-lg border border-border bg-card/40 hover:bg-primary/10 hover:border-primary/40 text-[11px] font-semibold text-slate-300 transition-all duration-200"
                      >
                        {qText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: REPORT GENERATOR */}
            {activeTab === "report" && (
              <div className="grid gap-6">
                {/* Report controls */}
                <div className="flex items-center justify-between border border-border p-3.5 rounded-xl bg-card/40 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Official Fire Safety Compliance Report</h4>
                      <p className="text-[10px] text-muted-foreground">Download or print full formatted assessment report.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyReportToClipboard} className="gap-1.5 text-xs h-9">
                      <Copy className="h-4 w-4" /> Copy Markdown
                    </Button>
                    <Button size="sm" onClick={printReport} className="gap-1.5 text-xs h-9">
                      <Printer className="h-4 w-4" /> Print / PDF
                    </Button>
                  </div>
                </div>

                {/* Printable Report preview block */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/60 p-6 md:p-8 font-sans space-y-6 overflow-y-auto max-h-[600px] border-l-4 border-l-[#2A5FFF]">
                  <div className="flex justify-between items-start border-b border-border/60 pb-5">
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">{selectedBuilding.name}</h2>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Official Fire Vulnerability & Emergency Response Assessment</p>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <p>Date: {new Date().toLocaleDateString()}</p>
                      <p>Assessor: Protect Scope AI Analyst</p>
                      <p>System Version: v4.1</p>
                    </div>
                  </div>

                  <div className="space-y-6 text-xs leading-relaxed text-slate-300">
                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">1. Executive Summary</h3>
                      <p className="bg-secondary/15 p-3 rounded-lg border border-border/30">{aiAnalysis.report.executiveSummary}</p>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">2. Building Overview</h3>
                      <p>{aiAnalysis.report.buildingOverview}</p>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">3. Detected Hazards & Violations</h3>
                      <p className="bg-secondary/15 p-3 rounded-lg border border-border/30 whitespace-pre-line">{aiAnalysis.report.detectedHazards}</p>
                    </section>

                    <div className="grid md:grid-cols-2 gap-4">
                      <section className="space-y-2">
                        <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">4. Risk Assessment</h3>
                        <p>{aiAnalysis.report.riskAssessment}</p>
                      </section>
                      <section className="space-y-2">
                        <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">5. Vulnerability Analysis</h3>
                        <p>{aiAnalysis.report.vulnerabilityAnalysis}</p>
                      </section>
                    </div>

                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">6. Actionable Recommendations</h3>
                      <p className="bg-secondary/15 p-3 rounded-lg border border-border/30 whitespace-pre-line">{aiAnalysis.report.recommendations}</p>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">7. Emergency Preparedness & Drills</h3>
                      <p>{aiAnalysis.report.emergencyPreparedness}</p>
                    </section>

                    <div className="grid md:grid-cols-2 gap-4">
                      <section className="space-y-2">
                        <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">8. Inspector Field Notes</h3>
                        <p className="bg-secondary/15 p-3 rounded-lg border border-border/30">{aiAnalysis.report.inspectionNotes}</p>
                      </section>
                      <section className="space-y-2">
                        <h3 className="text-sm font-bold text-[#2A5FFF] border-b border-border/40 pb-1 uppercase tracking-wider">9. Compliance Suggestions</h3>
                        <p>{aiAnalysis.report.complianceSuggestions}</p>
                      </section>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-card/30 border border-border rounded-2xl">
            <Info className="h-10 w-10 text-muted-foreground/40 animate-pulse" />
            <p className="text-xs text-muted-foreground">Select a building above to trigger the initial AI Safety assessment.</p>
          </div>
        )}
      </div>

      {/* HIDDEN PRINT LAYOUT */}
      {selectedBuilding && aiAnalysis && (
        <div className="hidden print:block absolute inset-0 bg-white text-black p-8 z-50 overflow-visible font-sans text-xs leading-relaxed">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide">{selectedBuilding.name}</h1>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">
                Official Fire Safety Audit & Response priorities
              </p>
            </div>
            <div className="text-right text-[10px] text-gray-500">
              <p>Generated: {new Date().toLocaleString()}</p>
              <p>Auditor: Protect Scope AI Analyst</p>
            </div>
          </div>

          <div className="space-y-6">
            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">1. Executive Summary</h2>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">{aiAnalysis.report.executiveSummary}</p>
            </section>

            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">2. Building Overview</h2>
              <p className="text-gray-700">{aiAnalysis.report.buildingOverview}</p>
            </section>

            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">3. Detected Hazards & Violations</h2>
              <p className="text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-line">{aiAnalysis.report.detectedHazards}</p>
            </section>

            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">4. Risk & Vulnerability Analysis</h2>
              <p className="text-gray-700 mb-2">{aiAnalysis.report.riskAssessment}</p>
              <p className="text-gray-700">{aiAnalysis.report.vulnerabilityAnalysis}</p>
            </section>

            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">5. Prioritized Egress Recommendations</h2>
              <p className="text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-line">{aiAnalysis.report.recommendations}</p>
            </section>

            <section className="pb-3 border-b border-gray-200">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">6. Emergency Preparedness Protocol</h2>
              <p className="text-gray-700">{aiAnalysis.report.emergencyPreparedness}</p>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">7. Inspector Field Notes</h2>
                <p className="text-gray-700 bg-gray-50 p-3 rounded">{aiAnalysis.report.inspectionNotes}</p>
              </section>
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mb-2">8. Compliance Suggestions</h2>
                <p className="text-gray-700 bg-gray-50 p-3 rounded">{aiAnalysis.report.complianceSuggestions}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
