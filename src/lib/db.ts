import Dexie, { type Table } from "dexie";

export type BuildingType =
  | "Hotel"
  | "Hospital"
  | "Shopping Mall"
  | "Office"
  | "School"
  | "University"
  | "Data Center"
  | "Mixed Use"
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Public Facility";

export type AssessmentStatus = "draft" | "submitted";

export interface Building {
  id?: number;
  buildingId?: string;
  name: string;
  ownerName?: string;
  type: BuildingType | string;
  functionalCategory?: string;
  occupancyType?: string;
  floors: number;
  buildingHeight?: number;
  totalArea: number;
  yearOfConstruction?: number;
  contactNumber?: string;
  email?: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  constructionType: string;
  fireResistanceRating: string;
  // Structural details
  numberOfLifts?: number;
  numberOfStaircases?: number;
  numberOfWindows?: number;
  adjacentBuildingDistance?: number;
  peoplePerFloor?: number;
  // Assessment info
  assessmentDate?: string;
  assessorName?: string;
  remarks?: string;
  status?: AssessmentStatus;
  // CAD files stored as names (actual files in browser storage)
  cadFiles?: string[];
  cadFileCategories?: Record<string, string>;
  createdAt: number;
}

export interface Floor {
  id?: number;
  buildingId: number;
  level: number;
  name: string;
  totalExits: number;
  availableExits: number;
  blockedExits: number;
  elevatorWorking: boolean;
}

export type ZoneType =
  | "Lobby"
  | "Office"
  | "Corridor"
  | "Conference"
  | "Storage"
  | "Server"
  | "Patient"
  | "Retail"
  | "Classroom";

export interface Zone {
  id?: number;
  buildingId: number;
  floorId: number;
  zoneId: string;
  name: string;
  type: ZoneType;
  area: number;
  occupancy: number;
  specialNeeds: number;
  // Rect on the floor SVG (0-100 coordinate space)
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SpecialNeedCategory =
  | "None"
  | "Pregnant Woman"
  | "Elderly"
  | "Child"
  | "Toddler"
  | "Wheelchair User"
  | "Walking Stick User"
  | "Vision Impaired"
  | "Hearing Impaired"
  | "Temporary Injury"
  | "ICU Patient"
  | "Critical Patient"
  | "Oxygen Support";

export type IVARiskClass = "Low" | "Medium" | "High" | "Critical";

export interface Personnel {
  id?: number;
  employeeId: string;
  name: string;
  age: number;
  gender: "M" | "F" | "Other";
  department: string;
  /** Floor level number this person is assigned to (1 = Ground Floor) */
  assignedFloor: number;
  cardId: string;
  deviceId: string;
  /** Legacy field — kept for backwards compat */
  specialNeeds: boolean;
  emergencyContact: string;
  /** 1.00 = Perfectly fit … 0.00 = Completely immobile */
  disabilityFactor: number;
  specialNeedCategory: SpecialNeedCategory;
  /** Calculated by computeIndividualVulnerability() */
  individualVulnerabilityScore: number;
  individualRiskClass: IVARiskClass;
  /** Lower number = higher priority (1 = evacuate first) */
  evacuationPriority: number;
}

export interface Incident {
  id?: number;
  incidentId: string;
  buildingId: number;
  floorId: number;
  zoneId: number;
  sensorId: string;
  startedAt: number;
  resolvedAt?: number;
  status: "active" | "resolved";
}

export interface OccupancyEvent {
  id?: number;
  zoneId: number;
  date: string;
  startTime: string;
  endTime: string;
  expectedOccupancy: number;
  label: string;
}

export interface ActivityLog {
  id?: number;
  timestamp: number;
  kind: "incident" | "occupancy" | "building" | "system";
  message: string;
}

export interface FireInventory {
  id?: number;
  inventoryId: string;
  equipmentName: string;
  equipmentType: string;
  building: string;
  floor: string;
  zoneRoom: string;
  quantity: number;
  installationDate: string;
  lastInspectionDate: string;
  expiryDate: string;
  maintenanceDueDate: string;
  status: "Active" | "Expired" | "Under Maintenance";
  assignedMaintenanceTeam: string;
  remarks: string;
}

class FDVADatabase extends Dexie {
  buildings!: Table<Building, number>;
  floors!: Table<Floor, number>;
  zones!: Table<Zone, number>;
  personnel!: Table<Personnel, number>;
  incidents!: Table<Incident, number>;
  occupancy!: Table<OccupancyEvent, number>;
  activity!: Table<ActivityLog, number>;
  fireInventory!: Table<FireInventory, number>;

  constructor() {
    super("fdva-db");
    // Version 2 — original schema
    this.version(2).stores({
      buildings: "++id, name, type, status",
      floors: "++id, buildingId, level",
      zones: "++id, buildingId, floorId, zoneId",
      personnel: "++id, employeeId, department",
      incidents: "++id, incidentId, buildingId, status, startedAt",
      occupancy: "++id, zoneId, date",
      activity: "++id, timestamp, kind",
    });
    // Version 3 — IVA fields added to personnel
    this.version(3)
      .stores({
        buildings: "++id, name, type, status",
        floors: "++id, buildingId, level",
        zones: "++id, buildingId, floorId, zoneId",
        personnel:
          "++id, employeeId, department, assignedFloor, specialNeedCategory, evacuationPriority",
        incidents: "++id, incidentId, buildingId, status, startedAt",
        occupancy: "++id, zoneId, date",
        activity: "++id, timestamp, kind",
      })
      .upgrade((tx) => {
        // Backfill existing personnel rows with IVA defaults
        return tx
          .table("personnel")
          .toCollection()
          .modify((p: any) => {
            if (p.assignedFloor === undefined) p.assignedFloor = 1;
            if (p.disabilityFactor === undefined) p.disabilityFactor = 1.0;
            if (p.specialNeedCategory === undefined)
              p.specialNeedCategory = p.specialNeeds ? "None" : "None";
            if (p.individualVulnerabilityScore === undefined) p.individualVulnerabilityScore = 0;
            if (p.individualRiskClass === undefined) p.individualRiskClass = "Low";
            if (p.evacuationPriority === undefined) p.evacuationPriority = 7;
          });
      });
    
    // Version 4 - Fire Inventory added
    this.version(4).stores({
      buildings: "++id, name, type, status",
      floors: "++id, buildingId, level",
      zones: "++id, buildingId, floorId, zoneId",
      personnel:
        "++id, employeeId, department, assignedFloor, specialNeedCategory, evacuationPriority",
      incidents: "++id, incidentId, buildingId, status, startedAt",
      occupancy: "++id, zoneId, date",
      activity: "++id, timestamp, kind",
      fireInventory: "++id, inventoryId, equipmentName, equipmentType, building, floor, zoneRoom, status, expiryDate, maintenanceDueDate",
    });
  }
}

export const db = new FDVADatabase();

export async function logActivity(kind: ActivityLog["kind"], message: string) {
  await db.activity.add({ kind, message, timestamp: Date.now() });
}
