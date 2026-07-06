import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FloorVulnerability, RiskLevelType, RoomBoundary, FloorData } from "@/types/floor";

// Mock database storage on the server for CAD file URLs and metadata
const cadDatabase = new Map<string, any>();

// ─── Room name pools for realistic mock data ────────────────────────────────
const ROOM_POOLS = [
  [
    "Lobby",
    "Reception",
    "Stairwell A",
    "Elevator Bank",
    "Conference Room 1",
    "Conference Room 2",
    "Open Office",
    "Server Room",
    "Storage",
  ],
  [
    "Meeting Room A",
    "Meeting Room B",
    "Director Suite",
    "HR Office",
    "Finance",
    "IT Hub",
    "Pantry",
    "Emergency Exit Corridor",
  ],
  ["Lab 101", "Lab 102", "Analysis Room", "Data Centre", "Break Room", "Print Room", "Records"],
  ["Ward A", "Ward B", "ICU", "Nurses Station", "Pharmacy", "Operating Theatre", "Recovery Room"],
];

const EVAC_DESCRIPTIONS = [
  "Evacuate immediately — highest danger",
  "High-risk zone — evacuate second",
  "Moderate risk — evacuate third",
  "Lower risk — orderly evacuation",
  "Lowest risk — evacuate last",
];

export const uploadCADFileFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileType: z.string(),
      fileSize: z.number().optional(),
      uploadedBy: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Store in our mock server DB
    cadDatabase.set(data.id, { ...data, uploadDate: new Date().toISOString() });
    return { success: true, message: "File uploaded to server storage." };
  });

export const retrieveCADFileFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const record = cadDatabase.get(data.id);
    if (!record) {
      throw new Error("CAD file not found on server.");
    }
    return { success: true, file: record };
  });

export const extractCADObjectsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ fileSize: z.number().optional() }))
  .handler(async ({ data }) => {
    // Simulate AI network delay on the backend
    await new Promise((resolve) => setTimeout(resolve, 2200));

    const seed = data.fileSize || 2048;
    const pool = ROOM_POOLS[seed % ROOM_POOLS.length];

    const numRooms = 4 + (seed % 5);
    const roomNames: string[] = pool.slice(0, numRooms);

    const roomBoundaries = roomNames.map((name, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 5 + col * 32;
      const y = 5 + row * 42;
      const distSt = Math.round(5 + ((seed * (i + 1)) % 30));
      const distLift = Math.round(8 + ((seed * (i + 2)) % 35));
      const distExit = Math.round(4 + ((seed * (i + 3)) % 25));
      
      const safePath = [
        { x: x + 14, y: y + 17 },
        { x: x + 14, y: 50 },
        { x: x < 50 ? 5 : 95, y: 50 }
      ];
      
      const alternatePath = [
        { x: x + 14, y: y + 17 },
        { x: 50, y: y + 17 },
        { x: 50, y: y < 50 ? 5 : 95 }
      ];

      return {
        id: `room-${i + 1}`,
        name,
        x,
        y,
        w: 28,
        h: 35,
        distanceToStaircase: distSt,
        distanceToLift: distLift,
        distanceToEmergencyExit: distExit,
        safePath,
        alternatePath,
      };
    });

    const avgStairDist = Math.round(
      roomBoundaries.reduce((s, r) => s + (r.distanceToStaircase ?? 0), 0) / roomBoundaries.length,
    );
    const avgLiftDist = Math.round(
      roomBoundaries.reduce((s, r) => s + (r.distanceToLift ?? 0), 0) / roomBoundaries.length,
    );

    const cadElements: any[] = [];
    
    // Add Exits
    const exits = [
      { id: "e-1", type: "EXIT", x: 2, y: 48, w: 4, h: 4 },
      { id: "e-2", type: "EXIT", x: 94, y: 48, w: 4, h: 4 },
      { id: "e-3", type: "EXIT", x: 48, y: 2, w: 4, h: 4 },
      { id: "e-4", type: "EXIT", x: 48, y: 94, w: 4, h: 4 },
    ];
    cadElements.push(...exits.slice(0, Math.floor(2 + (seed % 3))));

    // Add Staircases
    cadElements.push({ id: "st-1", type: "STAIRCASE", x: 10, y: 10, w: 6, h: 6 });
    if (seed % 2 === 0) cadElements.push({ id: "st-2", type: "STAIRCASE", x: 84, y: 84, w: 6, h: 6 });

    // Add Lifts
    cadElements.push({ id: "l-1", type: "LIFT", x: 10, y: 18, w: 5, h: 5 });
    if (seed % 3 === 0) cadElements.push({ id: "l-2", type: "LIFT", x: 85, y: 77, w: 5, h: 5 });

    // Add Doors & Windows based on rooms
    roomBoundaries.forEach((r, i) => {
      cadElements.push({ id: `d-${i}`, type: "DOOR", x: r.x + r.w / 2 - 2, y: r.y + r.h - 1, w: 4, h: 2 });
      cadElements.push({ id: `w-${i}-1`, type: "WINDOW", x: r.x - 1, y: r.y + r.h / 4, w: 2, h: 6 });
      cadElements.push({ id: `w-${i}-2`, type: "WINDOW", x: r.x + r.w - 1, y: r.y + r.h / 4, w: 2, h: 6 });
    });

    return {
      doors: cadElements.filter((c) => c.type === "DOOR").length,
      windows: cadElements.filter((c) => c.type === "WINDOW").length,
      directExits: cadElements.filter((c) => c.type === "EXIT").length,
      emergencyExits: 1,
      staircases: cadElements.filter((c) => c.type === "STAIRCASE").length,
      lifts: cadElements.filter((c) => c.type === "LIFT").length,
      distanceToStaircase: `${avgStairDist} meters`,
      distanceToLift: `${avgLiftDist} meters`,
      roomNames,
      roomBoundaries,
      cadElements,
    };
  });

export const calculateFloorStatisticsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      baseStats: z.any(),
      extractedStats: z.any(),
    }),
  )
  .handler(async ({ data }) => {
    // Merge the base statistics and the extracted structural stats
    return {
      ...data.baseStats,
      ...data.extractedStats,
    };
  });

export const calculateVulnerabilityScoreFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      extractedData: z.any(),
      currentOccupancy: z.number(),
      maxOccupancy: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const { extractedData, currentOccupancy, maxOccupancy } = data;
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

    const overallVulnerability = Math.min(
      100,
      Math.round(
        exitScore * weights.exitScore +
          doorScore * weights.doorScore +
          windowScore * weights.windowScore +
          occupancyScore * weights.occupancyScore +
          staircaseDistScore * weights.staircaseDistScore +
          liftDistScore * weights.liftDistScore +
          fireEquipmentScore * weights.fireEquipmentScore +
          escapeRouteScore * weights.escapeRouteScore,
      ),
    );

    const safetyIndex = Math.max(0, 100 - overallVulnerability);

    let riskCategory: RiskLevelType = "LOW";
    if (overallVulnerability > 75) riskCategory = "CRITICAL";
    else if (overallVulnerability > 55) riskCategory = "HIGH";
    else if (overallVulnerability > 35) riskCategory = "MEDIUM";

    const fireRisk = Math.min(
      100,
      Math.round(exitScore * 0.5 + staircaseDistScore * 0.3 + fireEquipmentScore * 0.2),
    );
    const evacDiff = Math.min(
      100,
      Math.round(staircaseDistScore * 0.4 + liftDistScore * 0.3 + occupancyScore * 0.3),
    );

    return {
      overallVulnerability,
      fireRisk,
      occupancyRisk: Math.min(100, Math.round(occupancyScore)),
      evacuationDifficulty: evacDiff,
      safetyIndex,
      riskCategory,
      exitScore,
      doorScore,
      windowScore,
      occupancyScore: Math.min(100, Math.round(occupancyScore)),
      staircaseDistScore,
      liftDistScore,
      fireEquipmentScore,
      escapeRouteScore,
    } as FloorVulnerability;
  });

export const calculateEvacuationPriorityFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      floors: z.any().array(),
      currentFloorData: z.any().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { floors, currentFloorData } = data;
    const prioritized = [...floors]
      .map((f: any) => {
        let score = 0;
        let riskLevel: RiskLevelType = "LOW";

        if (
          currentFloorData &&
          currentFloorData.level === f.level &&
          currentFloorData.vulnerability
        ) {
          score = currentFloorData.vulnerability.overallVulnerability;
          riskLevel = currentFloorData.vulnerability.riskCategory;
        } else {
          score = 20 + (((f.level || 1) * 15 + (f.id || 0) * 7) % 65);
          if (score > 75) riskLevel = "CRITICAL";
          else if (score > 55) riskLevel = "HIGH";
          else if (score > 35) riskLevel = "MEDIUM";
        }

        return {
          floorId: f.id,
          floorName: f.name || `Floor ${f.level}`,
          level: f.level,
          riskLevel,
          vulnerabilityScore: score,
        };
      })
      .sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore)
      .map((f, index) => ({
        ...f,
        priorityOrder: index + 1,
        recommendedOrder: EVAC_DESCRIPTIONS[Math.min(index, EVAC_DESCRIPTIONS.length - 1)],
      }));

    return prioritized;
  });
