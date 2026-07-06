import { db } from "@/lib/db";
import { googleSheetsService } from "./googleSheets";

// Define a global flag on window to prevent syncing to cloud during initial bulk download
declare global {
  interface Window {
    __DISABLE_SYNC_HOOKS__?: boolean;
  }
}

export async function syncFullDatabase() {
  console.log("[WB-FDVA] Starting full database sync from Google Sheets...");

  try {
    const data = await googleSheetsService.fetchFullDatabase();

    // Disable hooks so we don't accidentally push this data back to the cloud
    window.__DISABLE_SYNC_HOOKS__ = true;

    // Clear and populate Dexie
    const tables = [
      "buildings",
      "floors",
      "zones",
      "personnel",
      "incidents",
      "occupancy",
      "activity",
    ] as const;

    for (const table of tables) {
      if (data[table] && Array.isArray(data[table])) {
        await db.table(table).clear();

        // Ensure numeric IDs are preserved as numbers for local Dexie indexes where necessary
        const rows = data[table].map((row: any) => {
          const parsedId = Number(row.id);
          return {
            ...row,
            id: isNaN(parsedId) ? row.id : parsedId,
          };
        });

        if (rows.length > 0) {
          await db.table(table).bulkAdd(rows);
        }
      }
    }
    console.log("[WB-FDVA] Full database sync complete.");
  } catch (err) {
    console.error("[WB-FDVA] Failed to sync database:", err);
  } finally {
    window.__DISABLE_SYNC_HOOKS__ = false;
  }
}

export function attachDexieHooks() {
  console.log("[WB-FDVA] Attaching Dexie hooks for Google Sheets sync...");
  const tables = [
    "buildings",
    "floors",
    "zones",
    "personnel",
    "incidents",
    "occupancy",
    "activity",
  ];

  tables.forEach((tableName) => {
    db.table(tableName).hook("creating", function (primKey, obj, trans) {
      if (window.__DISABLE_SYNC_HOOKS__) return;
      // Fire and forget after the item is saved and we have the final ID
      this.onsuccess = function (generatedPrimaryKey) {
        const finalObj = { ...obj, id: generatedPrimaryKey };
        googleSheetsService.remoteCreate(tableName, finalObj).catch((e) => console.error(e));
      };
    });

    db.table(tableName).hook("updating", function (mods, primKey, obj, trans) {
      if (window.__DISABLE_SYNC_HOOKS__) return;
      googleSheetsService
        .remoteUpdate(tableName, primKey as string | number, { ...obj, ...mods })
        .catch((e) => console.error(e));
    });

    db.table(tableName).hook("deleting", function (primKey, obj, trans) {
      if (window.__DISABLE_SYNC_HOOKS__) return;
      googleSheetsService.remoteDelete(tableName, primKey as string | number).catch((e) => console.error(e));
    });
  });
}

// -------------------------------------------------------------
// Pass-throughs for legacy UI imports so we don't break them
// -------------------------------------------------------------

export function getActiveService() {
  return googleSheetsService;
}

export async function syncFromService() {
  await syncFullDatabase();
}

export async function createBuildingOnService(buildingData: any) {
  const localId = buildingData.id || Math.floor(Math.random() * 100000);
  const toAdd = { ...buildingData, id: localId };
  // Pushing to local Dexie will automatically trigger the "creating" hook!
  await db.buildings.put(toAdd);
  return toAdd;
}

export async function updateBuildingOnService(id: string, updates: any) {
  const localId = isNaN(Number(id)) ? id : Number(id);
  const match = await db.buildings.get(localId as any);
  if (match) {
    await db.buildings.update(match.id!, updates);
  } else {
    const matchByName = await db.buildings
      .where("name")
      .equals(updates.name || "")
      .first();
    if (matchByName) {
      await db.buildings.update(matchByName.id!, updates);
    }
  }
  return { ...match, ...updates };
}

export async function deleteBuildingFromService(id: string) {
  const localId = isNaN(Number(id)) ? id : Number(id);
  await db.buildings.delete(localId as any);
  // Also cascade
  const floors = await db.floors.where("buildingId").equals(localId).toArray();
  for (const f of floors) {
    await db.floors.delete(f.id!);
  }
}

export async function createFloorOnService(floorData: any) {
  const localId = floorData.id || Math.floor(Math.random() * 100000);
  const toAdd = {
    ...floorData,
    id: localId,
    buildingId: Number(floorData.buildingId) || floorData.buildingId,
  };
  await db.floors.put(toAdd);
  return toAdd;
}

export async function updateFloorOnService(
  id: string,
  updates: any,
  buildingId: number,
  level: number,
) {
  const localId = isNaN(Number(id)) ? id : Number(id);
  const match = await db.floors.get(localId as any);
  if (match) {
    await db.floors.update(match.id!, updates);
  } else {
    const altMatch = await db.floors
      .where("buildingId")
      .equals(buildingId)
      .and((f) => f.level === level)
      .first();
    if (altMatch) {
      await db.floors.update(altMatch.id!, updates);
    }
  }
  return { ...match, ...updates };
}

export async function deleteFloorFromService(id: string, buildingId: number, level: number) {
  const localId = isNaN(Number(id)) ? id : Number(id);
  const match = await db.floors.get(localId as any);
  if (match) {
    await db.floors.delete(match.id!);
  } else {
    const altMatch = await db.floors
      .where("buildingId")
      .equals(buildingId)
      .and((f) => f.level === level)
      .first();
    if (altMatch) {
      await db.floors.delete(altMatch.id!);
    }
  }
}
