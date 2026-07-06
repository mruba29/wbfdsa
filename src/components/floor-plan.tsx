import type { Floor, Zone } from "@/lib/db";
import { RISK_COLORS, type RiskLevel } from "@/lib/vulnerability";
import { DoorOpen, DoorClosed } from "lucide-react";
import { useState } from "react";
import type { CADElement, RoomBoundary } from "@/types/floor";

interface FloorPlanProps {
  floor: Floor;
  zones: Zone[];
  zoneRisks?: Record<number, RiskLevel>;
  onZoneClick?: (zone: Zone) => void;
  selectedZoneId?: number | null;
  showExits?: boolean;
  transparentBackground?: boolean;
  cadElements?: CADElement[];
  roomBoundaries?: RoomBoundary[];
  simulationTime?: number;
}

export function FloorPlan({
  floor,
  zones,
  zoneRisks,
  onZoneClick,
  selectedZoneId,
  showExits = true,
  transparentBackground = false,
  cadElements = [],
  roomBoundaries = [],
  simulationTime = 0,
}: FloorPlanProps) {
  const [hoveredZoneId, setHoveredZoneId] = useState<number | null>(null);

  const exits = Array.from({ length: floor.totalExits }).map((_, i) => ({
    idx: i,
    blocked: i < floor.blockedExits,
    pos: [
      { x: 2, y: 50 },
      { x: 98, y: 50 },
      { x: 50, y: 2 },
      { x: 50, y: 98 },
    ][i % 4],
  }));

  const renderPath = (room: RoomBoundary) => {
    // If simulation time > 60, safePath is blocked, use alternate
    const isAlternate = simulationTime > 60;
    const path = isAlternate ? room.alternatePath : room.safePath;
    if (!path || path.length < 2) return null;
    
    const pointsStr = path.map(p => `${p.x},${p.y}`).join(" ");
    const color = isAlternate ? "var(--risk-yellow)" : "var(--risk-green)";

    return (
      <polyline
        key={`path-${room.id}`}
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeDasharray="2 1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: "dash 20s linear infinite" }}
      />
    );
  };

  const activeZoneId = hoveredZoneId || selectedZoneId;
  const activeRoom = roomBoundaries.find((r) => r.name === zones.find((z) => z.id === activeZoneId)?.name) 
    || roomBoundaries.find((r, i) => activeZoneId === i + 1); // fallback mapping

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-border ${transparentBackground ? "bg-transparent" : "bg-secondary"}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="block w-full h-auto relative z-10"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id={`grid-${floor.id}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M 5 0 L 0 0 0 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.15"
              className="text-border"
            />
          </pattern>
          <style>
            {`
              @keyframes dash {
                to { stroke-dashoffset: -100; }
              }
            `}
          </style>
        </defs>
        {!transparentBackground && (
          <rect width="100" height="100" fill={`url(#grid-${floor.id})`} />
        )}
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border"
        />

        {zones.map((z, i) => {
          const risk: RiskLevel = zoneRisks?.[z.id!] ?? "SAFE";
          const fill = RISK_COLORS[risk];
          const selected = selectedZoneId === z.id;
          const hovered = hoveredZoneId === z.id;
          
          return (
            <g
              key={z.id}
              onClick={() => onZoneClick?.(z)}
              onMouseEnter={() => setHoveredZoneId(z.id!)}
              onMouseLeave={() => setHoveredZoneId(null)}
              className={onZoneClick ? "cursor-pointer" : ""}
            >
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                fill={fill}
                fillOpacity={
                  risk === "SAFE"
                    ? transparentBackground
                      ? 0.05
                      : 0.18
                    : transparentBackground
                      ? 0.35
                      : 0.55
                }
                stroke={selected || hovered ? "white" : fill}
                strokeWidth={selected || hovered ? 0.7 : transparentBackground ? 0.5 : 0.3}
              />
              <text
                x={z.x + 1.5}
                y={z.y + 4}
                fontSize="2.4"
                fill="white"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {z.zoneId}
              </text>
              <text
                x={z.x + 1.5}
                y={z.y + 7}
                fontSize="2"
                fill="white"
                fillOpacity="0.85"
                style={{ pointerEvents: "none", display: transparentBackground ? "none" : "block" }}
              >
                {z.name} · {z.occupancy} pax
              </text>
            </g>
          );
        })}

        {/* CAD Elements Overlay */}
        {cadElements.map((el) => {
          let fill = "transparent";
          let stroke = "none";
          let strokeWidth = 0.5;
          let content = null;

          switch (el.type) {
            case "DOOR":
              fill = "#3b82f6"; // blue
              break;
            case "WINDOW":
              fill = "#06b6d4"; // cyan
              break;
            case "STAIRCASE":
              fill = "#f97316"; // orange
              stroke = "white";
              strokeWidth = 0.3;
              content = (
                <text x={el.x + el.w/2} y={el.y + el.h/2 + 1} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">S</text>
              );
              break;
            case "LIFT":
              fill = "#a855f7"; // purple
              stroke = "white";
              strokeWidth = 0.3;
              content = (
                <text x={el.x + el.w/2} y={el.y + el.h/2 + 1} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">L</text>
              );
              break;
            case "EXIT":
              fill = "#22c55e"; // green
              break;
          }

          return (
            <g key={el.id} style={{ pointerEvents: "none" }}>
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={el.type === 'DOOR' || el.type === 'WINDOW' ? 0.5 : 1} fillOpacity={0.8} />
              {content}
            </g>
          );
        })}

        {/* Active Evacuation Path */}
        {activeRoom && renderPath(activeRoom)}

        {showExits &&
          exits.map((e) => (
            <g key={e.idx} transform={`translate(${e.pos.x - 2.5}, ${e.pos.y - 2.5})`}>
              <rect
                width="5"
                height="5"
                rx="1"
                fill={e.blocked ? "var(--risk-red)" : "var(--risk-green)"}
              />
            </g>
          ))}
      </svg>
      {showExits && (
        <div className="absolute bottom-2 right-2 flex gap-3 rounded-md bg-card/80 border border-border px-3 py-1.5 text-[10px] backdrop-blur z-20">
          <span className="flex items-center gap-1">
            <DoorOpen className="h-3 w-3 text-risk-green" /> {floor.availableExits} open
          </span>
          <span className="flex items-center gap-1">
            <DoorClosed className="h-3 w-3 text-risk-red" /> {floor.blockedExits} blocked
          </span>
        </div>
      )}

      {/* Hover Information Tooltip */}
      {activeRoom && (
        <div className="absolute top-2 left-2 flex flex-col gap-1 rounded-md bg-card/90 border border-border px-3 py-2 text-[10px] backdrop-blur z-20 shadow-sm pointer-events-none">
          <h4 className="font-bold text-xs uppercase text-foreground mb-1">{activeRoom.name}</h4>
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Nearest Exit:</span>
            <span className="font-mono text-risk-green">{activeRoom.distanceToEmergencyExit ?? 10}m</span>
          </span>
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Nearest Stairs:</span>
            <span className="font-mono text-orange-500">{activeRoom.distanceToStaircase ?? 15}m</span>
          </span>
          <span className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Nearest Lift:</span>
            <span className="font-mono text-purple-500">{activeRoom.distanceToLift ?? 20}m</span>
          </span>
        </div>
      )}
    </div>
  );
}
