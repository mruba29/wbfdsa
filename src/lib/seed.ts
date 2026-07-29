import { db, type BuildingType, type ZoneType, type SpecialNeedCategory, logActivity } from "./db";
import { computeIndividualVulnerability } from "./vulnerability";
import { syncFullDatabase } from "@/services/dbSync";

const buildingSeeds: Array<{
  name: string;
  type: BuildingType;
  address: string;
  floors: number;
  totalArea: number;
  constructionType: string;
  fireResistanceRating: string;
}> = [
  {
    name: "Meridian Grand Hotel",
    type: "Hotel",
    address: "120 Harbor Ave, District 4",
    floors: 6,
    totalArea: 18400,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "2-hour",
  },
  {
    name: "Saint Clare Medical Center",
    type: "Hospital",
    address: "88 Wellness Blvd",
    floors: 5,
    totalArea: 24500,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "3-hour",
  },
  {
    name: "Crestline Galleria",
    type: "Shopping Mall",
    address: "501 Market Square",
    floors: 3,
    totalArea: 32000,
    constructionType: "Type II — Steel",
    fireResistanceRating: "1-hour",
  },
  {
    name: "Apex Tower",
    type: "Office",
    address: "1 Apex Plaza",
    floors: 4,
    totalArea: 14200,
    constructionType: "Type I — Non-combustible",
    fireResistanceRating: "2-hour",
  },
  {
    name: "Northbridge University Hall",
    type: "University",
    address: "245 Campus Way",
    floors: 2,
    totalArea: 9800,
    constructionType: "Type III — Masonry",
    fireResistanceRating: "1-hour",
  },
];

const zoneTypes: ZoneType[] = ["Lobby", "Office", "Corridor", "Conference", "Storage"];
const hospitalZones: ZoneType[] = ["Patient", "Office", "Corridor", "Storage"];
const mallZones: ZoneType[] = ["Retail", "Corridor", "Storage"];

function zonesForBuilding(type: BuildingType): ZoneType[] {
  if (type === "Hospital") return hospitalZones;
  if (type === "Shopping Mall") return mallZones;
  return zoneTypes;
}

// Layout zones on a 100x100 grid as a 2x3 mosaic
const zoneRects = [
  { x: 4, y: 6, w: 44, h: 38 },
  { x: 52, y: 6, w: 44, h: 38 },
  { x: 4, y: 48, w: 28, h: 46 },
  { x: 36, y: 48, w: 28, h: 46 },
  { x: 68, y: 48, w: 28, h: 46 },
];

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN NAMES
// ─────────────────────────────────────────────────────────────────────────────
const indianFirstNames = [
  "Aaditya",
  "Abhinav",
  "Abhishek",
  "Aishwarya",
  "Ajay",
  "Akash",
  "Amitabh",
  "Ananya",
  "Anil",
  "Anita",
  "Anjali",
  "Ankit",
  "Anurag",
  "Arjun",
  "Aruna",
  "Aryan",
  "Ashok",
  "Bhavna",
  "Chetan",
  "Deepak",
  "Deepika",
  "Dhruv",
  "Divya",
  "Ekta",
  "Farida",
  "Gaurav",
  "Geeta",
  "Harsh",
  "Isha",
  "Jaya",
  "Karan",
  "Kavita",
  "Kirti",
  "Krishnamurthy",
  "Kunal",
  "Lakshmi",
  "Mahesh",
  "Manish",
  "Meera",
  "Mohan",
  "Nandini",
  "Neha",
  "Nikhil",
  "Nisha",
  "Pankaj",
  "Pooja",
  "Pradeep",
  "Prakash",
  "Prathyusha",
  "Priya",
  "Rahul",
  "Rajesh",
  "Ramesh",
  "Ravi",
  "Rekha",
  "Ritesh",
  "Rohit",
  "Rupal",
  "Sachin",
  "Sanjay",
  "Sanya",
  "Sarika",
  "Seema",
  "Shikha",
  "Shivam",
  "Shruti",
  "Sneha",
  "Srinivasan",
  "Suhas",
  "Sumedha",
  "Sunita",
  "Suresh",
  "Swati",
  "Tanvi",
  "Tarun",
  "Uday",
  "Uma",
  "Vandana",
  "Varun",
  "Venkatesh",
  "Vijay",
  "Vimal",
  "Vinay",
  "Vishal",
  "Vivek",
  "Yamini",
  "Yash",
  "Zara",
];
const indianLastNames = [
  "Agarwal",
  "Banerjee",
  "Bose",
  "Chakraborty",
  "Chandra",
  "Chatterjee",
  "Deshpande",
  "Dubey",
  "Garg",
  "Ghosh",
  "Gupta",
  "Iyer",
  "Jain",
  "Joshi",
  "Kapoor",
  "Kaur",
  "Khanna",
  "Kumar",
  "Mahajan",
  "Mehta",
  "Mishra",
  "Mukherjee",
  "Nair",
  "Pandey",
  "Patel",
  "Pillai",
  "Prasad",
  "Rao",
  "Reddy",
  "Saxena",
  "Sharma",
  "Shukla",
  "Singh",
  "Sinha",
  "Srivastava",
  "Subramaniam",
  "Thakur",
  "Tiwari",
  "Tripathi",
  "Varma",
  "Verma",
  "Yadav",
];
const departments = [
  "Operations",
  "Security",
  "Administration",
  "Engineering",
  "Housekeeping",
  "Medical",
  "IT",
  "Finance",
  "HR",
  "Facility Management",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

export async function seedIfEmpty() {
  // Always fetch latest data from Google Sheets when the app loads
  await syncFullDatabase();

  const buildingCount = await db.buildings.count();
  const personnelCount = await db.personnel.count();
  const inventoryCount = await db.fireInventory.count();
  const incidentsCount = await db.incidents.count();

  if (buildingCount === 0 || personnelCount === 0 || inventoryCount === 0 || incidentsCount === 0) {
    console.log("[WB-FDVA] One or more tables empty after sync attempt. Seeding all modules...");
    await seedAllModules();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRE INVENTORY SAMPLE DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const SAMPLE_FIRE_INVENTORY = [
  { inventoryId: "FE-CO2-001", equipmentName: "CO2 Fire Extinguisher (4.5kg)", equipmentType: "Fire Extinguisher", building: "Infosystem Campus Block A1", floor: "Ground Floor", zoneRoom: "Lobby 1", quantity: 5, installationDate: "2025-01-15", lastInspectionDate: "2026-06-10", expiryDate: "2027-01-15", maintenanceDueDate: "2026-12-10", status: "Active", assignedMaintenanceTeam: "Kolkata Fire Safety Squad", remarks: "Pressure gauge normal" },
  { inventoryId: "FE-DCP-002", equipmentName: "ABC Dry Chemical Powder (6kg)", equipmentType: "Fire Extinguisher", building: "Infosystem Campus Block B2", floor: "Floor 2", zoneRoom: "Office Area 2", quantity: 8, installationDate: "2024-11-20", lastInspectionDate: "2026-05-15", expiryDate: "2026-11-20", maintenanceDueDate: "2026-08-15", status: "Active", assignedMaintenanceTeam: "Bengaluru Tech Safety Ops", remarks: "Mounted near Exit Door B" },
  { inventoryId: "FE-SPR-003", equipmentName: "Automatic Sprinkler Valve Assembly", equipmentType: "Sprinkler", building: "Infosystem Campus Block C3", floor: "Floor 1", zoneRoom: "Server Room", quantity: 12, installationDate: "2024-03-10", lastInspectionDate: "2026-04-01", expiryDate: "2029-03-10", maintenanceDueDate: "2026-10-01", status: "Active", assignedMaintenanceTeam: "Hyderabad Protection Wing", remarks: "Inspected by Er. Rajesh Varma" },
  { inventoryId: "FE-FHR-004", equipmentName: "Heavy Duty Fire Hose Reel (30m)", equipmentType: "Hose Reel", building: "Infosystem Campus Block D4", floor: "Floor 3", zoneRoom: "Corridor 3", quantity: 4, installationDate: "2023-08-05", lastInspectionDate: "2026-01-20", expiryDate: "2028-08-05", maintenanceDueDate: "2026-07-20", status: "Under Maintenance", assignedMaintenanceTeam: "Pune Facility Care", remarks: "Nozzle replacement scheduled" },
  { inventoryId: "FE-FCP-005", equipmentName: "Main Fire Alarm Control Panel (FACP)", equipmentType: "Alarm System", building: "Infosystem Campus Block A1", floor: "Ground Floor", zoneRoom: "Security Control Room", quantity: 1, installationDate: "2025-02-01", lastInspectionDate: "2026-07-01", expiryDate: "2030-02-01", maintenanceDueDate: "2027-01-01", status: "Active", assignedMaintenanceTeam: "Kolkata Fire Safety Squad", remarks: "All zone relays functioning" },
  { inventoryId: "FE-SMK-006", equipmentName: "Photoelectric Smoke Detector Array", equipmentType: "Smoke Detector", building: "Infosystem Campus Block B2", floor: "Floor 3", zoneRoom: "Executive Conference", quantity: 24, installationDate: "2024-06-12", lastInspectionDate: "2026-03-15", expiryDate: "2026-06-12", maintenanceDueDate: "2026-06-01", status: "Expired", assignedMaintenanceTeam: "Mumbai Command Team", remarks: "Battery replacement required" },
  { inventoryId: "FE-EML-007", equipmentName: "Emergency Battery Backup Exit Light", equipmentType: "Emergency Light", building: "Infosystem Campus Block C3", floor: "Ground Floor", zoneRoom: "Stairwell A", quantity: 10, installationDate: "2024-09-01", lastInspectionDate: "2026-02-10", expiryDate: "2026-09-01", maintenanceDueDate: "2026-08-10", status: "Active", assignedMaintenanceTeam: "Noida Facility Wing", remarks: "LED array tested successfully" },
  { inventoryId: "FE-WTR-008", equipmentName: "Water Mist Suppression Cylinder", equipmentType: "Suppression System", building: "Infosystem Campus Block D4", floor: "Floor 2", zoneRoom: "Battery Backup Room", quantity: 6, installationDate: "2025-05-18", lastInspectionDate: "2026-06-25", expiryDate: "2028-05-18", maintenanceDueDate: "2026-12-25", status: "Active", assignedMaintenanceTeam: "Chennai Safety Engineers", remarks: "High pressure line verified" },
];

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS SAMPLE DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const SAMPLE_INCIDENTS = [
  { incidentId: "INC-892101", buildingId: 1, floorId: 1, zoneId: 1, sensorId: "SNS-101", startedAt: Date.now() - 3600000 * 2, status: "active" as const },
  { incidentId: "INC-892102", buildingId: 1, floorId: 2, zoneId: 4, sensorId: "SNS-204", startedAt: Date.now() - 3600000 * 5, status: "active" as const },
  { incidentId: "INC-892103", buildingId: 2, floorId: 4, zoneId: 10, sensorId: "SNS-312", startedAt: Date.now() - 3600000 * 12, status: "active" as const },
  { incidentId: "INC-892104", buildingId: 3, floorId: 7, zoneId: 19, sensorId: "SNS-405", startedAt: Date.now() - 3600000 * 24, resolvedAt: Date.now() - 3600000 * 18, status: "resolved" as const },
  { incidentId: "INC-892105", buildingId: 4, floorId: 10, zoneId: 28, sensorId: "SNS-518", startedAt: Date.now() - 3600000 * 48, resolvedAt: Date.now() - 3600000 * 36, status: "resolved" as const },
  { incidentId: "INC-892106", buildingId: 5, floorId: 13, zoneId: 37, sensorId: "SNS-602", startedAt: Date.now() - 3600000 * 1.5, status: "active" as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// OCCUPANCY SAMPLE DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const SAMPLE_OCCUPANCY_EVENTS = [
  { zoneId: 1, date: "2026-07-29", startTime: "09:00", endTime: "18:00", expectedOccupancy: 250, label: "General Office Hours Shift" },
  { zoneId: 2, date: "2026-07-29", startTime: "10:30", endTime: "12:00", expectedOccupancy: 120, label: "Quarterly Town Hall & All-Hands" },
  { zoneId: 3, date: "2026-07-29", startTime: "20:00", endTime: "06:00", expectedOccupancy: 45, label: "Night Shift Operations & Maintenance" },
  { zoneId: 4, date: "2026-07-30", startTime: "11:00", endTime: "13:00", expectedOccupancy: 300, label: "Fire Safety Evacuation Drill" },
  { zoneId: 5, date: "2026-07-29", startTime: "14:00", endTime: "17:00", expectedOccupancy: 80, label: "Medical Center OPD & Visitor Hours" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED ALL MODULES DYNAMICALLY
// ─────────────────────────────────────────────────────────────────────────────
export async function seedAllModules(): Promise<{
  buildings: number;
  floors: number;
  zones: number;
  personnel: number;
  incidents: number;
  occupancy: number;
  fireInventory: number;
}> {
  console.log("[WB-FDVA] Starting full multi-module data seeding...");

  // 1. Seed Buildings, Floors, Zones
  await seedInfosystemBuildings();
  const buildingsCount = await db.buildings.count();
  const floorsCount = await db.floors.count();
  const zonesCount = await db.zones.count();

  // 2. Seed Personnel
  await seedIndianPersonnel();
  const personnelCount = await db.personnel.count();

  // 3. Seed Fire Inventory
  const existingInv = await db.fireInventory.toArray();
  const existingInvIds = new Set(existingInv.map((i) => i.inventoryId));
  for (const inv of SAMPLE_FIRE_INVENTORY) {
    if (!existingInvIds.has(inv.inventoryId)) {
      await db.fireInventory.add(inv as any);
    }
  }
  const inventoryCount = await db.fireInventory.count();

  // 4. Seed Incidents
  const existingIncidents = await db.incidents.toArray();
  const existingIncIds = new Set(existingIncidents.map((i) => i.incidentId));
  for (const inc of SAMPLE_INCIDENTS) {
    if (!existingIncIds.has(inc.incidentId)) {
      await db.incidents.add(inc as any);
    }
  }
  const incidentsCount = await db.incidents.count();

  // 5. Seed Occupancy Events
  const existingOcc = await db.occupancy.toArray();
  if (existingOcc.length === 0) {
    for (const occ of SAMPLE_OCCUPANCY_EVENTS) {
      await db.occupancy.add(occ as any);
    }
  }
  const occupancyCount = await db.occupancy.count();

  await logActivity("system", "Completed comprehensive multi-module data seeding across all tables.");

  return {
    buildings: buildingsCount,
    floors: floorsCount,
    zones: zonesCount,
    personnel: personnelCount,
    incidents: incidentsCount,
    occupancy: occupancyCount,
    fireInventory: inventoryCount,
  };
}

interface City {
  name: string;
  lat: number;
  lng: number;
  count: number;
}

const CITIES: City[] = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, count: 4 },
  { name: "Pune", lat: 18.5204, lng: 73.8567, count: 3 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867, count: 3 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, count: 3 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, count: 3 },
  { name: "Noida", lat: 28.5355, lng: 77.391, count: 2 },
  { name: "Gurugram", lat: 28.4595, lng: 77.0266, count: 2 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, count: 2 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, count: 2 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873, count: 2 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673, count: 2 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558, count: 2 },
];

export async function seedInfosystemBuildings() {
  const allBuildings = await db.buildings.toArray();
  const count = allBuildings.filter((b) => b.ownerName === "Infosystem").length;
  if (count > 0) return; // already seeded

  const now = Date.now();
  let buildingIndex = 1;

  for (const city of CITIES) {
    for (let c = 0; c < city.count; c++) {
      const floors = 3 + (buildingIndex % 7); // 3 to 9 floors
      const totalArea = 8000 + (buildingIndex % 5) * 6000; // 8000 to 32000

      const offsetLat = (c - (city.count - 1) / 2) * 0.015 + (Math.random() - 0.5) * 0.003;
      const offsetLng = (c - (city.count - 1) / 2) * 0.015 + (Math.random() - 0.5) * 0.003;

      const type: BuildingType =
        buildingIndex % 10 === 0 ? "Data Center" : buildingIndex % 7 === 0 ? "Mixed Use" : "Office";
      const bName = `Infosystem Campus Block ${String.fromCharCode(65 + c)}${buildingIndex}`;
      const bAddress = `Sector ${12 + c}, Tech Zone, ${city.name}`;

      const buildingId = await db.buildings.add({
        name: bName,
        ownerName: "Infosystem",
        type,
        floors,
        totalArea,
        constructionType: "Type I — Non-combustible",
        fireResistanceRating: buildingIndex % 3 === 0 ? "3-hour" : "2-hour",
        address: bAddress,
        city: city.name,
        state:
          city.name === "Noida" ? "Uttar Pradesh" : city.name === "Gurugram" ? "Haryana" : "State",
        country: "India",
        latitude: city.lat + offsetLat,
        longitude: city.lng + offsetLng,
        createdAt: now - buildingIndex * 3600000,
      });

      // Seed floors and zones for each building
      const floorCount = Math.min(floors, 3); // cap floors per building for speed
      for (let lvl = 1; lvl <= floorCount; lvl++) {
        const totalExits = lvl === 1 ? 4 : 3;
        const floorId = await db.floors.add({
          buildingId,
          level: lvl,
          name: lvl === 1 ? "Ground Floor" : `Floor ${lvl}`,
          totalExits,
          availableExits: totalExits,
          blockedExits: 0,
          elevatorWorking: true,
        });

        // Add 3 zones per floor
        const zones = ["Lobby", "Office", "Corridor"];
        for (let zi = 0; zi < zones.length; zi++) {
          const ztype = zones[zi] as ZoneType;
          await db.zones.add({
            buildingId,
            floorId,
            zoneId: `IS-${buildingIndex}-F${lvl}-Z${zi + 1}`,
            name: `${ztype} ${zi + 1}`,
            type: ztype,
            area: 80 + zi * 30,
            occupancy: Math.floor(10 + Math.random() * 40),
            specialNeeds: Math.random() < 0.2 ? Math.floor(Math.random() * 3) : 0,
            x: 10 + zi * 30,
            y: 20,
            w: 25,
            h: 60,
          });
        }
      }

      buildingIndex++;
    }
  }

  await logActivity("building", `Seeded 30 Infosystem buildings across 12 cities.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// IVA PERSONNEL RESEED & INDIAN NAMES DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const SAMPLE_INDIAN_PERSONNEL: Array<Omit<import("./db").Personnel, "id">> = [
  // 1. Infants / Toddlers (Age <= 5)
  { employeeId: "EMP-IN-001", name: "Aarav Sharma", age: 3, gender: "M", department: "Daycare", assignedFloor: 1, cardId: "CRD-001", deviceId: "DEV-001", specialNeeds: true, specialNeedCategory: "Toddler", disabilityFactor: 0.75, emergencyContact: "+91 98765 43210", individualVulnerabilityScore: 0.55, individualRiskClass: "High", evacuationPriority: 5 },
  { employeeId: "EMP-IN-002", name: "Ananya Patel", age: 4, gender: "F", department: "Daycare", assignedFloor: 1, cardId: "CRD-002", deviceId: "DEV-002", specialNeeds: true, specialNeedCategory: "Child", disabilityFactor: 1.0, emergencyContact: "+91 98765 43211", individualVulnerabilityScore: 0.50, individualRiskClass: "High", evacuationPriority: 5 },
  { employeeId: "EMP-IN-003", name: "Vihaan Gupta", age: 2, gender: "M", department: "Daycare", assignedFloor: 1, cardId: "CRD-003", deviceId: "DEV-003", specialNeeds: true, specialNeedCategory: "Toddler", disabilityFactor: 0.75, emergencyContact: "+91 98765 43212", individualVulnerabilityScore: 0.55, individualRiskClass: "High", evacuationPriority: 5 },
  { employeeId: "EMP-IN-004", name: "Aditi Rao", age: 5, gender: "F", department: "Daycare", assignedFloor: 1, cardId: "CRD-004", deviceId: "DEV-004", specialNeeds: true, specialNeedCategory: "Child", disabilityFactor: 1.0, emergencyContact: "+91 98765 43213", individualVulnerabilityScore: 0.50, individualRiskClass: "High", evacuationPriority: 5 },
  { employeeId: "EMP-IN-005", name: "Reyansh Singh", age: 1, gender: "M", department: "Daycare", assignedFloor: 1, cardId: "CRD-005", deviceId: "DEV-005", specialNeeds: true, specialNeedCategory: "Toddler", disabilityFactor: 0.5, emergencyContact: "+91 98765 43214", individualVulnerabilityScore: 0.65, individualRiskClass: "High", evacuationPriority: 5 },

  // 2. Pregnant Women
  { employeeId: "EMP-IN-006", name: "Pooja Banerjee", age: 29, gender: "F", department: "HR", assignedFloor: 2, cardId: "CRD-006", deviceId: "DEV-006", specialNeeds: true, specialNeedCategory: "Pregnant Woman", disabilityFactor: 0.75, emergencyContact: "+91 98765 43215", individualVulnerabilityScore: 0.63, individualRiskClass: "High", evacuationPriority: 2 },
  { employeeId: "EMP-IN-007", name: "Priya Nair", age: 31, gender: "F", department: "Finance", assignedFloor: 3, cardId: "CRD-007", deviceId: "DEV-007", specialNeeds: true, specialNeedCategory: "Pregnant Woman", disabilityFactor: 0.75, emergencyContact: "+91 98765 43216", individualVulnerabilityScore: 0.71, individualRiskClass: "High", evacuationPriority: 2 },
  { employeeId: "EMP-IN-008", name: "Sunita Deshmukh", age: 34, gender: "F", department: "Administration", assignedFloor: 2, cardId: "CRD-008", deviceId: "DEV-008", specialNeeds: true, specialNeedCategory: "Pregnant Woman", disabilityFactor: 0.75, emergencyContact: "+91 98765 43217", individualVulnerabilityScore: 0.63, individualRiskClass: "High", evacuationPriority: 2 },
  { employeeId: "EMP-IN-009", name: "Deepika Varma", age: 27, gender: "F", department: "Marketing", assignedFloor: 4, cardId: "CRD-009", deviceId: "DEV-009", specialNeeds: true, specialNeedCategory: "Pregnant Woman", disabilityFactor: 0.75, emergencyContact: "+91 98765 43218", individualVulnerabilityScore: 0.79, individualRiskClass: "Critical", evacuationPriority: 2 },

  // 3. Aged 60+ (Senior Citizens)
  { employeeId: "EMP-IN-010", name: "Ramesh Chandra Chatterjee", age: 67, gender: "M", department: "Executive Board", assignedFloor: 5, cardId: "CRD-010", deviceId: "DEV-010", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43219", individualVulnerabilityScore: 0.87, individualRiskClass: "Critical", evacuationPriority: 4 },
  { employeeId: "EMP-IN-011", name: "Lakshmi Subramaniam", age: 64, gender: "F", department: "Administration", assignedFloor: 1, cardId: "CRD-011", deviceId: "DEV-011", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43220", individualVulnerabilityScore: 0.55, individualRiskClass: "High", evacuationPriority: 4 },
  { employeeId: "EMP-IN-012", name: "Krishnamurthy Iyer", age: 72, gender: "M", department: "Consultant", assignedFloor: 2, cardId: "CRD-012", deviceId: "DEV-012", specialNeeds: true, specialNeedCategory: "Walking Stick User", disabilityFactor: 0.5, emergencyContact: "+91 98765 43221", individualVulnerabilityScore: 0.79, individualRiskClass: "Critical", evacuationPriority: 4 },
  { employeeId: "EMP-IN-013", name: "Aruna Varma", age: 68, gender: "F", department: "Legal", assignedFloor: 3, cardId: "CRD-013", deviceId: "DEV-013", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43222", individualVulnerabilityScore: 0.71, individualRiskClass: "High", evacuationPriority: 4 },
  { employeeId: "EMP-IN-014", name: "Ashok Kumar Varma", age: 65, gender: "M", department: "Facility Management", assignedFloor: 1, cardId: "CRD-014", deviceId: "DEV-014", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43223", individualVulnerabilityScore: 0.55, individualRiskClass: "High", evacuationPriority: 4 },
  { employeeId: "EMP-IN-015", name: "Geeta Sen", age: 62, gender: "F", department: "Archive", assignedFloor: 1, cardId: "CRD-015", deviceId: "DEV-015", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43224", individualVulnerabilityScore: 0.55, individualRiskClass: "High", evacuationPriority: 4 },
  { employeeId: "EMP-IN-016", name: "Suresh Prasad", age: 70, gender: "M", department: "Advisory", assignedFloor: 4, cardId: "CRD-016", deviceId: "DEV-016", specialNeeds: true, specialNeedCategory: "Walking Stick User", disabilityFactor: 0.5, emergencyContact: "+91 98765 43225", individualVulnerabilityScore: 0.95, individualRiskClass: "Critical", evacuationPriority: 4 },
  { employeeId: "EMP-IN-017", name: "Bhavna Joshi", age: 61, gender: "F", department: "Research", assignedFloor: 3, cardId: "CRD-017", deviceId: "DEV-017", specialNeeds: true, specialNeedCategory: "Elderly", disabilityFactor: 0.75, emergencyContact: "+91 98765 43226", individualVulnerabilityScore: 0.71, individualRiskClass: "High", evacuationPriority: 4 },

  // 4. Patients (Critical Patient / Oxygen Support / ICU Patient)
  { employeeId: "EMP-IN-018", name: "Rajesh Kumar Sharma", age: 52, gender: "M", department: "Medical Center", assignedFloor: 2, cardId: "CRD-018", deviceId: "DEV-018", specialNeeds: true, specialNeedCategory: "Oxygen Support", disabilityFactor: 0.25, emergencyContact: "+91 98765 43227", individualVulnerabilityScore: 0.98, individualRiskClass: "Critical", evacuationPriority: 1 },
  { employeeId: "EMP-IN-019", name: "Meera Mukherjee", age: 48, gender: "F", department: "Medical Center", assignedFloor: 2, cardId: "CRD-019", deviceId: "DEV-019", specialNeeds: true, specialNeedCategory: "ICU Patient", disabilityFactor: 0.0, emergencyContact: "+91 98765 43228", individualVulnerabilityScore: 1.0, individualRiskClass: "Critical", evacuationPriority: 1 },
  { employeeId: "EMP-IN-020", name: "Amitabh Ghosh", age: 58, gender: "M", department: "Medical Center", assignedFloor: 2, cardId: "CRD-020", deviceId: "DEV-020", specialNeeds: true, specialNeedCategory: "Critical Patient", disabilityFactor: 0.0, emergencyContact: "+91 98765 43229", individualVulnerabilityScore: 1.0, individualRiskClass: "Critical", evacuationPriority: 1 },
  { employeeId: "EMP-IN-021", name: "Kavita Pillai", age: 44, gender: "F", department: "Medical Center", assignedFloor: 2, cardId: "CRD-021", deviceId: "DEV-021", specialNeeds: true, specialNeedCategory: "Oxygen Support", disabilityFactor: 0.25, emergencyContact: "+91 98765 43230", individualVulnerabilityScore: 0.98, individualRiskClass: "Critical", evacuationPriority: 1 },
  { employeeId: "EMP-IN-022", name: "Sanjay Malhotra", age: 56, gender: "M", department: "Medical Center", assignedFloor: 2, cardId: "CRD-022", deviceId: "DEV-022", specialNeeds: true, specialNeedCategory: "ICU Patient", disabilityFactor: 0.0, emergencyContact: "+91 98765 43231", individualVulnerabilityScore: 1.0, individualRiskClass: "Critical", evacuationPriority: 1 },
  { employeeId: "EMP-IN-023", name: "Rekha Reddy", age: 50, gender: "F", department: "Medical Center", assignedFloor: 2, cardId: "CRD-023", deviceId: "DEV-023", specialNeeds: true, specialNeedCategory: "Critical Patient", disabilityFactor: 0.25, emergencyContact: "+91 98765 43232", individualVulnerabilityScore: 0.98, individualRiskClass: "Critical", evacuationPriority: 1 },

  // 5. Disabled Personnel
  { employeeId: "EMP-IN-024", name: "Abhishek Kulkarni", age: 33, gender: "M", department: "IT", assignedFloor: 3, cardId: "CRD-024", deviceId: "DEV-024", specialNeeds: true, specialNeedCategory: "Wheelchair User", disabilityFactor: 0.0, emergencyContact: "+91 98765 43233", individualVulnerabilityScore: 0.90, individualRiskClass: "Critical", evacuationPriority: 3 },
  { employeeId: "EMP-IN-025", name: "Swati Deshpande", age: 29, gender: "F", department: "Software Dev", assignedFloor: 4, cardId: "CRD-025", deviceId: "DEV-025", specialNeeds: true, specialNeedCategory: "Vision Impaired", disabilityFactor: 0.5, emergencyContact: "+91 98765 43234", individualVulnerabilityScore: 0.74, individualRiskClass: "High", evacuationPriority: 6 },
  { employeeId: "EMP-IN-026", name: "Vikram Sengupta", age: 37, gender: "M", department: "Engineering", assignedFloor: 1, cardId: "CRD-026", deviceId: "DEV-026", specialNeeds: true, specialNeedCategory: "Hearing Impaired", disabilityFactor: 0.75, emergencyContact: "+91 98765 43235", individualVulnerabilityScore: 0.35, individualRiskClass: "Medium", evacuationPriority: 6 },
  { employeeId: "EMP-IN-027", name: "Nisha Varma", age: 31, gender: "F", department: "Quality Assurance", assignedFloor: 2, cardId: "CRD-027", deviceId: "DEV-027", specialNeeds: true, specialNeedCategory: "Temporary Injury", disabilityFactor: 0.5, emergencyContact: "+91 98765 43236", individualVulnerabilityScore: 0.53, individualRiskClass: "High", evacuationPriority: 6 },
  { employeeId: "EMP-IN-028", name: "Rahul Kapoor", age: 36, gender: "M", department: "Operations", assignedFloor: 3, cardId: "CRD-028", deviceId: "DEV-028", specialNeeds: true, specialNeedCategory: "Wheelchair User", disabilityFactor: 0.0, emergencyContact: "+91 98765 43237", individualVulnerabilityScore: 0.90, individualRiskClass: "Critical", evacuationPriority: 3 },
  { employeeId: "EMP-IN-029", name: "Divya Agarwal", age: 28, gender: "F", department: "UI/UX Design", assignedFloor: 4, cardId: "CRD-029", deviceId: "DEV-029", specialNeeds: true, specialNeedCategory: "Walking Stick User", disabilityFactor: 0.5, emergencyContact: "+91 98765 43238", individualVulnerabilityScore: 0.79, individualRiskClass: "Critical", evacuationPriority: 6 },

  // 6. Regular Male & Female Staff across floors & departments
  { employeeId: "EMP-IN-030", name: "Arjun Mehta", age: 32, gender: "M", department: "Engineering", assignedFloor: 1, cardId: "CRD-030", deviceId: "DEV-030", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43239", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-031", name: "Aishwarya Rai", age: 27, gender: "F", department: "HR", assignedFloor: 2, cardId: "CRD-031", deviceId: "DEV-031", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43240", individualVulnerabilityScore: 0.18, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-032", name: "Gaurav Tripathi", age: 35, gender: "M", department: "Security", assignedFloor: 1, cardId: "CRD-032", deviceId: "DEV-032", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43241", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-033", name: "Sneha Varma", age: 26, gender: "F", department: "Operations", assignedFloor: 3, cardId: "CRD-033", deviceId: "DEV-033", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43242", individualVulnerabilityScore: 0.26, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-034", name: "Deepak Yadav", age: 40, gender: "M", department: "Facility Management", assignedFloor: 1, cardId: "CRD-034", deviceId: "DEV-034", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43243", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-035", name: "Tanvi Saxena", age: 29, gender: "F", department: "Finance", assignedFloor: 2, cardId: "CRD-035", deviceId: "DEV-035", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43244", individualVulnerabilityScore: 0.18, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-036", name: "Vivek Sharma", age: 38, gender: "M", department: "IT Support", assignedFloor: 4, cardId: "CRD-036", deviceId: "DEV-036", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43245", individualVulnerabilityScore: 0.34, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-037", name: "Rupal Joshi", age: 30, gender: "F", department: "Administration", assignedFloor: 3, cardId: "CRD-037", deviceId: "DEV-037", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43246", individualVulnerabilityScore: 0.26, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-038", name: "Rohit Varma", age: 34, gender: "M", department: "DevOps", assignedFloor: 5, cardId: "CRD-038", deviceId: "DEV-038", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43247", individualVulnerabilityScore: 0.42, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-039", name: "Neha Dubey", age: 28, gender: "F", department: "Legal", assignedFloor: 2, cardId: "CRD-039", deviceId: "DEV-039", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43248", individualVulnerabilityScore: 0.18, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-040", name: "Sachin Tendulkar", age: 45, gender: "M", department: "Sports & Wellness", assignedFloor: 1, cardId: "CRD-040", deviceId: "DEV-040", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43249", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-041", name: "Kirti Mahajan", age: 33, gender: "F", department: "Product", assignedFloor: 4, cardId: "CRD-041", deviceId: "DEV-041", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43250", individualVulnerabilityScore: 0.34, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-042", name: "Pradeep Tiwari", age: 42, gender: "M", department: "Safety & Security", assignedFloor: 1, cardId: "CRD-042", deviceId: "DEV-042", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43251", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-043", name: "Ankit Shukla", age: 31, gender: "M", department: "Cloud Ops", assignedFloor: 5, cardId: "CRD-043", deviceId: "DEV-043", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43252", individualVulnerabilityScore: 0.42, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-044", name: "Pooja Hegde", age: 29, gender: "F", department: "Marketing", assignedFloor: 3, cardId: "CRD-044", deviceId: "DEV-044", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43253", individualVulnerabilityScore: 0.26, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-045", name: "Mohan Lal", age: 49, gender: "M", department: "Logistics", assignedFloor: 1, cardId: "CRD-045", deviceId: "DEV-045", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43254", individualVulnerabilityScore: 0.10, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-046", name: "Shruti Haasan", age: 30, gender: "F", department: "Communications", assignedFloor: 2, cardId: "CRD-046", deviceId: "DEV-046", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43255", individualVulnerabilityScore: 0.18, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-047", name: "Venkatesh Prasad", age: 46, gender: "M", department: "Compliance", assignedFloor: 4, cardId: "CRD-047", deviceId: "DEV-047", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43256", individualVulnerabilityScore: 0.34, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-048", name: "Yamini Varma", age: 26, gender: "F", department: "Design", assignedFloor: 3, cardId: "CRD-048", deviceId: "DEV-048", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43257", individualVulnerabilityScore: 0.26, individualRiskClass: "Medium", evacuationPriority: 7 },
  { employeeId: "EMP-IN-049", name: "Tarun Gogoi", age: 41, gender: "M", department: "Procurement", assignedFloor: 2, cardId: "CRD-049", deviceId: "DEV-049", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43258", individualVulnerabilityScore: 0.18, individualRiskClass: "Low", evacuationPriority: 7 },
  { employeeId: "EMP-IN-050", name: "Zara Khan", age: 28, gender: "F", department: "PR", assignedFloor: 4, cardId: "CRD-050", deviceId: "DEV-050", specialNeeds: false, specialNeedCategory: "None", disabilityFactor: 1.0, emergencyContact: "+91 98765 43259", individualVulnerabilityScore: 0.34, individualRiskClass: "Medium", evacuationPriority: 7 },
];

export async function seedIndianPersonnel(): Promise<number> {
  const existing = await db.personnel.toArray();
  const existingIds = new Set(existing.map((p) => p.employeeId));

  const toAdd = SAMPLE_INDIAN_PERSONNEL.filter((p) => !existingIds.has(p.employeeId)).map((p) => {
    const iva = computeIndividualVulnerability({
      age: p.age,
      disabilityFactor: p.disabilityFactor,
      specialNeedCategory: p.specialNeedCategory as SpecialNeedCategory,
      assignedFloor: p.assignedFloor,
      gender: p.gender as "M" | "F" | "Other",
    });
    return {
      ...p,
      specialNeeds: p.specialNeedCategory !== "None",
      individualVulnerabilityScore: iva.score,
      individualRiskClass: iva.riskClass,
      evacuationPriority: iva.evacuationPriority,
    };
  });

  if (toAdd.length > 0) {
    for (const p of toAdd) {
      await db.personnel.add(p as any);
    }
    await logActivity("system", `Seeded ${toAdd.length} Indian personnel records into database.`);
  }

  return toAdd.length;
}

export async function reseedPersonnelIfNeeded(): Promise<void> {
  return Promise.resolve();
}

