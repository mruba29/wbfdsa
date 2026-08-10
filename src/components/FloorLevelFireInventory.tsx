import React, { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { seedAllModules } from "@/lib/seed";
import {
  Flame,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Calendar,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FloorLevelFireInventoryProps {
  buildingName: string;
  floorLevel: number;
  campusName?: string;
}

export function FloorLevelFireInventory({
  buildingName,
  floorLevel,
  campusName = "CM",
}: FloorLevelFireInventoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "maintenance">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for new Equipment
  const [newItem, setNewItem] = useState({
    equipmentName: "CO2 Fire Extinguisher 5kg",
    equipmentType: "Fire Extinguisher",
    zoneRoom: "Server Room A",
    quantity: 2,
    installationDate: new Date().toISOString().split("T")[0],
    lastInspectionDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    maintenanceDueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    assignedMaintenanceTeam: "Alpha Safety Squad",
    remarks: "Inspected & Operable",
  });

  // Query Database
  const rawInventory = useLiveQuery(() => db.fireInventory.toArray(), []);

  useEffect(() => {
    if (rawInventory !== undefined && rawInventory.length === 0) {
      seedAllModules().catch((err) => console.error("Fire inventory seed error:", err));
    }
  }, [rawInventory]);

  // Compute status & filter by current building & floor level
  const floorInventory = useMemo(() => {
    if (!rawInventory) return [];

    const isGround = floorLevel === 1;

    return rawInventory
      .map((item) => {
        const isExpired = new Date() > new Date(item.expiryDate);
        const isMaintenanceDue = new Date() > new Date(item.maintenanceDueDate);

        let computedStatus = item.status;
        if (computedStatus !== "Under Maintenance") {
          if (isExpired) computedStatus = "Expired";
          else if (isMaintenanceDue) computedStatus = "Under Maintenance";
          else computedStatus = "Active";
        }
        return { ...item, computedStatus };
      })
      .filter((item) => {
        // Floor matching logic
        const itemFloorLower = (item.floor || "").toLowerCase();
        const matchesFloor =
          itemFloorLower.includes(`level ${floorLevel}`) ||
          itemFloorLower.includes(`floor ${floorLevel}`) ||
          itemFloorLower.includes(`${floorLevel}`) ||
          (isGround && itemFloorLower.includes("ground"));

        // If items are generic or seeded, fallback to match floor or match building
        return matchesFloor || (item.building && item.building.toLowerCase().includes(buildingName.toLowerCase()));
      });
  }, [rawInventory, buildingName, floorLevel]);

  // Filtered by Search & Status
  const filteredItems = useMemo(() => {
    return floorInventory.filter((item) => {
      const matchesSearch =
        item.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
        item.inventoryId.toLowerCase().includes(search.toLowerCase()) ||
        item.zoneRoom.toLowerCase().includes(search.toLowerCase()) ||
        item.equipmentType.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.computedStatus === "Active") ||
        (statusFilter === "expired" && item.computedStatus === "Expired") ||
        (statusFilter === "maintenance" && item.computedStatus === "Under Maintenance");

      return matchesSearch && matchesStatus;
    });
  }, [floorInventory, search, statusFilter]);

  // Statistics KPIs
  const totalCount = floorInventory.length;
  const activeCount = floorInventory.filter((i) => i.computedStatus === "Active").length;
  const expiredCount = floorInventory.filter((i) => i.computedStatus === "Expired").length;
  const maintenanceCount = floorInventory.filter((i) => i.computedStatus === "Under Maintenance").length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `FI-L${floorLevel}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.fireInventory.add({
      inventoryId: id,
      equipmentName: newItem.equipmentName,
      equipmentType: newItem.equipmentType,
      building: buildingName,
      floor: `Level ${floorLevel}`,
      zoneRoom: newItem.zoneRoom,
      quantity: Number(newItem.quantity),
      installationDate: newItem.installationDate,
      lastInspectionDate: newItem.lastInspectionDate,
      expiryDate: newItem.expiryDate,
      maintenanceDueDate: newItem.maintenanceDueDate,
      status: "Active",
      assignedMaintenanceTeam: newItem.assignedMaintenanceTeam,
      remarks: newItem.remarks,
    });

    toast.success(`Added ${newItem.equipmentName} (${id}) to Level ${floorLevel}`);
    setIsAddModalOpen(false);
  };

  const handleDeleteItem = async (id?: number, invId?: string) => {
    if (!id) return;
    await db.fireInventory.delete(id);
    toast.info(`Equipment item ${invId || id} removed from Level ${floorLevel}`);
  };

  return (
    <div className="p-4 space-y-5 bg-card/40 rounded-2xl border border-border/60 backdrop-blur-md">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-500" />
            <h3 className="text-base font-extrabold text-foreground">
              Level {floorLevel} Fire Safety Equipment Inventory
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {buildingName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active fire suppression, alarm detectors, and safety gear assigned to Floor Level {floorLevel}
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          size="sm"
          className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Equipment to Level {floorLevel}
        </Button>
      </div>

      {/* KPI Cards for Floor Level */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border/60 bg-background/60 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block mb-0.5">Total Equipment</span>
          <div className="text-xl font-black text-foreground">{totalCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 mb-0.5">
            <CheckCircle className="h-3 w-3" /> Active
          </span>
          <div className="text-xl font-black text-emerald-500">{activeCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-xs">
          <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mb-0.5">
            <XCircle className="h-3 w-3" /> Expired
          </span>
          <div className="text-xl font-black text-rose-500">{expiredCount}</div>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
          <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1 mb-0.5">
            <AlertTriangle className="h-3 w-3" /> Maintenance
          </span>
          <div className="text-xl font-black text-amber-500">{maintenanceCount}</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search level equipment, ID, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/60"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border/40 text-xs">
          {(["all", "active", "expired", "maintenance"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all ${
                statusFilter === st
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border/40 text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Equipment</th>
              <th className="p-3">Location / Room</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3">Expiry Date</th>
              <th className="p-3">Maintenance Due</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 font-medium">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">
                  No fire inventory items found for Level {floorLevel}.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id || item.inventoryId} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono text-[11px] text-muted-foreground font-semibold">
                    {item.inventoryId}
                  </td>
                  <td className="p-3 font-bold text-foreground">
                    <div>{item.equipmentName}</div>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {item.equipmentType}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    <span className="px-2 py-0.5 rounded bg-secondary/80 text-[11px] font-bold text-foreground">
                      {item.zoneRoom}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold">{item.quantity}</td>
                  <td className="p-3 text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {item.expiryDate}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground text-[11px]">
                    <div className="flex items-center gap-1">
                      <Wrench className="h-3 w-3 text-muted-foreground" />
                      {item.maintenanceDueDate}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        item.computedStatus === "Active"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : item.computedStatus === "Expired"
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}
                    >
                      {item.computedStatus === "Active" && <CheckCircle className="h-3 w-3" />}
                      {item.computedStatus === "Expired" && <XCircle className="h-3 w-3" />}
                      {item.computedStatus === "Under Maintenance" && <AlertTriangle className="h-3 w-3" />}
                      {item.computedStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDeleteItem(item.id, item.inventoryId)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Remove Equipment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-rose-500" />
                <h3 className="text-base font-bold text-foreground">
                  Add Fire Equipment — Level {floorLevel}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Equipment Name</label>
                <Input
                  required
                  value={newItem.equipmentName}
                  onChange={(e) => setNewItem({ ...newItem, equipmentName: e.target.value })}
                  className="bg-background text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Category / Type</label>
                  <select
                    value={newItem.equipmentType}
                    onChange={(e) => setNewItem({ ...newItem, equipmentType: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground font-semibold"
                  >
                    <option value="Fire Extinguisher">Fire Extinguisher</option>
                    <option value="Smoke Detector">Smoke Detector</option>
                    <option value="Fire Alarm Pull Station">Fire Alarm Pull Station</option>
                    <option value="Fire Hose Reel">Fire Hose Reel</option>
                    <option value="Sprinkler Valve">Sprinkler Valve</option>
                    <option value="Fire Door">Fire Door</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Zone / Room</label>
                  <Input
                    required
                    value={newItem.zoneRoom}
                    onChange={(e) => setNewItem({ ...newItem, zoneRoom: e.target.value })}
                    className="bg-background text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Quantity</label>
                  <Input
                    type="number"
                    min={1}
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                    className="bg-background text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Maintenance Team</label>
                  <Input
                    value={newItem.assignedMaintenanceTeam}
                    onChange={(e) => setNewItem({ ...newItem, assignedMaintenanceTeam: e.target.value })}
                    className="bg-background text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Expiry Date</label>
                  <Input
                    type="date"
                    value={newItem.expiryDate}
                    onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                    className="bg-background text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Maintenance Due</label>
                  <Input
                    type="date"
                    value={newItem.maintenanceDueDate}
                    onChange={(e) => setNewItem({ ...newItem, maintenanceDueDate: e.target.value })}
                    className="bg-background text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  Save Equipment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
