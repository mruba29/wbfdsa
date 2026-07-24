import type {
  CADDrawing,
  FloorData,
  FloorVulnerability,
  RiskLevelType,
  RoomBoundary,
} from "@/types/floor";
import { db, logActivity } from "@/lib/db";
import { computeIndividualVulnerability, ZONE_MULTIPLIER, classifyFloor } from "@/lib/vulnerability";
import { toast } from "sonner";

// ─── Room name pools for realistic mock data ────────────────────────────────
const ROOM_POOLS = [
  [
    "Main Lobby",
    "Security Reception",
    "Stairwell A",
    "Elevator Bank",
    "Executive Boardroom",
    "Open Office Area",
    "Primary Server Room",
    "Storage Vault",
    "Pantry Area"
  ],
  [
    "Meeting Room Alpha",
    "Meeting Room Beta",
    "Director Office",
    "HR Workspace",
    "Finance Suite",
    "IT Support Center",
    "Break Room",
    "Emergency Corridor",
  ],
  ["Lab 201 (Chemical)", "Lab 202 (Physics)", "Sample Prep Room", "Server Room 2", "Pantry", "Clean Room"],
  ["Ward Alpha", "Ward Beta", "Intensive Care Unit", "Nurses Station", "Pharmacy Dispensary", "Operating Theatre", "Recovery Area"],
];

/**
 * Client-side Gemini API call or Simulator Fallback to extract structural details.
 */
export async function extractCADData(file: File): Promise<any> {
  const name = file.name;
  const size = file.size;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  
  const key = typeof window !== "undefined" ? (localStorage.getItem("gemini_api_key") || localStorage.getItem("wb-gemini-api-key") || "") : "";
  
  if (!key.trim()) {
    // Return simulator response
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return generateMockAnalysis({ name, size, type: extension });
  }

  // Live Gemini Structured Output call
  try {
    const parts: any[] = [];
    const fileUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

    const promptText = `
You are an expert AI building architect and fire safety analyst.
Your task is to analyze the uploaded floor plan file and identify building features and perform a fire safety risk assessment.

Please return a structured JSON report that conforms to this schema:
{
  "buildingName": "string",
  "buildingType": "string",
  "numberOfFloors": 1,
  "floorHeight": 3.0,
  "roomsCount": 1,
  "corridorsCount": 1,
  "doorsCount": 1,
  "windowsCount": 1,
  "staircasesCount": 1,
  "elevatorsCount": 1,
  "emergencyExitsCount": 1,
  "fireExitsCount": 1,
  "openSpacesCount": 1,
  "electricalRoomsCount": 1,
  "serverRoomsCount": 1,
  "generatorRoomsCount": 1,
  "storageAreasCount": 1,
  "kitchensCount": 1,
  "laboratoriesCount": 1,
  "parkingAreasCount": 1,
  "assemblyAreaName": "string",
  "rooms": [
    {
      "name": "string",
      "type": "Lobby" | "Office" | "Corridor" | "Conference" | "Storage" | "Server" | "Patient" | "Retail" | "Classroom",
      "occupancy": 5,
      "specialNeeds": 0,
      "x": 10,
      "y": 10,
      "w": 20,
      "h": 30
    }
  ],
  "report": {
    "totalRooms": 1,
    "estimatedOccupancy": 1,
    "fireVulnerableAreas": ["string"],
    "safeZones": ["string"],
    "evacuationDifficulty": "Easy" | "Moderate" | "Difficult" | "Critical",
    "fireLoadEstimation": "Low" | "Medium" | "High",
    "missingFireSafetyEquipment": ["string"],
    "fireCodeRecommendations": ["string"]
  }
}

Important details:
- File name: ${name}
- File size: ${size} bytes
- Format: ${extension}

Note: For coordinates x, y, w, h of each room, specify values on a 0 to 100 percentage scale relative to the floor plan canvas width/height.
Ensure that rooms do not overlap and cover the available grid reasonably. Return ONLY the raw JSON string matching the schema.
`;

    parts.push({ text: promptText });
    
    if (["pdf", "png", "jpg", "jpeg", "webp"].includes(extension)) {
      const base64Data = fileUrl.split(",")[1];
      const mimeType = extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                buildingName: { type: "STRING" },
                buildingType: { type: "STRING" },
                numberOfFloors: { type: "INTEGER" },
                floorHeight: { type: "NUMBER" },
                roomsCount: { type: "INTEGER" },
                corridorsCount: { type: "INTEGER" },
                doorsCount: { type: "INTEGER" },
                windowsCount: { type: "INTEGER" },
                staircasesCount: { type: "INTEGER" },
                elevatorsCount: { type: "INTEGER" },
                emergencyExitsCount: { type: "INTEGER" },
                fireExitsCount: { type: "INTEGER" },
                openSpacesCount: { type: "INTEGER" },
                electricalRoomsCount: { type: "INTEGER" },
                serverRoomsCount: { type: "INTEGER" },
                generatorRoomsCount: { type: "INTEGER" },
                storageAreasCount: { type: "INTEGER" },
                kitchensCount: { type: "INTEGER" },
                laboratoriesCount: { type: "INTEGER" },
                parkingAreasCount: { type: "INTEGER" },
                assemblyAreaName: { type: "STRING" },
                rooms: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" },
                      type: { type: "STRING", enum: ["Lobby", "Office", "Corridor", "Conference", "Storage", "Server", "Patient", "Retail", "Classroom"] },
                      occupancy: { type: "INTEGER" },
                      specialNeeds: { type: "INTEGER" },
                      x: { type: "INTEGER" },
                      y: { type: "INTEGER" },
                      w: { type: "INTEGER" },
                      h: { type: "INTEGER" }
                    },
                    required: ["name", "type", "occupancy", "specialNeeds", "x", "y", "w", "h"]
                  }
                },
                report: {
                  type: "OBJECT",
                  properties: {
                    totalRooms: { type: "INTEGER" },
                    estimatedOccupancy: { type: "INTEGER" },
                    fireVulnerableAreas: { type: "ARRAY", items: { type: "STRING" } },
                    safeZones: { type: "ARRAY", items: { type: "STRING" } },
                    evacuationDifficulty: { type: "STRING", enum: ["Easy", "Moderate", "Difficult", "Critical"] },
                    fireLoadEstimation: { type: "STRING", enum: ["Low", "Medium", "High"] },
                    missingFireSafetyEquipment: { type: "ARRAY", items: { type: "STRING" } },
                    fireCodeRecommendations: { type: "ARRAY", items: { type: "STRING" } }
                  },
                  required: ["totalRooms", "estimatedOccupancy", "fireVulnerableAreas", "safeZones", "evacuationDifficulty", "fireLoadEstimation", "missingFireSafetyEquipment", "fireCodeRecommendations"]
                }
              },
              required: [
                "buildingName", "buildingType", "numberOfFloors", "floorHeight", "roomsCount",
                "corridorsCount", "doorsCount", "windowsCount", "staircasesCount", "elevatorsCount",
                "emergencyExitsCount", "fireExitsCount", "openSpacesCount", "electricalRoomsCount",
                "serverRoomsCount", "generatorRoomsCount", "storageAreasCount", "kitchensCount",
                "laboratoriesCount", "parkingAreasCount", "assemblyAreaName", "rooms", "report"
              ]
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const resJson = await response.json();
    const parsedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!parsedText) throw new Error("Empty AI response.");
    
    return JSON.parse(parsedText);
  } catch (err: any) {
    console.warn("Gemini Live Call failed, using simulator fallback:", err);
    toast.error("Gemini API call failed — loading fallback simulation.");
    return generateMockAnalysis({ name, size, type: extension });
  }
}

/**
 * Populates the local Dexie tables using the extracted CAD structured JSON (STEP 1 & STEP 6).
 */
export async function populateDatabaseFromCAD(
  buildingIdStr: string | null,
  currentLevel: number | null,
  extractedData: any
) {
  let bId = buildingIdStr ? parseInt(buildingIdStr) : null;
  const bName = extractedData.buildingName || "Extracted Site Blueprint";
  const bType = extractedData.buildingType || "Mixed Use Office";
  const floorsCount = extractedData.numberOfFloors || 3;

  // 1. Create or Update Building
  if (!bId) {
    // Insert new building
    bId = await db.buildings.add({
      name: bName,
      type: bType,
      floors: floorsCount,
      totalArea: 420 * floorsCount,
      address: "Extracted CAD Site Location",
      city: "Bengaluru",
      constructionType: "Concrete Frame (Type I)",
      fireResistanceRating: "2-Hour Fire Rating",
      createdAt: Date.now(),
      status: "draft"
    });
    await logActivity("building", `Created building "${bName}" via CAD AI extraction.`);
  } else {
    // Update existing building metadata
    await db.buildings.update(bId, {
      name: bName,
      type: bType,
      floors: Math.max(floorsCount, 1)
    });
    await logActivity("building", `Updated building ID ${bId} profile metrics using uploaded floor plan.`);
  }

  // 2. Ensure Floor level exists
  const targetLevel = currentLevel ?? 1;
  const existingFloor = await db.floors
    .where({ buildingId: bId, level: targetLevel })
    .first();
  
  let floorId: number;
  if (!existingFloor) {
    floorId = await db.floors.add({
      buildingId: bId,
      level: targetLevel,
      name: `Floor ${targetLevel}`,
      totalExits: Math.max(2, extractedData.fireExitsCount || 2),
      availableExits: Math.max(2, extractedData.fireExitsCount || 2),
      blockedExits: 0,
      elevatorWorking: true
    });
  } else {
    floorId = existingFloor.id!;
    await db.floors.update(floorId, {
      totalExits: Math.max(2, extractedData.fireExitsCount || 2),
      availableExits: Math.max(2, extractedData.fireExitsCount - (existingFloor.blockedExits || 0))
    });
  }

  // 3. Clear old zones on this specific floor and add new ones (STEP 2)
  await db.zones.where({ buildingId: bId, floorId }).delete();
  
  const roomBoundaries: RoomBoundary[] = [];
  const roomsList = extractedData.rooms || [];
  
  for (let i = 0; i < roomsList.length; i++) {
    const r = roomsList[i];
    const zoneDbId = await db.zones.add({
      buildingId: bId,
      floorId,
      zoneId: `zone-${i + 1}`,
      name: r.name,
      type: r.type || "Office",
      area: r.w * r.h * 0.15 || 50,
      occupancy: r.occupancy || 0,
      specialNeeds: r.specialNeeds || 0,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h
    });

    const distSt = Math.round(5 + (i * 7) % 25);
    const distLift = Math.round(8 + (i * 9) % 30);
    const distExit = Math.round(4 + (i * 5) % 20);

    roomBoundaries.push({
      id: `room-${i + 1}`,
      name: r.name,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      distanceToStaircase: distSt,
      distanceToLift: distLift,
      distanceToEmergencyExit: distExit,
      safePath: [
        { x: r.x + r.w / 2, y: r.y + r.h / 2 },
        { x: r.x + r.w / 2, y: 50 },
        { x: r.x < 50 ? 5 : 95, y: 50 }
      ],
      alternatePath: [
        { x: r.x + r.w / 2, y: r.y + r.h / 2 },
        { x: 50, y: r.y + r.h / 2 },
        { x: 50, y: r.y < 50 ? 5 : 95 }
      ]
    });
  }

  // 4. Automatically place Fire Safety Equipment (STEP 6)
  const floorNameStr = `Floor ${targetLevel}`;
  const buildingNameStr = bName;

  // Delete existing inventory for this floor
  await db.fireInventory
    .where("building").equals(buildingNameStr)
    .and((item) => item.floor === floorNameStr)
    .delete();

  // Populate extinguishers, smoke detectors, sprinklers, emergency lights, and exits
  const equipmentTypes = [
    { name: "Dry Chemical Powder Extinguisher", type: "Fire Extinguisher", roomTypes: ["Server", "Kitchen", "Electrical", "Office", "Corridor"] },
    { name: "Optical Smoke Detector", type: "Smoke Detector", roomTypes: ["Server", "Kitchen", "Electrical", "Office", "Lobby", "Conference", "Storage"] },
    { name: "Automatic Wet Sprinkler Head", type: "Sprinkler", roomTypes: ["Server", "Kitchen", "Office", "Lobby", "Conference", "Storage"] },
    { name: "LED Emergency Backup Light", type: "Emergency Light", roomTypes: ["Corridor", "Lobby", "Conference"] },
    { name: "Luminous Running Man Sign", type: "Exit Board", roomTypes: ["Corridor", "Lobby"] },
    { name: "Manual Fire Alarm Pull Station", type: "Manual Call Point", roomTypes: ["Lobby", "Corridor"] },
    { name: "Industrial Fire Hydrant Valve", type: "Hydrant", roomTypes: ["Lobby", "Parking"] }
  ];

  let equipIndex = 1;
  for (const r of roomsList) {
    for (const eq of equipmentTypes) {
      if (eq.roomTypes.some(rt => r.name.toLowerCase().includes(rt.toLowerCase()) || r.type.toLowerCase().includes(rt.toLowerCase()))) {
        await db.fireInventory.add({
          inventoryId: `INV-${targetLevel}-${equipIndex++}`,
          equipmentName: eq.name,
          equipmentType: eq.type,
          building: buildingNameStr,
          floor: floorNameStr,
          zoneRoom: r.name,
          quantity: eq.type === "Smoke Detector" || eq.type === "Sprinkler" ? Math.max(1, Math.round(r.w * r.h / 25)) : 1,
          installationDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          lastInspectionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          maintenanceDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: "Active",
          assignedMaintenanceTeam: "Team Red Sentinel",
          remarks: "Auto-placed during CAD extraction and Digital Twin seeding"
        });
      }
    }
  }

  await logActivity("system", `Populated ${equipIndex - 1} fire inventory safety items for level ${targetLevel}.`);

  return {
    buildingId: bId,
    floorId,
    roomBoundaries
  };
}

/**
 * Calculates comprehensive fire vulnerability metrics matching WB-FDVA formulas (STEP 3).
 */
export async function calculateVulnerability(
  extractedData: any,
  currentOccupancy: number,
  maxOccupancy: number,
  simulationTime: number = 0,
  floorLevel: number = 1
): Promise<FloorVulnerability> {
  
  const occupancyRatio = maxOccupancy > 0 ? Math.min(1, currentOccupancy / maxOccupancy) : 0;

  const exits = (extractedData.directExits ?? 2) + (extractedData.emergencyExits ?? 1);
  const exitScore = exits >= 6 ? 5 : exits >= 4 ? 15 : exits >= 2 ? 30 : 60;

  const doorCount = extractedData.doors ?? 10;
  const doorScore = doorCount >= 30 ? 5 : doorCount >= 20 ? 10 : doorCount >= 10 ? 20 : 35;

  const winCount = extractedData.windows ?? 5;
  const windowScore = winCount >= 30 ? 5 : winCount >= 15 ? 10 : winCount >= 5 ? 20 : 30;

  const occupancyScore = Math.round(occupancyRatio * 100);

  const stairDistStr = String(extractedData.distanceToStaircase ?? "15 meters");
  const stairDistNum = parseInt(stairDistStr) || 15;
  const staircaseDistScore =
    stairDistNum > 40 ? 60 : stairDistNum > 25 ? 40 : stairDistNum > 15 ? 20 : 10;

  const liftDistStr = String(extractedData.distanceToLift ?? "20 meters");
  const liftDistNum = parseInt(liftDistStr) || 20;
  const liftDistScore = liftDistNum > 45 ? 50 : liftDistNum > 30 ? 30 : liftDistNum > 15 ? 15 : 8;

  const fireEquipmentScore = doorCount > 25 ? 5 : doorCount > 15 ? 15 : 30;
  const escapeRouteScore = exits >= 4 ? 5 : exits >= 2 ? 15 : 40;

  // Weights for the overall 8-factor score
  const weights = {
    exitScore: 0.2,
    doorScore: 0.08,
    windowScore: 0.07,
    occupancyScore: 0.2,
    staircaseDistScore: 0.15,
    liftDistScore: 0.1,
    fireEquipmentScore: 0.1,
    escapeRouteScore: 0.1,
  };

  const baseVulnerability = Math.min(
    100,
    Math.round(
      exitScore * weights.exitScore +
        doorScore * weights.doorScore +
        windowScore * weights.windowScore +
        occupancyScore * weights.occupancyScore +
        staircaseDistScore * weights.staircaseDistScore +
        liftDistScore * weights.liftDistScore +
        fireEquipmentScore * weights.fireEquipmentScore +
        escapeRouteScore * weights.escapeRouteScore
    )
  );

  // Time-based smoke/fire simulation increments
  const timePenalty = Math.round((simulationTime / 30) * 8);
  const overallVulnerability = Math.min(100, baseVulnerability + timePenalty);

  const safetyIndex = Math.max(0, 100 - overallVulnerability);

  let riskCategory: RiskLevelType = "LOW";
  if (overallVulnerability > 75) riskCategory = "CRITICAL";
  else if (overallVulnerability > 55) riskCategory = "HIGH";
  else if (overallVulnerability > 35) riskCategory = "MEDIUM";

  const fireRisk = Math.min(
    100,
    Math.round(exitScore * 0.5 + staircaseDistScore * 0.3 + fireEquipmentScore * 0.2)
  );
  const evacuationDifficulty = Math.min(
    100,
    Math.round(staircaseDistScore * 0.4 + liftDistScore * 0.3 + occupancyScore * 0.3 + (simulationTime * 0.5))
  );

  // STEP 3: Integrated calculations
  const occupancyDensity = parseFloat((currentOccupancy / Math.max(1, extractedData.floorArea || 250)).toFixed(2));
  
  // Calculate Fire Load (MJ/m2)
  let totalFireLoad = 150; // Base load for offices
  if (extractedData.serverRoomsCount && extractedData.serverRoomsCount > 0) totalFireLoad += 200;
  if (extractedData.electricalRoomsCount && extractedData.electricalRoomsCount > 0) totalFireLoad += 100;
  if (extractedData.laboratoriesCount && extractedData.laboratoriesCount > 0) totalFireLoad += 200;
  if (extractedData.kitchensCount && extractedData.kitchensCount > 0) totalFireLoad += 150;
  const fireLoad = Math.min(1200, totalFireLoad);

  // Exit accessibility (100% -> 25%)
  const exitAccessibility = Math.max(25, Math.round(100 - (stairDistNum * 1.5)));

  // Smoke risk over time
  const baseSmoke = Math.round(10 + (fireLoad / 30) - winCount * 0.5);
  const smokeRisk = Math.min(100, Math.max(0, baseSmoke + Math.round(simulationTime * 0.7)));

  // Structural Risk
  const structuralRisk = Math.min(100, Math.round(30 + (floorLevel * 4) + (fireLoad > 600 ? 25 : 10)));

  // Response Time (mins)
  const responseTime = parseFloat((5 + (floorLevel * 0.5) + (evacuationDifficulty * 0.05)).toFixed(1));

  return {
    overallVulnerability,
    fireRisk,
    occupancyRisk: Math.min(100, Math.round(occupancyScore)),
    evacuationDifficulty,
    safetyIndex,
    riskCategory,
    exitScore,
    doorScore,
    windowScore,
    occupancyScore,
    staircaseDistScore,
    liftDistScore,
    fireEquipmentScore,
    escapeRouteScore,
    // Extensions
    floorVulnerabilityIndex: overallVulnerability,
    individualVulnerabilityIndex: Math.min(100, Math.round(baseVulnerability * 0.8)),
    overallFireVulnerabilityIndex: Math.min(100, Math.round(overallVulnerability * 1.1)),
    occupancyDensity,
    fireLoad,
    exitAccessibility,
    smokeRisk,
    structuralRisk,
    responseTime
  } as any;
}

export async function uploadCADFileToBackend(id: string, file: File, fileUrl: string) {
  return { success: true, message: "Cached locally in sandbox." };
}

export async function getEvacuationPriority(floors: any[], currentFloorData?: FloorData | null) {
  return floors.map((f, i) => ({
    floorId: f.id,
    floorName: f.name || `Floor ${f.level}`,
    level: f.level,
    riskLevel: currentFloorData?.level === f.level ? currentFloorData?.vulnerability?.riskCategory || "LOW" : "LOW",
    vulnerabilityScore: currentFloorData?.level === f.level ? currentFloorData?.vulnerability?.overallVulnerability || 20 : 20,
    priorityOrder: i + 1,
    recommendedOrder: `Priority ${i + 1}`
  }));
}

/**
 * High-Fidelity Client-Side Simulator Fallback.
 */
function generateMockAnalysis(fileInfo: any) {
  const name = fileInfo.name || "floorplan.dxf";
  const nameLower = name.toLowerCase();
  
  let buildingName = "Trident Tech Hub";
  let buildingType = "Commercial Office Space";
  let numberOfFloors = 3;
  let floorHeight = 3.2;
  
  let rooms = [
    { name: "Main Entrance Lobby", type: "Lobby", occupancy: 12, specialNeeds: 1, x: 5, y: 5, w: 20, h: 25 },
    { name: "Corridor Alpha", type: "Corridor", occupancy: 2, specialNeeds: 0, x: 25, y: 5, w: 50, h: 10 },
    { name: "IT Server Rack Suite", type: "Server", occupancy: 1, specialNeeds: 0, x: 5, y: 35, w: 18, h: 20 },
    { name: "Open Collaborative Workspace", type: "Office", occupancy: 24, specialNeeds: 2, x: 28, y: 20, w: 42, h: 50 },
    { name: "Facility Storage Vault", type: "Storage", occupancy: 0, specialNeeds: 0, x: 75, y: 20, w: 20, h: 20 },
    { name: "Conference Room Alpha", type: "Conference", occupancy: 8, specialNeeds: 0, x: 5, y: 60, w: 20, h: 30 },
    { name: "Main Electrical Panel", type: "Storage", occupancy: 1, specialNeeds: 0, x: 75, y: 50, w: 20, h: 18 },
    { name: "Staff Cafeteria Kitchen", type: "Office", occupancy: 6, specialNeeds: 0, x: 75, y: 73, w: 20, h: 22 }
  ];

  let fireVulnerableAreas = [
    "IT Server Rack Suite (High heat generation & combustible plastics)", 
    "Main Electrical Panel (Potential arc flash & overload risks)", 
    "Staff Cafeteria Kitchen (Ignition sources, cookers & grease loads)"
  ];
  let safeZones = [
    "Pressurized Concrete Stairwell A (East egress)", 
    "External Assembly Point (Main Gate South Lawn)"
  ];
  let evacuationDifficulty = "Moderate";
  let fireLoadEstimation = "Medium";
  let missingFireSafetyEquipment = [
    "Clean Agent FM-200 extinguisher in Server Suite", 
    "Secondary backup battery module for Exit Signs in Corridor Alpha"
  ];
  let fireCodeRecommendations = [
    "Install clean-agent fire suppression system in Server Rooms (NFPA 2001 compliance)", 
    "Maintain clear 44-inch egress route corridors (NFPA 101 Life Safety Code)", 
    "Place manual call point within 5 feet of Stairwell A entrance door"
  ];
  
  if (nameLower.includes("home") || nameLower.includes("house") || nameLower.includes("residential") || nameLower.includes("apartment")) {
    buildingName = "Skyline Residency";
    buildingType = "Multi-Family Residential";
    numberOfFloors = 5;
    floorHeight = 3.0;
    rooms = [
      { name: "Common Entry Lobby", type: "Lobby", occupancy: 4, specialNeeds: 0, x: 5, y: 5, w: 20, h: 20 },
      { name: "Apartment 101", type: "Office", occupancy: 5, specialNeeds: 1, x: 30, y: 5, w: 30, h: 40 },
      { name: "Apartment 102", type: "Office", occupancy: 3, specialNeeds: 0, x: 65, y: 5, w: 30, h: 40 },
      { name: "Central Egress Passage", type: "Corridor", occupancy: 1, specialNeeds: 0, x: 5, y: 50, w: 90, h: 10 },
      { name: "Electrical Distribution Closet", type: "Storage", occupancy: 0, specialNeeds: 0, x: 5, y: 65, w: 15, h: 25 },
      { name: "Apartment 103", type: "Office", occupancy: 6, specialNeeds: 2, x: 25, y: 65, w: 32, h: 30 },
      { name: "Apartment 104", type: "Office", occupancy: 4, specialNeeds: 0, x: 62, y: 65, w: 33, h: 30 }
    ];
    fireVulnerableAreas = [
      "Apartment Kitchens (Ignition risk from appliances)", 
      "Trash Chute Collection Chamber",
      "Electrical Switch Room"
    ];
    safeZones = [
      "Fire Rated Stairwell Alpha", 
      "Outdoor Courtyard (Primary Assembly Point)"
    ];
    evacuationDifficulty = "Difficult";
    fireLoadEstimation = "Medium";
    missingFireSafetyEquipment = [
      "Dual-sensor smoke detectors in sleeping areas",
      "Sprinkler head flow testing tag is out-of-date"
    ];
    fireCodeRecommendations = [
      "Ensure self-closing fire doors on residential corridors are operational (NFPA 80)",
      "Provide carbon monoxide detectors in corridors outside apartments"
    ];
  } else if (nameLower.includes("lab") || nameLower.includes("laboratory") || nameLower.includes("science") || nameLower.includes("chemical") || nameLower.includes("hospital")) {
    buildingName = "Apex Bio-Lab";
    buildingType = "Clinical Research Laboratory";
    numberOfFloors = 2;
    floorHeight = 3.6;
    rooms = [
      { name: "Reception Vestibule", type: "Lobby", occupancy: 8, specialNeeds: 0, x: 5, y: 5, w: 20, h: 20 },
      { name: "Corridor Alpha", type: "Corridor", occupancy: 1, specialNeeds: 0, x: 28, y: 5, w: 67, h: 10 },
      { name: "Chemical Processing Lab", type: "Patient", occupancy: 8, specialNeeds: 1, x: 5, y: 30, w: 40, h: 35 },
      { name: "Cryo Storage Facility", type: "Storage", occupancy: 2, specialNeeds: 0, x: 50, y: 20, w: 20, h: 20 },
      { name: "Database Rack Server room", type: "Server", occupancy: 1, specialNeeds: 0, x: 75, y: 20, w: 20, h: 30 },
      { name: "Main Electrical Feeder room", type: "Storage", occupancy: 1, specialNeeds: 0, x: 50, y: 45, w: 20, h: 20 },
      { name: "Decontamination Air-Lock", type: "Lobby", occupancy: 0, specialNeeds: 0, x: 5, y: 70, w: 20, h: 25 },
      { name: "Hazardous Chemical Vault", type: "Storage", occupancy: 0, specialNeeds: 0, x: 30, y: 70, w: 35, h: 25 },
      { name: "Personnel Break Room", type: "Office", occupancy: 12, specialNeeds: 1, x: 70, y: 70, w: 25, h: 25 }
    ];
    fireVulnerableAreas = [
      "Hazardous Chemical Vault (High load flammable solvents)",
      "Database Server Room",
      "Main Electrical Switchroom"
    ];
    safeZones = [
      "Corridor Air-Lock Assembly Area",
      "External West Parking Lot Assembly Point"
    ];
    evacuationDifficulty = "Critical";
    fireLoadEstimation = "High";
    missingFireSafetyEquipment = [
      "Class D metal fire dry-powder extinguisher in Processing Lab",
      "Gas monitoring automatic shutoff valve interlock tie-in"
    ];
    fireCodeRecommendations = [
      "Implement maximum allowable quantity (MAQ) restrictions for Class I liquids (NFPA 45)",
      "Verify emergency eye wash and safety shower coordinates are clear (ANSI Z358.1)"
    ];
  }

  // Adjust room count metrics dynamically
  const roomsCount = rooms.length;
  const corridorsCount = rooms.filter(r => r.name.toLowerCase().includes("corridor") || r.name.toLowerCase().includes("passage")).length || 1;
  const storageAreasCount = rooms.filter(r => r.name.toLowerCase().includes("storage") || r.name.toLowerCase().includes("vault")).length || 1;
  
  return {
    buildingName,
    buildingType,
    numberOfFloors,
    floorHeight,
    roomsCount,
    corridorsCount,
    doorsCount: Math.round(roomsCount * 1.2),
    windowsCount: Math.round(roomsCount * 1.8),
    staircasesCount: 2,
    elevatorsCount: 1,
    emergencyExitsCount: 2,
    fireExitsCount: 2,
    openSpacesCount: 1,
    electricalRoomsCount: rooms.filter(r => r.name.toLowerCase().includes("electrical")).length || 1,
    serverRoomsCount: rooms.filter(r => r.name.toLowerCase().includes("server")).length || 1,
    generatorRoomsCount: 1,
    storageAreasCount,
    kitchensCount: rooms.filter(r => r.name.toLowerCase().includes("kitchen") || r.name.toLowerCase().includes("cafeteria")).length || 0,
    laboratoriesCount: rooms.filter(r => r.name.toLowerCase().includes("lab")).length || 0,
    parkingAreasCount: 1,
    assemblyAreaName: "South Gate Lawn",
    rooms,
    report: {
      totalRooms: roomsCount,
      estimatedOccupancy: rooms.reduce((s, r) => s + r.occupancy, 0) || 45,
      fireVulnerableAreas,
      safeZones,
      evacuationDifficulty,
      fireLoadEstimation,
      missingFireSafetyEquipment,
      fireCodeRecommendations
    }
  };
}
