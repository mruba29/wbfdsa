import React, { useState } from "react";
import { FileArchive, FileText, Download, Box, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { PDFViewer } from "./PDFViewer";
import { SitecastCadViewer } from "./SitecastCadViewer";
import type { CADDrawing, FloorDetails, FloorStatistics } from "@/types/floor";

interface CADViewerProps {
  drawing?: CADDrawing;
  details?: FloorDetails;
  stats?: FloorStatistics;
  buildingId?: number;
  floorLevel?: number;
  onDownload?: () => void;
}

export function CADViewer({
  drawing,
  details,
  stats,
  buildingId = 1,
  floorLevel = 1,
  onDownload,
}: CADViewerProps) {
  const [viewMode, setViewMode] = useState<"standard" | "sitecast3d">("sitecast3d");

  if (!drawing) {
    return (
      <div className="w-full space-y-4">
        {/* Render Sitecast CAD Processor directly even when no file is currently attached to floor */}
        <SitecastCadViewer buildingId={buildingId} floorLevel={floorLevel} />
      </div>
    );
  }

  const { type, name, url } = drawing;

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full space-y-3"
    >
      {/* Mode Switcher Toolbar */}
      <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-slate-900 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 truncate max-w-[250px]" title={name}>
            {name}
          </span>
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === "sitecast3d" ? "standard" : "sitecast3d")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "sitecast3d"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            {viewMode === "sitecast3d" ? "Sitecast 3D Viewer Active" : "Switch to Sitecast 3D"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "sitecast3d" ? (
        <SitecastCadViewer buildingId={buildingId} floorLevel={floorLevel} />
      ) : type === "pdf" ? (
        <PDFViewer url={url} name={name} />
      ) : ["png", "jpg", "jpeg"].includes(type) ? (
        <div className="w-full overflow-auto p-4 flex justify-center bg-[#18181b] min-h-[400px] max-h-[600px] rounded-xl border border-border">
          <img src={url} alt={name} className="object-contain max-w-full h-auto rounded shadow-lg" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-[#131722] min-h-[400px] border border-border rounded-xl">
          <FileArchive className="h-12 w-12 text-amber-500 mb-3" />
          <h4 className="font-semibold text-foreground text-sm mb-1">CAD Drawing Format ({type.toUpperCase()})</h4>
          <p className="max-w-md text-xs text-muted-foreground mb-6">
            Click "Switch to Sitecast 3D" above to analyze this DXF/DWG vector blueprint.
          </p>
        </div>
      )}
    </motion.div>
  );
}
