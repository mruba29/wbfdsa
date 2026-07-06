import { getBackendConfig } from "./config";
import type { FloorData } from "@/types/floor";

// Storage keys for localStorage-based simulation
const STORAGE_KEY = "wb_fdva_mock_google_sheets";

function getStoredData(): any {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const defaultData = { buildings: [], floors: [], floorDetailedData: {} };
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

// Helper to execute REST fetch to Google Sheets App Script (Web App)
async function googleSheetsRequest(action: string, payload?: any): Promise<any> {
  const config = getBackendConfig();
  const webAppUrl = config.googleSheetsWebAppUrl || config.googleSheetsApiKey;

  if (!webAppUrl || !webAppUrl.startsWith("http")) {
    console.warn("[WB-FDVA] No valid Web App URL configured. Cannot sync with Google Sheets.");
    throw new Error("No valid Web App URL configured.");
  }

  try {
    const requestBody = JSON.stringify({ action, payload });
    console.log("[WB-FDVA] → Request URL:", webAppUrl);
    console.log(`[WB-FDVA] → Action: ${action}`, payload || "");

    // Using text/plain avoids CORS preflight OPTIONS request
    const res = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: requestBody,
    });

    if (!res.ok) {
      throw new Error(`Google Sheets HTTP Error: ${res.status}`);
    }

    const text = await res.text();

    try {
      const json = JSON.parse(text);
      if (!json.success) {
        throw new Error(json.error || "Unknown Apps Script error");
      }
      return json;
    } catch (parseErr) {
      throw new Error("Invalid JSON response from Google Sheets");
    }
  } catch (err) {
    console.error("[WB-FDVA] ✗ fetch threw:", err);
    throw err;
  }
}

export const googleSheetsService = {
  async fetchFullDatabase(): Promise<any> {
    const remote = await googleSheetsRequest("FETCH_ALL");
    return remote.data;
  },

  async remoteCreate(table: string, data: any): Promise<any> {
    const remote = await googleSheetsRequest("CREATE", { table, data });
    return remote.data;
  },

  async remoteUpdate(table: string, id: string | number, data: any): Promise<any> {
    const remote = await googleSheetsRequest("UPDATE", { table, id, data });
    return remote.data;
  },

  async remoteDelete(table: string, id: string | number): Promise<void> {
    await googleSheetsRequest("DELETE", { table, id });
  },

  async fetchFloorData(buildingId: string, level: number): Promise<FloorData | null> {
    const data = getStoredData();
    const key = `${buildingId}_${level}`;
    const detailed = data.floorDetailedData?.[key];
    if (detailed) return detailed;

    const floorMeta = data.floors?.find(
      (f: any) => f.buildingId == buildingId && f.level == level,
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
    const data = getStoredData();
    if (!data.floorDetailedData) data.floorDetailedData = {};
    const key = `${buildingId}_${level}`;
    
    data.floorDetailedData[key] = {
      ...floorData,
      buildingId,
      level,
    };

    if (data.floors) {
      const floorMetaIndex = data.floors.findIndex(
        (f: any) => f.buildingId == buildingId && f.level == level,
      );
      if (floorMetaIndex !== -1) {
        data.floors[floorMetaIndex].totalExits = floorData.stats.directExits;
        data.floors[floorMetaIndex].availableExits = floorData.stats.directExits;
        data.floors[floorMetaIndex].name = floorData.details.floorName;
      }
    }

    saveStoredData(data);
    return data.floorDetailedData[key];
  },
};
