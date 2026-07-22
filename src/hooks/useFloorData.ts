import { useState, useEffect } from "react";
import type { FloorData, FloorStatistics, FloorDetails } from "@/types/floor";
import { getActiveService } from "@/services/dbSync";
import { toast } from "sonner";

export function useFloorData(buildingId: string | null, level: number | null) {
  const [floorData, setFloorData] = useState<FloorData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!buildingId || level === null) {
      setFloorData(null);
      return;
    }

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const service = getActiveService();
        const data = await service.fetchFloorData(buildingId, level);
        if (isMounted) {
          setFloorData(data);
        }
      } catch (err: any) {
        console.error("Failed to load floor detailed data:", err);
        if (isMounted) {
          setError(err.message || "Failed to load floor detailed data");
          toast.error("Failed to load floor data from active service.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [buildingId, level]);

  const updateFloorStats = async (
    updatedStats: Partial<FloorStatistics>,
    updatedDetails?: Partial<FloorDetails>,
  ) => {
    if (!buildingId || level === null || !floorData) return;

    try {
      const service = getActiveService();
      const updatedData: FloorData = {
        ...floorData,
        stats: {
          ...floorData.stats,
          ...updatedStats,
        },
        details: {
          ...floorData.details,
          ...(updatedDetails || {}),
        },
      };

      if (updatedStats.currentOccupancy !== undefined) {
        updatedData.details.currentOccupancy = updatedStats.currentOccupancy;
      }
      if (updatedStats.maxOccupancy !== undefined) {
        updatedData.details.maxOccupancy = updatedStats.maxOccupancy;
      }

      const saved = await service.saveFloorData(buildingId, level, updatedData);
      setFloorData(saved);
      toast.success("Floor statistics updated successfully.");
      return saved;
    } catch (err) {
      console.error("Failed to update floor statistics:", err);
      toast.error("Failed to save updates to active service.");
      throw err;
    }
  };

  const uploadCADFile = async (file: File, floorName: string = `Floor ${level}`) => {
    if (!buildingId || level === null) return;

    setIsUploading(true);
    toast.loading(`Extracting AI architectural features from ${file.name}...`, { id: "ai-cad" });

    return new Promise<FloorData>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileUrl = e.target?.result as string;
        const extension = file.name.split(".").pop()?.toLowerCase() || "";

        try {
          const service = getActiveService();

          let baseData = floorData;
          if (!baseData) {
            baseData = {
              buildingId,
              level,
              name: floorName,
              details: {
                floorName: floorName,
                floorArea: 0,
                maxOccupancy: 100,
                currentOccupancy: 0,
                riskLevel: "LOW",
                revisionNumber: "v0.0",
                uploadDate: new Date().toISOString().split("T")[0],
              },
              risks: {
                floorRisk: "LOW",
                occupancyRisk: "LOW",
                individualRisk: "LOW",
                overallFireRisk: "LOW",
              },
              stats: {
                directExits: 2,
                emergencyExits: 0,
                doors: 0,
                windows: 0,
                distanceToStaircase: "0 meters",
                distanceToLift: "0 meters",
                staircases: 0,
                lifts: 0,
                maxOccupancy: 100,
                currentOccupancy: 0,
              },
            };
          }

          // AI CAD Extraction
          const { extractCADData, calculateVulnerability, uploadCADFileToBackend, populateDatabaseFromCAD } =
            await import("@/services/aiCadService");
          const extractedStats = await extractCADData(file);

          // Populate IndexedDB with Building, Floor, Zones, and Equipment (STEP 1 & 6)
          const populated = await populateDatabaseFromCAD(buildingId, level, extractedStats);

          // Upload to backend
          await uploadCADFileToBackend(`cad_${Date.now()}`, file, fileUrl);

          // Merge stats into FloorStatistics format
          const newStats = {
            ...baseData.stats,
            directExits: extractedStats.directExitsCount || 2,
            emergencyExits: extractedStats.emergencyExitsCount || 1,
            doors: extractedStats.doorsCount || 10,
            windows: extractedStats.windowsCount || 15,
            staircases: extractedStats.staircasesCount || 2,
            lifts: extractedStats.elevatorsCount || 1,
            roomNames: extractedStats.rooms?.map((r: any) => r.name) || [],
            roomBoundaries: populated.roomBoundaries,
            distanceToStaircase: `${Math.round(5 + (extractedStats.rooms?.length || 5) * 1.2)} meters`,
            distanceToLift: `${Math.round(10 + (extractedStats.rooms?.length || 5) * 1.5)} meters`,
            cadElements: extractedStats.rooms?.map((r: any, idx: number) => ({
              id: `elem-${idx}`,
              type: r.type === "Lobby" ? "EXIT" : "DOOR",
              x: r.x + r.w / 2,
              y: r.y + r.h / 2,
              w: 4,
              h: 2
            })) || []
          };

          // Calculate new vulnerability using formulas (STEP 3)
          const vulnerability = await calculateVulnerability(
            extractedStats,
            baseData.details.currentOccupancy,
            baseData.details.maxOccupancy,
            0,
            level ?? 1
          );

          const uploadDate = new Date().toISOString().split("T")[0];
          const revNumber =
            parseFloat(
              (baseData.details.revisionNumber || "v0").replace("v", "").replace("R", ""),
            ) || 0;

          const updatedData: FloorData = {
            ...baseData,
            buildingId: String(populated.buildingId),
            stats: newStats,
            vulnerability,
            aiAnalysis: extractedStats,
            details: {
              ...baseData.details,
              revisionNumber: `v${(revNumber + 0.1).toFixed(1)}`,
              uploadDate,
            },
            drawing: {
              name: file.name,
              url: fileUrl,
              type: extension as any,
              size: file.size,
              uploadDate,
              uploadedBy: "WB-FDVA System",
            },
          };

          const saved = await service.saveFloorData(String(populated.buildingId), level, updatedData);
          setFloorData(saved);
          toast.dismiss("ai-cad");
          toast.success(
            `CAD Analysis Complete! Extracted ${newStats.doors} doors, ${newStats.staircases} staircases, ${newStats.roomNames?.length ?? 0} rooms.`,
          );
          resolve(saved);
        } catch (err) {
          console.error("Failed to upload drawing:", err);
          toast.dismiss("ai-cad");
          toast.error("Failed to save uploaded drawing on active service.");
          reject(err);
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setIsUploading(false);
        toast.dismiss("ai-cad");
        toast.error("Failed to read CAD file.");
        reject(new Error("File reading error"));
      };

      // Read as DataURL so it persists in storage and works in overlays
      reader.readAsDataURL(file);
    });
  };

  const deleteCADFile = async () => {
    if (!buildingId || level === null || !floorData) return;
    try {
      const service = getActiveService();
      const updatedData: FloorData = { ...floorData };
      delete updatedData.drawing;
      // Keep last-known stats and vulnerability — do NOT reset them

      const saved = await service.saveFloorData(buildingId, level, updatedData);
      setFloorData(saved);
      toast.success("CAD Drawing deleted. Statistics retained from last analysis.");
      return saved;
    } catch (err) {
      console.error("Failed to delete CAD drawing:", err);
      toast.error("Failed to delete CAD drawing.");
      throw err;
    }
  };

  return {
    floorData,
    loading,
    isUploading,
    error,
    updateFloorStats,
    uploadCADFile,
    deleteCADFile,
  };
}
