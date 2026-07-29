import { getBackendConfig } from "./config";
import { googleSheetsService } from "./googleSheets";
import { airtableService } from "./airtable";

export interface CadFileRecord {
  id?: string;
  campus: string;
  building: string;
  floor: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  uploadedBy: string;
  fileType: "DWG" | "DXF" | "PDF" | string;
  fileSize: string;
}

const STORAGE_KEY = "wb_fdva_cad_metadata_store";

// Initial seed metadata records for demonstration across campuses and buildings
const INITIAL_CAD_RECORDS: CadFileRecord[] = [
  {
    id: "cad-rec-001",
    campus: "CM",
    building: "Building A (Corporate HQ)",
    floor: "Floor 3",
    fileName: "BuildingA_Floor3_Architectural.dxf",
    fileUrl: "https://example.com/cad/BuildingA_Floor3_Architectural.dxf",
    uploadDate: "2026-07-20",
    uploadedBy: "Gautam (Safety Lead)",
    fileType: "DXF",
    fileSize: "4.2 MB",
  },
  {
    id: "cad-rec-002",
    campus: "Velam Mall",
    building: "Velam Commercial Tower",
    floor: "Floor 1",
    fileName: "Velam_Tower_Ground_Egress.dwg",
    fileUrl: "https://example.com/cad/Velam_Tower_Ground_Egress.dwg",
    uploadDate: "2026-07-22",
    uploadedBy: "Satya (BIM Engineer)",
    fileType: "DWG",
    fileSize: "6.8 MB",
  },
  {
    id: "cad-rec-003",
    campus: "Sangam Mall",
    building: "Sangam Complex",
    floor: "Floor 2",
    fileName: "Sangam_Complex_Level2_FireMap.pdf",
    fileUrl: "https://example.com/cad/Sangam_Complex_Level2_FireMap.pdf",
    uploadDate: "2026-07-25",
    uploadedBy: "Gautam (Safety Lead)",
    fileType: "PDF",
    fileSize: "2.1 MB",
  },
];

function getLocalCadStore(): CadFileRecord[] {
  if (typeof window === "undefined") return INITIAL_CAD_RECORDS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CAD_RECORDS));
    return INITIAL_CAD_RECORDS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_CAD_RECORDS;
  }
}

function saveLocalCadStore(records: CadFileRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

export const cadMetadataService = {
  /**
   * Fetch all stored CAD metadata records.
   * Syncs with Google Sheets / Airtable when configured, falling back to local persistent store.
   */
  async fetchCadMetadata(filters?: {
    campus?: string;
    building?: string;
    floor?: string;
  }): Promise<CadFileRecord[]> {
    const config = getBackendConfig();
    let records = getLocalCadStore();

    // If Google Sheets Web App is connected, attempt remote sync
    if (config.serviceType === "googleSheets" && config.googleSheetsWebAppUrl) {
      try {
        const remoteData = await googleSheetsService.fetchFullDatabase();
        if (remoteData && Array.isArray(remoteData.cadMetadata)) {
          records = remoteData.cadMetadata;
          saveLocalCadStore(records);
        }
      } catch (err) {
        console.warn("[CAD Metadata] Google Sheets remote fetch fallback to local store:", err);
      }
    }

    // Apply filters if provided
    return records.filter((r) => {
      if (filters?.campus && filters.campus !== "All Campuses" && r.campus !== filters.campus) {
        return false;
      }
      if (filters?.building && filters.building !== "All Buildings" && !r.building.toLowerCase().includes(filters.building.toLowerCase())) {
        return false;
      }
      if (filters?.floor && filters.floor !== "All Floors" && !r.floor.toLowerCase().includes(filters.floor.toLowerCase())) {
        return false;
      }
      return true;
    });
  },

  /**
   * Save a newly uploaded or updated CAD file metadata record.
   */
  async saveCadRecord(record: Omit<CadFileRecord, "id"> & { id?: string }): Promise<CadFileRecord> {
    const newRecord: CadFileRecord = {
      ...record,
      id: record.id || `cad-rec-${Date.now()}`,
      uploadDate: record.uploadDate || new Date().toISOString().split("T")[0],
      uploadedBy: record.uploadedBy || "On-Duty Officer",
    };

    const store = getLocalCadStore();
    const existingIndex = store.findIndex((r) => r.id === newRecord.id);

    if (existingIndex >= 0) {
      store[existingIndex] = newRecord;
    } else {
      store.unshift(newRecord);
    }
    saveLocalCadStore(store);

    // Sync to remote Google Sheets / Airtable backend if configured
    const config = getBackendConfig();
    if (config.serviceType === "googleSheets" && config.googleSheetsWebAppUrl) {
      try {
        await googleSheetsService.remoteCreate("cadMetadata", newRecord);
      } catch (err) {
        console.warn("[CAD Metadata] Remote sync error:", err);
      }
    }

    return newRecord;
  },

  /**
   * Delete a CAD metadata record by ID.
   */
  async deleteCadRecord(id: string): Promise<void> {
    const store = getLocalCadStore().filter((r) => r.id !== id);
    saveLocalCadStore(store);

    const config = getBackendConfig();
    if (config.serviceType === "googleSheets" && config.googleSheetsWebAppUrl) {
      try {
        await googleSheetsService.remoteDelete("cadMetadata", id);
      } catch (err) {
        console.warn("[CAD Metadata] Remote delete error:", err);
      }
    }
  },

  /**
   * Google Apps Script template for team collaborative management with Gautam & Satya.
   */
  getGoogleAppsScriptTemplate(): string {
    return `
/**
 * WB-FDVA Google Sheets Integration for Collaborative CAD & Building Management
 * Target Spreadsheet: Shared with Gautam & Satya
 * 
 * Instructions:
 * 1. Create a Google Sheet titled "WB-FDVA Master Storage"
 * 2. Share the sheet with Gautam and Satya with Edit permissions.
 * 3. Add tabs: "buildings", "floors", "cadMetadata", "fireInventory"
 * 4. Open Extensions > Apps Script, paste this script, and click "Deploy as Web App".
 * 5. Set Access to "Anyone".
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "FETCH_ALL") {
      return responseJSON({ success: true, data: getAllSheetData(ss) });
    }

    if (action === "CREATE") {
      var sheet = ss.getSheetByName(payload.table || "cadMetadata");
      if (!sheet) {
        sheet = ss.insertSheet(payload.table);
      }
      var headers = ["id", "campus", "building", "floor", "fileName", "fileUrl", "uploadDate", "uploadedBy", "fileType", "fileSize"];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      }
      var row = headers.map(function(h) { return payload.data[h] || ""; });
      sheet.appendRow(row);
      return responseJSON({ success: true, data: payload.data });
    }

    return responseJSON({ success: false, error: "Invalid action" });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllSheetData(ss) {
  var sheets = ss.getSheets();
  var result = {};
  sheets.forEach(function(sh) {
    var name = sh.getName();
    var values = sh.getDataRange().getValues();
    if (values.length < 2) {
      result[name] = [];
      return;
    }
    var headers = values[0];
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[i][j];
      }
      rows.push(obj);
    }
    result[name] = rows;
  });
  return result;
}
    `.trim();
  },
};
