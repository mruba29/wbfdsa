import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useMemo, useEffect } from "react";
import { db } from "@/lib/db";
import { seedAllModules } from "@/lib/seed";
import { AppShell } from "@/components/app-shell";
import {
  Flame,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  Layers,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/fire-inventory")({
  validateSearch: z.object({
    filter: z.enum(["all", "active", "expired", "maintenance"]).optional().default("all"),
  }),
  component: FireInventoryPage,
});

const CAMPUSES = ["All Campuses", "CM", "Velam Mall", "Sangam Mall"];

function FireInventoryPage() {
  const { filter } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(filter);

  // Filters required by Requirement 6: Campus, Building, Floor
  const [selectedCampus, setSelectedCampus] = useState("All Campuses");
  const [selectedBuilding, setSelectedBuilding] = useState("All Buildings");
  const [selectedFloor, setSelectedFloor] = useState("All Floors");

  // Query Database
  const rawInventory = useLiveQuery(() => db.fireInventory.toArray(), []);
  const buildings = useLiveQuery(() => db.buildings.toArray(), []) ?? [];

  useEffect(() => {
    if (rawInventory !== undefined && rawInventory.length === 0) {
      console.log("[WB-FDVA] Fire inventory table empty. Seeding all modules...");
      seedAllModules().catch((err) => console.error("Fire inventory seed error:", err));
    }
  }, [rawInventory]);


  // Compute status on the fly based on dates
  const processedInventory = useMemo(() => {
    return (rawInventory ?? []).map((item) => {
      const isExpired = new Date() > new Date(item.expiryDate);
      const isMaintenanceDue = new Date() > new Date(item.maintenanceDueDate);

      let computedStatus = item.status;
      if (computedStatus !== "Under Maintenance") {
        if (isExpired) computedStatus = "Expired";
        else if (isMaintenanceDue) computedStatus = "Under Maintenance";
        else computedStatus = "Active";
      }
      return { ...item, computedStatus };
    });
  }, [rawInventory]);

  // List of available building names for the filter
  const buildingOptions = useMemo(() => {
    return ["All Buildings", ...Array.from(new Set(buildings.map((b) => b.name)))];
  }, [buildings]);

  // List of available floor options for the selected building
  const floorOptions = useMemo(() => {
    return ["All Floors", "Level 1", "Level 2", "Level 3", "Floor 1", "Floor 2", "Basement 1"];
  }, []);

  // Filter fire safety equipment items strictly by selected Campus, Building, and Floor
  const filteredInventory = useMemo(() => {
    return processedInventory.filter((item) => {
      // Search match
      const matchesSearch =
        item.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
        item.inventoryId.toLowerCase().includes(search.toLowerCase()) ||
        item.building.toLowerCase().includes(search.toLowerCase()) ||
        item.zoneRoom.toLowerCase().includes(search.toLowerCase());

      // Status match
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.computedStatus === "Active") ||
        (statusFilter === "expired" && item.computedStatus === "Expired") ||
        (statusFilter === "maintenance" && item.computedStatus === "Under Maintenance");

      // Campus match (check if building matches campus owner or name)
      const bObj = buildings.find((b) => b.name.toLowerCase() === item.building.toLowerCase());
      const matchesCampus =
        selectedCampus === "All Campuses" ||
        (bObj && bObj.ownerName === selectedCampus) ||
        item.building.includes(selectedCampus);

      // Building match
      const matchesBuilding =
        selectedBuilding === "All Buildings" ||
        item.building.toLowerCase().includes(selectedBuilding.toLowerCase());

      // Floor match
      const matchesFloor =
        selectedFloor === "All Floors" ||
        item.floor.toLowerCase().includes(selectedFloor.toLowerCase());

      return matchesSearch && matchesStatus && matchesCampus && matchesBuilding && matchesFloor;
    });
  }, [
    processedInventory,
    search,
    statusFilter,
    selectedCampus,
    selectedBuilding,
    selectedFloor,
    buildings,
  ]);

  // Stats for KPIs
  const total = filteredInventory.length;
  const activeCount = filteredInventory.filter((i) => i.computedStatus === "Active").length;
  const expiredCount = filteredInventory.filter((i) => i.computedStatus === "Expired").length;
  const maintenanceCount = filteredInventory.filter(
    (i) => i.computedStatus === "Under Maintenance",
  ).length;

  const handleAddItem = async () => {
    const id = `FI-${Math.floor(Math.random() * 10000)}`;
    await db.fireInventory.add({
      inventoryId: id,
      equipmentName: "CO2 Fire Extinguisher 5kg",
      equipmentType: "Fire Extinguisher",
      building: selectedBuilding !== "All Buildings" ? selectedBuilding : "Building A (Corporate HQ)",
      floor: selectedFloor !== "All Floors" ? selectedFloor : "Level 1",
      zoneRoom: "Server Room A",
      quantity: 2,
      installationDate: "2024-01-15",
      lastInspectionDate: "2024-06-15",
      expiryDate: "2026-01-15",
      maintenanceDueDate: "2024-12-15",
      status: "Active",
      assignedMaintenanceTeam: "Alpha Safety",
      remarks: "IoT Sensor Ready",
    });
    toast.success(`Fire safety equipment item ${id} added`);
  };

  return (
    <AppShell
      title="Fire Safety Inventory Management"
      subtitle="Track, monitor, and maintain fire safety equipment per building and floor"
      actions={
        <Button onClick={handleAddItem} className="gap-2 bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground block mb-1">
              Total Equipment
            </span>
            <div className="text-2xl font-extrabold text-foreground">{total}</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1 mb-1">
              <CheckCircle className="h-3.5 w-3.5" /> Active Equipment
            </span>
            <div className="text-2xl font-extrabold text-emerald-500">{activeCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-rose-500 flex items-center gap-1 mb-1">
              <XCircle className="h-3.5 w-3.5" /> Expired Equipment
            </span>
            <div className="text-2xl font-extrabold text-rose-500">{expiredCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-amber-500 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Under Maintenance
            </span>
            <div className="text-2xl font-extrabold text-amber-500">{maintenanceCount}</div>
          </div>
        </div>

        {/* Horizontal Filter Bar: Campus, Building, Floor */}
        <div className="p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Filter className="h-4 w-4 text-primary" /> Filter Fire Safety Equipment By Hierarchy:
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search equipment, ID, or room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 text-xs"
              />
            </div>

            {/* Campus Selector */}
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>
                  Campus: {c}
                </option>
              ))}
            </select>

            {/* Building Selector */}
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              {buildingOptions.map((b) => (
                <option key={b} value={b}>
                  Building: {b}
                </option>
              ))}
            </select>

            {/* Floor Selector */}
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              {floorOptions.map((f) => (
                <option key={f} value={f}>
                  Floor: {f}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              <option value="all">Status: All</option>
              <option value="active">Active Only</option>
              <option value="expired">Expired Only</option>
              <option value="maintenance">Maintenance Only</option>
            </select>
          </div>
        </div>

        {/* Equipment Table */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-bold">Equipment ID</th>
                  <th className="py-3 px-4 font-bold">Equipment Name</th>
                  <th className="py-3 px-4 font-bold">Type</th>
                  <th className="py-3 px-4 font-bold">Building</th>
                  <th className="py-3 px-4 font-bold">Floor / Room</th>
                  <th className="py-3 px-4 font-bold">Expiry Date</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => {
                    const isExpired = item.computedStatus === "Expired";
                    const isMaint = item.computedStatus === "Under Maintenance";

                    return (
                      <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-primary">{item.inventoryId}</td>
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {item.equipmentName}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">{item.equipmentType}</td>
                        <td className="py-3.5 px-4 font-medium text-foreground">{item.building}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {item.floor} - {item.zoneRoom}
                        </td>
                        <td className="py-3.5 px-4 font-medium">{item.expiryDate}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isExpired
                                ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                                : isMaint
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            }`}
                          >
                            {item.computedStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No fire equipment found matching the selected Campus, Building, and Floor filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
