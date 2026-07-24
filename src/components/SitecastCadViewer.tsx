import React, { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import {
  FileText,
  Download,
  UploadCloud,
  Box,
  Layers,
  Sparkles,
  Maximize2,
  RefreshCcw,
  Eye,
  EyeOff,
  Flame,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  Shield,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { extractPhysicalFeatures, ExtractedBuildingFeatures } from "@/services/featureExtraction";
import { analyzeCADWithLLM, TenPointLLMAnalysis } from "@/services/llmCADAnalysis";
import { syncExtractedFeaturesToWBFDVA } from "@/services/cadSyncService";
import { AIAnalysisPanel } from "./AIAnalysisPanel";

interface SitecastCadViewerProps {
  buildingId: number;
  floorLevel: number;
  onCADProcessed?: (features: ExtractedBuildingFeatures, llm: TenPointLLMAnalysis) => void;
}

// Minimal DXF Parser
function parseDXF(text: string) {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: { code: number; value: string }[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1] !== undefined ? lines[i + 1].trim() : "";
    pairs.push({ code, value });
  }
  return reparseDXFEntities(pairs);
}

function reparseDXFEntities(pairs: { code: number; value: string }[]) {
  const entities: any[] = [];
  let inEntities = false;
  let cur: any = null;
  let pendingVertex: any = {};

  const flushVertex = () => {
    if (pendingVertex.x !== undefined && pendingVertex.y !== undefined && cur) {
      cur.points.push([pendingVertex.x, pendingVertex.y, pendingVertex.z || cur.elevation || 0]);
    }
    pendingVertex = {};
  };

  const finish = () => {
    if (cur) {
      flushVertex();
      if (cur.type === "LINE" && cur._x !== undefined) {
        cur.points = [
          [cur._x, cur._y, cur._z || 0],
          [cur._x2, cur._y2, cur._z2 || 0],
        ];
      }
      if (cur.type === "CIRCLE" || cur.type === "ARC") {
        cur.center = [cur._x || 0, cur._y || 0, cur._z || 0];
      }
      if (cur.type === "POINT") {
        cur.points = [[cur._x || 0, cur._y || 0, cur._z || 0]];
      }
      if (cur.points && cur.points.length > 0) entities.push(cur);
    }
    cur = null;
  };

  for (let i = 0; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 2 && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (code === 0 && value === "ENDSEC") {
      if (inEntities) {
        finish();
        inEntities = false;
      }
      continue;
    }
    if (!inEntities) continue;

    if (code === 0) {
      finish();
      if (value === "LINE") cur = { type: "LINE", points: [], layer: "0" };
      else if (value === "LWPOLYLINE" || value === "POLYLINE")
        cur = { type: "POLYLINE", points: [], layer: "0", closed: false, elevation: 0 };
      else if (value === "CIRCLE") cur = { type: "CIRCLE", points: [], layer: "0", radius: 1 };
      else if (value === "ARC") cur = { type: "ARC", points: [], layer: "0", radius: 1, startAngle: 0, endAngle: 360 };
      else if (value === "POINT") cur = { type: "POINT", points: [], layer: "0" };
      else cur = null;
      continue;
    }

    if (!cur) continue;

    switch (code) {
      case 8:
        cur.layer = value;
        break;
      case 10:
        if (cur.type === "POLYLINE") {
          flushVertex();
          pendingVertex.x = parseFloat(value);
        } else cur._x = parseFloat(value);
        break;
      case 20:
        if (cur.type === "POLYLINE") pendingVertex.y = parseFloat(value);
        else cur._y = parseFloat(value);
        break;
      case 30:
        if (cur.type === "POLYLINE") pendingVertex.z = parseFloat(value);
        else cur._z = parseFloat(value);
        break;
      case 11:
        cur._x2 = parseFloat(value);
        break;
      case 21:
        cur._y2 = parseFloat(value);
        break;
      case 31:
        cur._z2 = parseFloat(value);
        break;
      case 40:
        cur.radius = parseFloat(value);
        break;
    }
  }
  finish();
  return entities;
}

export function SitecastCadViewer({
  buildingId,
  floorLevel,
  onCADProcessed,
}: SitecastCadViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"dxf" | "dwg" | "pdf" | "image">("dxf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedFeatures, setExtractedFeatures] = useState<ExtractedBuildingFeatures | null>(null);
  const [llmAnalysis, setLlmAnalysis] = useState<TenPointLLMAnalysis | null>(null);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gemini_api_key") || "";
    }
    return "";
  });
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize 3D Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // dark blue background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(25, 30, 45);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 50, 20);
    scene.add(dirLight);

    // Add ground grid
    const grid = new THREE.GridHelper(80, 40, 0x334155, 0x1e293b);
    scene.add(grid);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 450;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current?.domElement && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Process File Upload
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() || "dxf";
    const type = (["dxf", "dwg", "pdf"].includes(ext) ? ext : "image") as any;
    setFileType(type);

    let dxfEntities: any[] = [];
    let fileDataUrl: string | null = null;

    if (type === "dxf") {
      try {
        const text = await file.text();
        dxfEntities = parseDXF(text);
      } catch (e) {
        console.warn("Error reading DXF text:", e);
      }
    } else if (type === "image" || type === "pdf") {
      const reader = new FileReader();
      fileDataUrl = await new Promise<string>((res) => {
        reader.onload = (e) => res(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }

    // Step 1: Physical Feature Extraction
    const features = extractPhysicalFeatures({ name: file.name, size: file.size, type }, dxfEntities);
    setExtractedFeatures(features);

    // Step 2: 10-Point LLM Analysis
    const llm = await analyzeCADWithLLM(features, fileDataUrl);
    setLlmAnalysis(llm);

    // Step 3: Automatic Sync to WB-FDVA Modules
    await syncExtractedFeaturesToWBFDVA(buildingId, floorLevel, features, llm);

    if (onCADProcessed) {
      onCADProcessed(features, llm);
    }

    // Render 3D Building Extrusion in Three.js Canvas
    if (sceneRef.current) {
      // Remove old meshes except grid and lights
      const scene = sceneRef.current;
      scene.children = scene.children.filter(
        (child) => child.type === "AmbientLight" || child.type === "DirectionalLight" || child.type === "GridHelper"
      );

      // Render Extruded Building Mesh
      const group = new THREE.Group();
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.45, side: THREE.DoubleSide });

      features.extractedRoomsList.forEach((r) => {
        const shape = new THREE.Shape();
        const rw = r.w * 0.4;
        const rh = r.h * 0.4;
        const rx = (r.x - 50) * 0.5;
        const ry = (r.y - 50) * 0.5;

        shape.moveTo(rx, ry);
        shape.lineTo(rx + rw, ry);
        shape.lineTo(rx + rw, ry + rh);
        shape.lineTo(rx, ry + rh);
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 3.2, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, wallMat);
        group.add(mesh);
      });

      scene.add(group);
    }

    setIsProcessing(false);
  };

  return (
    <div className="w-full space-y-4">
      {/* File Upload Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900 border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileArchive className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Sitecast CAD-to-3D Blueprint Processor
            </h4>
            <p className="text-[10px] text-slate-400">
              Upload DXF, DWG, PDF, or floor plan images for feature extraction & LLM analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            accept=".dxf,.dwg,.pdf,.png,.jpg,.jpeg"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />
            {isProcessing ? "Analyzing Blueprint..." : "Upload Blueprint"}
          </button>
          <button
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
            title="Toggle AI Panel"
          >
            <Sparkles className="h-4 w-4 text-blue-400" />
          </button>
        </div>
      </div>

      {/* Main CAD Viewer + AI Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        {/* 3D WebGL Canvas */}
        <div className={`${showAiPanel ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col bg-slate-950 border border-border rounded-2xl overflow-hidden relative shadow-2xl`}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-border text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-400" />
              {fileName ? `Sitecast 3D Engine: ${fileName}` : "Sitecast 3D Viewer Canvas"}
            </span>
            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
              WebGL Extruded Model
            </span>
          </div>

          <div ref={mountRef} className="w-full h-[450px] bg-slate-950 relative" />
        </div>

        {/* AI Analysis Panel */}
        {showAiPanel && (
          <div className="lg:col-span-5 h-[500px]">
            <AIAnalysisPanel
              aiAnalysis={llmAnalysis}
              aiLoading={isProcessing}
              aiError={null}
              onSetApiKey={(key) => {
                localStorage.setItem("gemini_api_key", key);
                setApiKey(key);
              }}
              apiKey={apiKey}
              onHighlightToggle={(elem) => setHighlightedElement(elem)}
              highlightedElement={highlightedElement}
              extractedFeatures={extractedFeatures}
            />
          </div>
        )}
      </div>
    </div>
  );
}
