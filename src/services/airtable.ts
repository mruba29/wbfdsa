import { getBackendConfig } from "./config";
import type { FloorData } from "@/types/floor";

// Storage keys for localStorage-based simulation
const STORAGE_KEY = "wb_fdva_mock_airtable";

// Reuse the same initial mock structure
import { googleSheetsService } from "./googleSheets";

function getStoredData(): any {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // For simplicity, Airtable mock is initialized with the same default mock data
    const data = JSON.parse(localStorage.getItem("wb_fdva_mock_google_sheets") || "null");
    const defaultData = data || { buildings: [], floors: [], floorDetailedData: {} };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(stored);
}

function saveStoredData(data: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

// Helper to make Airtable HTTP requests
async function airtableRequest(
  tableName: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: any,
  recordId?: string,
): Promise<any> {
  const config = getBackendConfig();
  if (config.useMockFallback || !config.airtableApiKey || !config.airtableBaseId) {
    return null; // Trigger mock
  }

  const url = `https://api.airtable.com/v0/${config.airtableBaseId}/${tableName}${recordId ? `/${recordId}` : ""}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.airtableApiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Airtable error: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Airtable operation failed on ${tableName}:`, err);
    throw err;
  }
}

export const airtableService = {
  // --- Buildings CRUD ---
  async fetchBuildings(): Promise<any[]> {
    const remote = await airtableRequest("Buildings");
    if (remote?.records) {
      return remote.records.map((r: any) => ({
        id: r.id,
        ...r.fields,
      }));
    }

    const data = getStoredData();
    return data.buildings;
  },

  async createBuilding(building: any): Promise<any> {
    const fields = { ...building };
    delete fields.id;
    const remote = await airtableRequest("Buildings", "POST", { fields });
    if (remote?.id) {
      return { id: remote.id, ...remote.fields };
    }

    const data = getStoredData();
    const newBuilding = {
      ...building,
      id: "rec_" + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
    };
    data.buildings.push(newBuilding);
    saveStoredData(data);
    return newBuilding;
  },

  async updateBuilding(id: string, updates: any): Promise<any> {
    const fields = { ...updates };
    delete fields.id;
    const remote = await airtableRequest("Buildings", "PATCH", { fields }, id);
    if (remote?.id) {
      return { id: remote.id, ...remote.fields };
    }

    const data = getStoredData();
    const index = data.buildings.findIndex((b: any) => b.id === id);
    if (index !== -1) {
      data.buildings[index] = { ...data.buildings[index], ...updates };
      saveStoredData(data);
      return data.buildings[index];
    }
    throw new Error("Building not found");
  },

  async deleteBuilding(id: string): Promise<void> {
    const remote = await airtableRequest("Buildings", "DELETE", undefined, id);
    if (remote) return;

    const data = getStoredData();
    data.buildings = data.buildings.filter((b: any) => b.id !== id);
    data.floors = data.floors.filter((f: any) => f.buildingId !== id);
    // clean up floor details
    Object.keys(data.floorDetailedData).forEach((key) => {
      if (key.startsWith(id + "_")) {
        delete data.floorDetailedData[key];
      }
    });
    saveStoredData(data);
  },

  // --- Floors CRUD ---
  async fetchFloors(buildingId: string): Promise<any[]> {
    // In Airtable, we can filter using formula: {buildingId} = 'buildingId'
    const filter = `filterByFormula=AND({buildingId}='${buildingId}')`;
    const remote = await airtableRequest(`Floors?${encodeURI(filter)}`);
    if (remote?.records) {
      return remote.records.map((r: any) => ({
        id: r.id,
        ...r.fields,
      }));
    }

    const data = getStoredData();
    return data.floors.filter((f: any) => f.buildingId === buildingId);
  },

  async createFloor(floor: any): Promise<any> {
    const fields = { ...floor };
    delete fields.id;
    const remote = await airtableRequest("Floors", "POST", { fields });
    if (remote?.id) {
      return { id: remote.id, ...remote.fields };
    }

    const data = getStoredData();
    const newFloor = {
      ...floor,
      id: "rec_" + Math.random().toString(36).substr(2, 9),
    };
    data.floors.push(newFloor);
    saveStoredData(data);
    return newFloor;
  },

  async updateFloor(id: string, updates: any): Promise<any> {
    const fields = { ...updates };
    delete fields.id;
    const remote = await airtableRequest("Floors", "PATCH", { fields }, id);
    if (remote?.id) {
      return { id: remote.id, ...remote.fields };
    }

    const data = getStoredData();
    const index = data.floors.findIndex((f: any) => f.id === id);
    if (index !== -1) {
      data.floors[index] = { ...data.floors[index], ...updates };
      saveStoredData(data);
      return data.floors[index];
    }
    throw new Error("Floor not found");
  },

  async deleteFloor(id: string): Promise<void> {
    const remote = await airtableRequest("Floors", "DELETE", undefined, id);
    if (remote) return;

    const data = getStoredData();
    const floor = data.floors.find((f: any) => f.id === id);
    if (floor) {
      const key = `${floor.buildingId}_${floor.level}`;
      delete data.floorDetailedData[key];
    }
    data.floors = data.floors.filter((f: any) => f.id !== id);
    saveStoredData(data);
  },

  // --- Floor Detailed Data ---
  async fetchFloorData(buildingId: string, level: number): Promise<FloorData | null> {
    const filter = `filterByFormula=AND({buildingId}='${buildingId}',{level}=${level})`;
    const remote = await airtableRequest(`FloorDetails?${encodeURI(filter)}`);
    if (remote?.records && remote.records.length > 0) {
      const fields = remote.records[0].fields;
      // Re-map flat airtable fields to nested FloorData structure
      return {
        id: remote.records[0].id,
        buildingId: fields.buildingId,
        level: Number(fields.level),
        name: fields.name,
        details: {
          floorName: fields.floorName,
          floorArea: Number(fields.floorArea),
          maxOccupancy: Number(fields.maxOccupancy),
          currentOccupancy: Number(fields.currentOccupancy),
          riskLevel: fields.riskLevel,
          revisionNumber: fields.revisionNumber,
          uploadDate: fields.uploadDate,
        },
        risks: {
          floorRisk: fields.floorRisk,
          occupancyRisk: fields.occupancyRisk,
          individualRisk: fields.individualRisk,
          overallFireRisk: fields.overallFireRisk,
        },
        stats: {
          directExits: Number(fields.directExits),
          emergencyExits: Number(fields.emergencyExits || 0),
          doors: Number(fields.doors),
          windows: Number(fields.windows),
          distanceToStaircase: fields.distanceToStaircase,
          distanceToLift: fields.distanceToLift || "N/A",
          staircases: Number(fields.staircases),
          lifts: Number(fields.lifts),
          maxOccupancy: Number(fields.maxOccupancy),
          currentOccupancy: Number(fields.currentOccupancy),
          roomNames: fields.roomNames ? JSON.parse(fields.roomNames) : undefined,
          roomBoundaries: fields.roomBoundaries ? JSON.parse(fields.roomBoundaries) : undefined,
          cadElements: fields.cadElements ? JSON.parse(fields.cadElements) : undefined,
        },
        drawing: fields.drawingName
          ? {
              name: fields.drawingName,
              url: fields.drawingUrl || "",
              type: fields.drawingType,
            }
          : undefined,
      };
    }

    const data = getStoredData();
    const key = `${buildingId}_${level}`;
    const detailed = data.floorDetailedData[key];
    if (detailed) return detailed;

    // Return a default floor structure if none exists
    const floorMeta = data.floors.find(
      (f: any) => f.buildingId === buildingId && f.level === level,
    );
    return {
      buildingId,
      level,
      name: floorMeta?.name || `Floor ${level}`,
      details: {
        floorName: floorMeta?.name || `Floor ${level}`,
        floorArea: 1500,
        maxOccupancy: 100,
        currentOccupancy: 0,
        riskLevel: "LOW",
        revisionNumber: "v1.0",
        uploadDate: new Date().toISOString().split("T")[0],
      },
      risks: {
        floorRisk: "LOW",
        occupancyRisk: "LOW",
        individualRisk: "LOW",
        overallFireRisk: "LOW",
      },
      stats: {
        directExits: floorMeta?.totalExits || 2,
        emergencyExits: 1,
        doors: 10,
        windows: 15,
        distanceToStaircase: "15 meters",
        distanceToLift: "20 meters",
        staircases: 2,
        lifts: 1,
        maxOccupancy: 100,
        currentOccupancy: 0,
      },
    };
  },

  async saveFloorData(buildingId: string, level: number, floorData: FloorData): Promise<FloorData> {
    // Flat mapping to store in Airtable fields
    const fields = {
      buildingId,
      level,
      name: floorData.name,
      floorName: floorData.details.floorName,
      floorArea: floorData.details.floorArea,
      maxOccupancy: floorData.details.maxOccupancy,
      currentOccupancy: floorData.details.currentOccupancy,
      riskLevel: floorData.details.riskLevel,
      revisionNumber: floorData.details.revisionNumber,
      uploadDate: floorData.details.uploadDate,
      floorRisk: floorData.risks.floorRisk,
      occupancyRisk: floorData.risks.occupancyRisk,
      individualRisk: floorData.risks.individualRisk,
      overallFireRisk: floorData.risks.overallFireRisk,
      directExits: floorData.stats.directExits,
      doors: floorData.stats.doors,
      windows: floorData.stats.windows,
      distanceToStaircase: floorData.stats.distanceToStaircase,
      staircases: floorData.stats.staircases,
      lifts: floorData.stats.lifts,
      roomNames: floorData.stats.roomNames ? JSON.stringify(floorData.stats.roomNames) : "",
      roomBoundaries: floorData.stats.roomBoundaries ? JSON.stringify(floorData.stats.roomBoundaries) : "",
      cadElements: floorData.stats.cadElements ? JSON.stringify(floorData.stats.cadElements) : "",
      drawingName: floorData.drawing?.name || "",
      drawingUrl: floorData.drawing?.url || "",
      drawingType: floorData.drawing?.type || "",
    };

    // Check if record exists to perform patch or post
    const filter = `filterByFormula=AND({buildingId}='${buildingId}',{level}=${level})`;
    const check = await airtableRequest(`FloorDetails?${encodeURI(filter)}`);

    if (check?.records && check.records.length > 0) {
      const recordId = check.records[0].id;
      const remote = await airtableRequest("FloorDetails", "PATCH", { fields }, recordId);
      if (remote) floorData.id = remote.id;
    } else {
      const remote = await airtableRequest("FloorDetails", "POST", { fields });
      if (remote) floorData.id = remote.id;
    }

    const data = getStoredData();
    const key = `${buildingId}_${level}`;
    data.floorDetailedData[key] = {
      ...floorData,
      buildingId,
      level,
    };

    // Keep basic Floor record sync'd up as well
    const floorMetaIndex = data.floors.findIndex(
      (f: any) => f.buildingId === buildingId && f.level === level,
    );
    if (floorMetaIndex !== -1) {
      data.floors[floorMetaIndex].totalExits = floorData.stats.directExits;
      data.floors[floorMetaIndex].availableExits = floorData.stats.directExits;
      data.floors[floorMetaIndex].name = floorData.details.floorName;
    }

    saveStoredData(data);
    return data.floorDetailedData[key];
  },
};
