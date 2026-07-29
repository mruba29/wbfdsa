import React, { useState } from "react";
import {
  Flame,
  Navigation,
  Layers,
  Sliders,
  Maximize2,
  Compass,
  AlertOctagon,
  DoorOpen,
  Landmark,
  ArrowUpDown,
  Zap,
  Cpu,
  Users,
  ShieldCheck,
  Eye,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RoomData {
  id: string;
  name: string;
  type: "server" | "office" | "stairwell" | "lift" | "lobby" | "conference" | "electrical" | "storage";
  x: number;
  y: number;
  w: number;
  h: number;
  occupancy: number;
  risk: "SAFE" | "MEDIUM" | "HIGH" | "CRITICAL";
  equipment: string[];
  distStaircase: string;
  distLift: string;
  distExit: string;
}

const DEFAULT_ROOMS: RoomData[] = [
  {
    id: "r1",
    name: "Server Room A",
    type: "server",
    x: 60,
    y: 50,
    w: 220,
    h: 180,
    occupancy: 2,
    risk: "CRITICAL",
    equipment: ["FM-200 Clean Agent", "Optical Smoke Sensor"],
    distStaircase: "18 m",
    distLift: "28 m",
    distExit: "24 m",
  },
  {
    id: "r2",
    name: "Main Executive Office",
    type: "office",
    x: 295,
    y: 50,
    w: 250,
    h: 180,
    occupancy: 12,
    risk: "MEDIUM",
    equipment: ["Wet Sprinkler Head", "Emergency Light"],
    distStaircase: "12 m",
    distLift: "15 m",
    distExit: "16 m",
  },
  {
    id: "r3",
    name: "Stairwell A (Pressurized)",
    type: "stairwell",
    x: 560,
    y: 50,
    w: 180,
    h: 180,
    occupancy: 0,
    risk: "SAFE",
    equipment: ["Fire Door (2-Hr)", "Exhaust Pressurization"],
    distStaircase: "0 m",
    distLift: "8 m",
    distExit: "5 m",
  },
  {
    id: "r4",
    name: "Conference Suite 101",
    type: "conference",
    x: 60,
    y: 245,
    w: 220,
    h: 195,
    occupancy: 14,
    risk: "SAFE",
    equipment: ["Dry Powder Extinguisher", "Smoke Detector"],
    distStaircase: "22 m",
    distLift: "25 m",
    distExit: "18 m",
  },
  {
    id: "r5",
    name: "Central Lobby & Egress",
    type: "lobby",
    x: 295,
    y: 245,
    w: 250,
    h: 195,
    occupancy: 8,
    risk: "SAFE",
    equipment: ["Manual Pull Station", "Luminous Exit Sign"],
    distStaircase: "10 m",
    distLift: "6 m",
    distExit: "0 m",
  },
  {
    id: "r6",
    name: "Elevator Shaft & Vault",
    type: "lift",
    x: 560,
    y: 245,
    w: 180,
    h: 90,
    occupancy: 0,
    risk: "SAFE",
    equipment: ["Auto Recall Controller"],
    distStaircase: "8 m",
    distLift: "0 m",
    distExit: "12 m",
  },
  {
    id: "r7",
    name: "Electrical Control Panel",
    type: "electrical",
    x: 560,
    y: 350,
    w: 180,
    h: 90,
    occupancy: 1,
    risk: "HIGH",
    equipment: ["CO2 Gas Suppressor"],
    distStaircase: "14 m",
    distLift: "10 m",
    distExit: "15 m",
  },
];

function getRoomsForFloor(floorLevel: number): { rooms: RoomData[]; fireOrigin: { x: number; y: number; label: string } | null } {
  if (floorLevel === 2) {
    return {
      fireOrigin: { x: 650, y: 395, label: "ELECTRICAL SHORT CIRCUIT" },
      rooms: [
        {
          id: "r2-1",
          name: "R&D Chemical Lab 201",
          type: "server",
          x: 60,
          y: 50,
          w: 220,
          h: 180,
          occupancy: 8,
          risk: "HIGH",
          equipment: ["Class D Extinguisher", "Emergency Fume Hood"],
          distStaircase: "20 m",
          distLift: "25 m",
          distExit: "22 m",
        },
        {
          id: "r2-2",
          name: "Software Engineering Bay",
          type: "office",
          x: 295,
          y: 50,
          w: 250,
          h: 180,
          occupancy: 28,
          risk: "HIGH",
          equipment: ["Wet Sprinkler", "Strobe Alarm"],
          distStaircase: "10 m",
          distLift: "12 m",
          distExit: "15 m",
        },
        {
          id: "r2-3",
          name: "Stairwell B (Pressurized)",
          type: "stairwell",
          x: 560,
          y: 50,
          w: 180,
          h: 180,
          occupancy: 0,
          risk: "SAFE",
          equipment: ["Fire Door (2-Hr)", "Smoke Evac Fan"],
          distStaircase: "0 m",
          distLift: "6 m",
          distExit: "4 m",
        },
        {
          id: "r2-4",
          name: "Open Workspace & Pods",
          type: "conference",
          x: 60,
          y: 245,
          w: 220,
          h: 195,
          occupancy: 16,
          risk: "MEDIUM",
          equipment: ["CO2 Extinguisher", "Smoke Sensor"],
          distStaircase: "18 m",
          distLift: "20 m",
          distExit: "16 m",
        },
        {
          id: "r2-5",
          name: "Pantry & Cafeteria",
          type: "lobby",
          x: 295,
          y: 245,
          w: 250,
          h: 195,
          occupancy: 10,
          risk: "MEDIUM",
          equipment: ["Heat Detector", "Fire Blanket"],
          distStaircase: "12 m",
          distLift: "8 m",
          distExit: "10 m",
        },
        {
          id: "r2-6",
          name: "Elevator Shaft L2",
          type: "lift",
          x: 560,
          y: 245,
          w: 180,
          h: 90,
          occupancy: 0,
          risk: "SAFE",
          equipment: ["Elevator Interlock"],
          distStaircase: "6 m",
          distLift: "0 m",
          distExit: "10 m",
        },
        {
          id: "r2-7",
          name: "Secondary Distribution Board",
          type: "electrical",
          x: 560,
          y: 350,
          w: 180,
          h: 90,
          occupancy: 2,
          risk: "CRITICAL",
          equipment: ["Automatic Arc Suppression"],
          distStaircase: "10 m",
          distLift: "8 m",
          distExit: "12 m",
        },
      ],
    };
  }

  if (floorLevel === 3) {
    return {
      fireOrigin: null, // Safe Floor
      rooms: [
        {
          id: "r3-1",
          name: "Executive Boardroom",
          type: "conference",
          x: 60,
          y: 50,
          w: 220,
          h: 180,
          occupancy: 6,
          risk: "SAFE",
          equipment: ["Optical Smoke Detector"],
          distStaircase: "15 m",
          distLift: "18 m",
          distExit: "16 m",
        },
        {
          id: "r3-2",
          name: "Finance Suite 302",
          type: "office",
          x: 295,
          y: 50,
          w: 250,
          h: 180,
          occupancy: 15,
          risk: "SAFE",
          equipment: ["Sprinkler Head"],
          distStaircase: "8 m",
          distLift: "10 m",
          distExit: "12 m",
        },
        {
          id: "r3-3",
          name: "Stairwell A (Pressurized)",
          type: "stairwell",
          x: 560,
          y: 50,
          w: 180,
          h: 180,
          occupancy: 0,
          risk: "SAFE",
          equipment: ["Fire Door"],
          distStaircase: "0 m",
          distLift: "5 m",
          distExit: "4 m",
        },
        {
          id: "r3-4",
          name: "HR Operations Suite",
          type: "office",
          x: 60,
          y: 245,
          w: 220,
          h: 195,
          occupancy: 9,
          risk: "SAFE",
          equipment: ["Emergency Light"],
          distStaircase: "14 m",
          distLift: "16 m",
          distExit: "14 m",
        },
        {
          id: "r3-5",
          name: "Quiet Study Lounge",
          type: "lobby",
          x: 295,
          y: 245,
          w: 250,
          h: 195,
          occupancy: 5,
          risk: "SAFE",
          equipment: ["Smoke Alarm"],
          distStaircase: "8 m",
          distLift: "4 m",
          distExit: "8 m",
        },
        {
          id: "r3-6",
          name: "Elevator Shaft L3",
          type: "lift",
          x: 560,
          y: 245,
          w: 180,
          h: 195,
          occupancy: 0,
          risk: "SAFE",
          equipment: ["Elevator Recall"],
          distStaircase: "5 m",
          distLift: "0 m",
          distExit: "8 m",
        },
      ],
    };
  }

  if (floorLevel >= 4) {
    return {
      fireOrigin: { x: 650, y: 140, label: "HVAC MOTOR IGNITION" },
      rooms: [
        {
          id: "r4-1",
          name: "HVAC Mechanical Plant",
          type: "electrical",
          x: 560,
          y: 50,
          w: 180,
          h: 180,
          occupancy: 1,
          risk: "CRITICAL",
          equipment: ["Aerosol Fire Suppression"],
          distStaircase: "6 m",
          distLift: "10 m",
          distExit: "8 m",
        },
        {
          id: "r4-2",
          name: "Roof Access Terrace",
          type: "lobby",
          x: 60,
          y: 50,
          w: 485,
          h: 180,
          occupancy: 4,
          risk: "HIGH",
          equipment: ["Helipad Lighting", "Emergency Call Box"],
          distStaircase: "12 m",
          distLift: "15 m",
          distExit: "10 m",
        },
        {
          id: "r4-3",
          name: "Solar Inverter Room",
          type: "electrical",
          x: 60,
          y: 245,
          w: 485,
          h: 195,
          occupancy: 2,
          risk: "HIGH",
          equipment: ["DC Isolator Switch", "FM-200 Suppressor"],
          distStaircase: "16 m",
          distLift: "20 m",
          distExit: "14 m",
        },
        {
          id: "r4-4",
          name: "Stairwell Roof Exit",
          type: "stairwell",
          x: 560,
          y: 245,
          w: 180,
          h: 195,
          occupancy: 0,
          risk: "SAFE",
          equipment: ["Roof Hatch Release"],
          distStaircase: "0 m",
          distLift: "6 m",
          distExit: "2 m",
        },
      ],
    };
  }

  // Level 1 Default
  return {
    fireOrigin: { x: 170, y: 140, label: "CRITICAL FIRE ORIGIN" },
    rooms: [
      {
        id: "r1",
        name: "Server Room A",
        type: "server",
        x: 60,
        y: 50,
        w: 220,
        h: 180,
        occupancy: 2,
        risk: "CRITICAL",
        equipment: ["FM-200 Clean Agent", "Optical Smoke Sensor"],
        distStaircase: "18 m",
        distLift: "28 m",
        distExit: "24 m",
      },
      {
        id: "r2",
        name: "Main Executive Office",
        type: "office",
        x: 295,
        y: 50,
        w: 250,
        h: 180,
        occupancy: 12,
        risk: "MEDIUM",
        equipment: ["Wet Sprinkler Head", "Emergency Light"],
        distStaircase: "12 m",
        distLift: "15 m",
        distExit: "16 m",
      },
      {
        id: "r3",
        name: "Stairwell A (Pressurized)",
        type: "stairwell",
        x: 560,
        y: 50,
        w: 180,
        h: 180,
        occupancy: 0,
        risk: "SAFE",
        equipment: ["Fire Door (2-Hr)", "Exhaust Pressurization"],
        distStaircase: "0 m",
        distLift: "8 m",
        distExit: "5 m",
      },
      {
        id: "r4",
        name: "Conference Suite 101",
        type: "conference",
        x: 60,
        y: 245,
        w: 220,
        h: 195,
        occupancy: 14,
        risk: "SAFE",
        equipment: ["Dry Powder Extinguisher", "Smoke Detector"],
        distStaircase: "22 m",
        distLift: "25 m",
        distExit: "18 m",
      },
      {
        id: "r5",
        name: "Central Lobby & Egress",
        type: "lobby",
        x: 295,
        y: 245,
        w: 250,
        h: 195,
        occupancy: 8,
        risk: "SAFE",
        equipment: ["Manual Pull Station", "Luminous Exit Sign"],
        distStaircase: "10 m",
        distLift: "6 m",
        distExit: "0 m",
      },
      {
        id: "r6",
        name: "Elevator Shaft & Vault",
        type: "lift",
        x: 560,
        y: 245,
        w: 180,
        h: 90,
        occupancy: 0,
        risk: "SAFE",
        equipment: ["Auto Recall Controller"],
        distStaircase: "8 m",
        distLift: "0 m",
        distExit: "12 m",
      },
      {
        id: "r7",
        name: "Electrical Control Panel",
        type: "electrical",
        x: 560,
        y: 350,
        w: 180,
        h: 90,
        occupancy: 1,
        risk: "HIGH",
        equipment: ["CO2 Gas Suppressor"],
        distStaircase: "14 m",
        distLift: "10 m",
        distExit: "15 m",
      },
    ],
  };
}

interface FloorPlan2DViewerProps {
  uploadedFile?: {
    name: string;
    type: string;
    url: string | null;
  } | null;
  buildingName?: string;
  floorLevel?: number;
}

export function FloorPlan2DViewer({
  uploadedFile,
  buildingName = "HQ Main Building",
  floorLevel = 1,
}: FloorPlan2DViewerProps) {
  const [hoveredRoom, setHoveredRoom] = useState<RoomData | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  
  // Dynamic Floor Data
  const { rooms, fireOrigin } = React.useMemo(() => getRoomsForFloor(floorLevel), [floorLevel]);

  // Layer Toggles
  const [showBlueprintGrid, setShowBlueprintGrid] = useState(true);
  const [showExitPaths, setShowExitPaths] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [showSensors, setShowSensors] = useState(true);
  const [imageOpacity, setImageOpacity] = useState(65);

  const activeRoom = hoveredRoom || selectedRoom;

  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl bg-[#090d16] border border-border/80 overflow-hidden shadow-2xl">
      {/* 1. TOP CAD TOOLBAR & LAYER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-border/60 backdrop-blur-md gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Compass className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-foreground flex items-center gap-2">
              Architectural 2D Blueprint Engine
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                v3.2 Vector CAD
              </span>
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {buildingName} · Level {floorLevel} Floor Plan
            </p>
          </div>
        </div>

        {/* View Toggles & Sliders */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {uploadedFile?.url && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-border text-[10px]">
              <Sliders className="h-3 w-3 text-cyan-400" />
              <span>Image Opacity:</span>
              <input
                type="range"
                min="10"
                max="100"
                value={imageOpacity}
                onChange={(e) => setImageOpacity(Number(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="font-mono text-cyan-400">{imageOpacity}%</span>
            </div>
          )}

          <button
            onClick={() => setShowExitPaths(!showExitPaths)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border ${
              showExitPaths
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                : "bg-slate-800 text-slate-400 border-border"
            }`}
          >
            <Navigation className="h-3 w-3" /> Egress Paths
          </button>

          <button
            onClick={() => setShowHazards(!showHazards)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border ${
              showHazards
                ? "bg-rose-500/15 text-rose-400 border-rose-500/40"
                : "bg-slate-800 text-slate-400 border-border"
            }`}
          >
            <Flame className="h-3 w-3" /> Fire Hazards
          </button>

          <button
            onClick={() => setShowBlueprintGrid(!showBlueprintGrid)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border ${
              showBlueprintGrid
                ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                : "bg-slate-800 text-slate-400 border-border"
            }`}
          >
            <Layers className="h-3 w-3" /> CAD Grid
          </button>
        </div>
      </div>

      {/* 2. MAIN CANVAS VIEWPORT */}
      <div className="relative flex-1 min-h-[460px] bg-[#090d16] flex items-center justify-center p-2 overflow-hidden select-none">
        {/* Optional Uploaded CAD Image Overlay in background */}
        {uploadedFile?.url && (
          <div
            className="absolute inset-0 flex items-center justify-center p-6 z-0 pointer-events-none transition-opacity duration-300"
            style={{ opacity: imageOpacity / 100 }}
          >
            {uploadedFile.type === "PDF" ? (
              <iframe
                src={uploadedFile.url}
                className="w-full h-full border-0 pointer-events-none"
                title="CAD Background"
              />
            ) : (
              <img
                src={uploadedFile.url}
                alt={uploadedFile.name}
                className="max-w-full max-h-full object-contain filter contrast-125"
              />
            )}
          </div>
        )}

        {/* High-Precision Interactive Vector CAD SVG */}
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full relative z-10 max-h-[500px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Fine Technical Blueprint Grid Pattern */}
            <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="0.8" />
            </pattern>

            {/* Fire Location Thermal Radial Gradient */}
            <radialGradient id="fireHeatGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="40%" stopColor="#f97316" stopOpacity="0.4" />
              <stop offset="80%" stopColor="#ef4444" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            {/* Stairwell Step Hatch Pattern */}
            <pattern id="stairHatch" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 0 5 L 10 5" stroke="#475569" strokeWidth="1" />
            </pattern>

            {/* Exit Arrow Flow Animation */}
            <style>
              {`
                @keyframes flowDash {
                  from { stroke-dashoffset: 40; }
                  to { stroke-dashoffset: 0; }
                }
                @keyframes pulseAura {
                  0% { r: 18px; opacity: 0.8; }
                  50% { r: 34px; opacity: 0.3; }
                  100% { r: 18px; opacity: 0.8; }
                }
                .flowing-path {
                  animation: flowDash 1.2s linear infinite;
                }
                .pulse-halo {
                  animation: pulseAura 2s infinite ease-in-out;
                }
              `}
            </style>
          </defs>

          {/* Background Blueprint Grid Layer */}
          {showBlueprintGrid && <rect width="800" height="500" fill="url(#cadGrid)" opacity="0.6" />}

          {/* Outer Perimeter Dimension Lines */}
          <g stroke="#475569" strokeWidth="1" opacity="0.5">
            {/* Top dimension */}
            <line x1="50" y1="25" x2="750" y2="25" />
            <line x1="50" y1="20" x2="50" y2="30" />
            <line x1="750" y1="20" x2="750" y2="30" />
            <text x="400" y="20" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
              45.00 m (Perimeter Length)
            </text>

            {/* Left dimension */}
            <line x1="25" y1="40" x2="25" y2="460" />
            <line x1="20" y1="40" x2="30" y2="40" />
            <line x1="20" y1="460" x2="30" y2="460" />
            <text
              x="18"
              y="250"
              fill="#94a3b8"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
              transform="rotate(-90 18 250)"
            >
              28.50 m
            </text>
          </g>

          {/* MAIN EXTERIOR BOUNDARY WALL (Thick Architectural Double Wall) */}
          <rect
            x="48"
            y="38"
            width="704"
            height="424"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            rx="10"
          />
          <rect
            x="50"
            y="40"
            width="700"
            height="420"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            rx="8"
            opacity="0.9"
          />

          {/* ROOM BLOCKS & INTERIOR WALLS */}
          {rooms.map((room) => {
            const isHovered = hoveredRoom?.id === room.id;
            const isSelected = selectedRoom?.id === room.id;

            let fillOpacity = 0.15;
            let strokeColor = "#334155";
            let strokeW = 1.5;

            if (room.risk === "CRITICAL") {
              fillOpacity = 0.25;
              strokeColor = "#ef4444";
            } else if (room.risk === "HIGH") {
              fillOpacity = 0.2;
              strokeColor = "#f97316";
            }

            if (isHovered || isSelected) {
              fillOpacity = 0.4;
              strokeColor = "#38bdf8";
              strokeW = 3;
            }

            return (
              <g
                key={room.id}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredRoom(room)}
                onMouseLeave={() => setHoveredRoom(null)}
                onClick={() => setSelectedRoom(room)}
              >
                {/* Room Floor Plate Tile */}
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.w}
                  height={room.h}
                  fill={
                    room.risk === "CRITICAL"
                      ? "#ef4444"
                      : room.risk === "HIGH"
                      ? "#f97316"
                      : room.type === "server"
                      ? "#1e1b4b"
                      : room.type === "stairwell"
                      ? "#064e3b"
                      : "#0f172a"
                  }
                  fillOpacity={fillOpacity}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  rx="4"
                />

                {/* Stairwell Tread Steps Texture */}
                {room.type === "stairwell" && (
                  <rect
                    x={room.x + 10}
                    y={room.y + 10}
                    width={room.w - 20}
                    height={room.h - 20}
                    fill="url(#stairHatch)"
                    opacity="0.3"
                  />
                )}

                {/* Room Label & Icon */}
                <text
                  x={room.x + room.w / 2}
                  y={room.y + room.h / 2 - 4}
                  fill={isHovered ? "#38bdf8" : "#e2e8f0"}
                  fontSize="12"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {room.name}
                </text>

                {/* Occupancy & Type Tag */}
                <text
                  x={room.x + room.w / 2}
                  y={room.y + room.h / 2 + 14}
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {room.occupancy > 0 ? `👥 ${room.occupancy} Pax` : "Unoccupied"} · {room.distStaircase} to Stairs
                </text>

                {/* Door Arc Symbol Indicators */}
                <path
                  d={`M ${room.x + room.w / 2 - 12} ${room.y + room.h} A 12 12 0 0 1 ${room.x + room.w / 2 + 12} ${room.y + room.h}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity="0.8"
                />
              </g>
            );
          })}

          {/* FIRE HAZARD & HEAT MAP PULSE */}
          {showHazards && fireOrigin && (
            <g transform={`translate(${fireOrigin.x}, ${fireOrigin.y})`}>
              {/* Thermal Heat Circle */}
              <circle cx="0" cy="0" r="75" fill="url(#fireHeatGradient)" />
              
              {/* Pulsing Outer Halo */}
              <circle cx="0" cy="0" r="28" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="2" className="pulse-halo" />
              
              {/* Core Flame Marker */}
              <circle cx="0" cy="0" r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              <text x="0" y="4.5" fill="#ffffff" fontSize="12" textAnchor="middle">
                🔥
              </text>

              {/* Fire Callout Banner */}
              <g transform="translate(0, -32)">
                <rect x="-65" y="-12" width="130" height="20" rx="4" fill="#991b1b" stroke="#ef4444" strokeWidth="1" />
                <text x="0" y="2" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                  {fireOrigin.label}
                </text>
              </g>
            </g>
          )}

          {/* DYNAMIC EGRESS EVACUATION PATHS (Animated Dashed Green Flow Arrows) */}
          {showExitPaths && (
            <g>
              {/* Path 1: Central Lobby -> Direct Exit Door (Bottom) */}
              <path
                d="M 420 280 L 420 460"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="8 6"
                className="flowing-path"
              />
              <polygon points="420,460 412,444 428,444" fill="#10b981" />

              {/* Path 2: Executive Office -> Pressurized Stairwell A (East Exit) */}
              <path
                d="M 420 140 L 650 140 L 650 50"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="8 6"
                className="flowing-path"
              />
              <polygon points="650,50 642,66 658,66" fill="#10b981" />

              {/* Path 3: Conference Room -> Central Corridor Bypass */}
              <path
                d="M 170 340 L 295 340 L 420 340"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeDasharray="6 4"
                className="flowing-path"
              />
            </g>
          )}

          {/* ARCHITECTURAL EXITS & STAIRWELL DOORWAYS */}
          {/* Main Direct Exit Door (Bottom Center) */}
          <g transform="translate(420, 460)">
            <rect x="-35" y="-6" width="70" height="12" rx="3" fill="#065f46" stroke="#10b981" strokeWidth="2" />
            <text x="0" y="3" fill="#10b981" fontSize="10" fontWeight="900" textAnchor="middle">
              🚪 DIRECT EXIT
            </text>
          </g>

          {/* Emergency Exit Door (Top Right Stairwell) */}
          <g transform="translate(650, 40)">
            <rect x="-40" y="-6" width="80" height="12" rx="3" fill="#065f46" stroke="#10b981" strokeWidth="2" />
            <text x="0" y="3" fill="#10b981" fontSize="10" fontWeight="900" textAnchor="middle">
              🏃 EMERGENCY EXIT
            </text>
          </g>

          {/* COMPASS ROSE & CAD HUD OVERLAYS (Top Right) */}
          <g transform="translate(720, 80)">
            <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#334155" strokeWidth="1.5" opacity="0.9" />
            <line x1="0" y1="-14" x2="0" y2="14" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="-14" y1="0" x2="14" y2="0" stroke="#475569" strokeWidth="1" />
            <polygon points="0,-18 -4,-10 4,-10" fill="#38bdf8" />
            <text x="0" y="-22" fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle">
              N
            </text>
          </g>

          {/* SCALE RULER (Bottom Right) */}
          <g transform="translate(620, 435)">
            <rect x="-10" y="-12" width="120" height="24" rx="4" fill="#0f172a" stroke="#334155" opacity="0.9" />
            <line x1="0" y1="0" x2="100" y2="0" stroke="#94a3b8" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#94a3b8" strokeWidth="2" />
            <line x1="50" y1="-4" x2="50" y2="4" stroke="#94a3b8" strokeWidth="2" />
            <line x1="100" y1="-4" x2="100" y2="4" stroke="#94a3b8" strokeWidth="2" />
            <text x="0" y="10" fill="#94a3b8" fontSize="8" textAnchor="middle">0m</text>
            <text x="50" y="10" fill="#94a3b8" fontSize="8" textAnchor="middle">10m</text>
            <text x="100" y="10" fill="#94a3b8" fontSize="8" textAnchor="middle">20m</text>
          </g>
        </svg>

        {/* 3. FLOAT-OVER INSPECTION HUD TOOLTIP */}
        <AnimatePresence>
          {activeRoom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-4 left-4 z-30 w-72 rounded-2xl border border-cyan-500/40 bg-slate-900/90 backdrop-blur-xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {activeRoom.type === "server" ? (
                      <Cpu className="h-4 w-4" />
                    ) : activeRoom.type === "stairwell" ? (
                      <Landmark className="h-4 w-4" />
                    ) : activeRoom.type === "electrical" ? (
                      <Zap className="h-4 w-4" />
                    ) : (
                      <DoorOpen className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-foreground">{activeRoom.name}</h4>
                    <p className="text-[9px] text-muted-foreground uppercase font-mono">
                      ID: {activeRoom.id} · Type: {activeRoom.type}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                    activeRoom.risk === "CRITICAL"
                      ? "text-rose-400 bg-rose-500/20 border-rose-500/40"
                      : activeRoom.risk === "HIGH"
                      ? "text-orange-400 bg-orange-500/20 border-orange-500/40"
                      : "text-emerald-400 bg-emerald-500/20 border-emerald-500/40"
                  }`}
                >
                  {activeRoom.risk}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-border/50 flex flex-col justify-center">
                  <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Users className="h-3 w-3 text-blue-400" /> Occupancy
                  </span>
                  <span className="font-extrabold text-foreground font-mono mt-0.5">
                    {activeRoom.occupancy} Persons
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/70 border border-border/50 flex flex-col justify-center">
                  <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Landmark className="h-3 w-3 text-orange-400" /> Staircase Dist
                  </span>
                  <span className="font-extrabold text-foreground font-mono mt-0.5">
                    {activeRoom.distStaircase}
                  </span>
                </div>
              </div>

              {/* Equipment list */}
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Safety Equipment Installed
                </span>
                <div className="flex flex-wrap gap-1">
                  {activeRoom.equipment.map((eq, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      ✓ {eq}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM HUD FOOTER STATUS */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-border/60 text-[10px] font-mono text-muted-foreground shadow-lg">
          <span className="flex items-center gap-1 text-cyan-400 font-bold">
            <Eye className="h-3.5 w-3.5" /> 2D Vector CAD Active
          </span>
          <span>·</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <ShieldCheck className="h-3.5 w-3.5" /> Egress Routes Highlighted
          </span>
          <span>·</span>
          <span>Hover / Click room to inspect details</span>
        </div>
      </div>
    </div>
  );
}
