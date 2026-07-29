export type RiskLevelType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FloorRisk {
  floorRisk: RiskLevelType;
  occupancyRisk: RiskLevelType;
  individualRisk: RiskLevelType;
  overallFireRisk: RiskLevelType;
}

export type CADElementType = "DOOR" | "WINDOW" | "STAIRCASE" | "LIFT" | "EXIT";

export interface CADElement {
  id: string;
  type: CADElementType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PathNode {
  x: number;
  y: number;
}

export interface RoomBoundary {
  id: string;
  name: string;
  x: number; // percentage 0-100 in the SVG coordinate space
  y: number;
  w: number;
  h: number;
  distanceToStaircase?: number; // metres
  distanceToLift?: number; // metres
  distanceToEmergencyExit?: number; // metres
  safePath?: PathNode[];
  alternatePath?: PathNode[];
}

export interface FloorStatistics {
  rooms?: number;
  directExits: number;
  emergencyExits: number;
  doors: number;
  windows: number;
  distanceToStaircase: string; // e.g. "12 m"
  distanceToLift: string; // e.g. "25 m"
  staircases: number;
  lifts: number;
  maxOccupancy?: number;
  currentOccupancy?: number;
  // CAD-extracted room data
  roomNames?: string[];
  roomBoundaries?: RoomBoundary[];
  cadElements?: CADElement[];
}

export interface FloorVulnerability {
  overallVulnerability: number; // Percentage 0-100
  fireRisk: number; // 0-100
  occupancyRisk: number; // 0-100
  evacuationDifficulty: number; // 0-100
  safetyIndex: number; // 0-100
  riskCategory: RiskLevelType;
  // 8-factor breakdown
  exitScore?: number;
  doorScore?: number;
  windowScore?: number;
  occupancyScore?: number;
  staircaseDistScore?: number;
  liftDistScore?: number;
  fireEquipmentScore?: number;
  escapeRouteScore?: number;
}

export interface FloorDetails {
  floorName: string;
  floorArea: number; // in sq.m
  maxOccupancy: number;
  currentOccupancy: number;
  riskLevel: RiskLevelType;
  revisionNumber: string;
  uploadDate: string; // ISO string or format
}

export interface CADDrawing {
  name: string;
  url: string; // URL, objectURL or Base64 DataURL
  type: "pdf" | "dwg" | "dxf" | "png" | "jpg" | "jpeg";
  size?: number; // in bytes
  uploadDate?: string; // ISO date string
  uploadedBy?: string; // User or system identifier
}

export interface FloorData {
  id?: string;
  buildingId: string;
  level: number;
  name: string;
  details: FloorDetails;
  risks: FloorRisk;
  stats: FloorStatistics;
  vulnerability?: FloorVulnerability;
  drawing?: CADDrawing;
  aiAnalysis?: any;
}
