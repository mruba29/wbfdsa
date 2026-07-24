import { db, type Zone, type FireInventory, type Floor } from "@/lib/db";
import { ExtractedBuildingFeatures } from "./featureExtraction";
import { TenPointLLMAnalysis } from "./llmCADAnalysis";
import { assessBuilding } from "@/lib/vulnerability";
import { toast } from "sonner";

export interface SyncResult {
  zonesCount: number;
  inventoryCount: number;
  buildingVulnerability: any;
  success: boolean;
}

/**
 * Automatically dispatches extracted CAD/floor plan features to WB-FDVA modules:
 * 1. Floor Plans (db.zones, db.floors)
 * 2. Vulnerability Assessment (recomputes risk scores)
 * 3. AI Building Analysis (caches 10-point LLM twin report)
 * 4. Fire Risk Calculation (updates fireInventory & IVA metrics)
 */
export async function syncExtractedFeaturesToWBFDVA(
  buildingId: number,
  floorLevel: number,
  features: ExtractedBuildingFeatures,
  llmAnalysis: TenPointLLMAnalysis
): Promise<SyncResult> {
  try {
    // 1. Get or create floor record in Dexie
    let floors = await db.floors.where("buildingId").equals(buildingId).toArray();
    let targetFloor = floors.find((f) => f.level === floorLevel);

    if (!targetFloor) {
      const floorId = await db.floors.add({
        buildingId,
        level: floorLevel,
        name: `Floor ${floorLevel}`,
        totalExits: features.architectural.fireExitsCount,
        availableExits: features.architectural.fireExitsCount,
        blockedExits: 0,
        elevatorWorking: true,
      });
      targetFloor = (await db.floors.get(floorId))!;
    } else {
      await db.floors.update(targetFloor.id!, {
        totalExits: features.architectural.fireExitsCount,
        availableExits: features.architectural.fireExitsCount,
      });
    }

    const fId = targetFloor.id!;

    // 2. Sync Extracted Rooms -> db.zones
    // First, remove previous auto-generated zones for this floor to avoid duplicate bloat
    const existingZones = await db.zones.where("floorId").equals(fId).toArray();
    if (existingZones.length > 0) {
      await db.zones.bulkDelete(existingZones.map((z) => z.id!));
    }

    const zonesToInsert: Omit<Zone, "id">[] = features.extractedRoomsList.map((r, idx) => ({
      buildingId,
      floorId: fId,
      zoneId: `zone-${idx + 1}`,
      name: r.name,
      type: (["Lobby", "Office", "Corridor", "Conference", "Storage", "Server", "Patient", "Retail", "Classroom"].includes(r.type)
        ? r.type
        : "Office") as any,
      area: r.areaSqM,
      occupancy: r.occupancy,
      specialNeeds: r.type === "Server" || r.type === "Electrical" ? 0 : Math.round(r.occupancy * 0.1),
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    }));

    await db.zones.bulkAdd(zonesToInsert as any);

    // 3. Sync Extracted Fire Equipment -> db.fireInventory
    const buildingObj = await db.buildings.get(buildingId);
    const bName = buildingObj?.name || "Main Building";

    // Remove existing auto-extracted items for this floor
    const existingInventory = await db.fireInventory
      .where("building")
      .equals(bName)
      .and((item) => item.floor === `Floor ${floorLevel}`)
      .toArray();

    if (existingInventory.length > 0) {
      await db.fireInventory.bulkDelete(existingInventory.map((i) => i.id!));
    }

    const inventoryToInsert: Omit<FireInventory, "id">[] = features.extractedEquipmentList.map((eq) => ({
      serialNumber: eq.serialNumber,
      equipmentType: eq.type as any,
      building: bName,
      floor: `Floor ${floorLevel}`,
      zoneRoom: eq.roomName,
      status: eq.status,
      lastInspectionDate: new Date().toISOString().split("T")[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignedTechnician: "AI Auto-Auditor",
      x: eq.x,
      y: eq.y,
    }));

    await db.fireInventory.bulkAdd(inventoryToInsert as any);

    // 4. Update Building overall stats (total area, floors)
    if (buildingObj) {
      await db.buildings.update(buildingId, {
        totalArea: features.measurements.totalFloorAreaSqM,
        floors: Math.max(buildingObj.floors || 1, floorLevel),
        numberOfStaircases: features.architectural.staircasesCount,
        numberOfLifts: features.architectural.elevatorsCount,
        numberOfWindows: features.architectural.windowsCount,
      });
    }

    // 5. Cache LLM Twin Report for AI Analysis Module
    const twinCacheKey = `wbfdva_ai_twin_b${buildingId}_f${floorLevel}`;
    const twinPayload = {
      features,
      llmAnalysis,
      timestamp: Date.now(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(twinCacheKey, JSON.stringify(twinPayload));
    }

    // 6. Recalculate Vulnerability Assessment
    const buildingAssessment = await assessBuilding(buildingId);

    toast.success(
      `Extracted ${features.extractedRoomsList.length} rooms & ${features.extractedEquipmentList.length} fire gear items into WB-FDVA!`
    );

    return {
      zonesCount: features.extractedRoomsList.length,
      inventoryCount: features.extractedEquipmentList.length,
      buildingVulnerability: buildingAssessment,
      success: true,
    };
  } catch (err: any) {
    console.error("Failed to sync CAD extracted features to WB-FDVA:", err);
    toast.error(`Sync error: ${err.message || err}`);
    return {
      zonesCount: 0,
      inventoryCount: 0,
      buildingVulnerability: null,
      success: false,
    };
  }
}
