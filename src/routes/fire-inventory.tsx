import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type FireInventory } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import {
  Flame,
  Plus,
  Search,
  Filter,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cpu,
} from "lucide-react";

export const Route = createFileRoute("/fire-inventory")({
  validateSearch: z.object({
    filter: z.enum(["all", "active", "expired", "maintenance"]).optional().default("all"),
  }),
  component: FireInventoryPage,
});

function FireInventoryPage() {
  const { filter } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [localFilter, setLocalFilter] = useState(filter);

  const inventory = useLiveQuery(() => db.fireInventory.toArray(), []) ?? [];

  // Compute status on the fly based on dates
  const processedInventory = inventory.map((item) => {
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

  const filteredInventory = processedInventory.filter((item) => {
    const matchesSearch =
      item.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
      item.inventoryId.toLowerCase().includes(search.toLowerCase()) ||
      item.building.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      localFilter === "all" ||
      (localFilter === "active" && item.computedStatus === "Active") ||
      (localFilter === "expired" && item.computedStatus === "Expired") ||
      (localFilter === "maintenance" && item.computedStatus === "Under Maintenance");

    return matchesSearch && matchesFilter;
  });

  // Calculate stats for KPIs
  const total = processedInventory.length;
  const activeCount = processedInventory.filter((i) => i.computedStatus === "Active").length;
  const expiredCount = processedInventory.filter((i) => i.computedStatus === "Expired").length;
  const maintenanceCount = processedInventory.filter((i) => i.computedStatus === "Under Maintenance").length;

  return (
    <AppShell
      title="Fire Inventory Management"
      subtitle="Track, monitor, and maintain fire safety equipment"
      actions={
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => {
            // Seed sample data for demonstration
            db.fireInventory.add({
              inventoryId: `FI-${Math.floor(Math.random() * 10000)}`,
              equipmentName: "CO2 Fire Extinguisher 5kg",
              equipmentType: "Fire Extinguisher",
              building: "Main HQ",
              floor: "Level 1",
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
          }}
        >
          <Plus className="h-4 w-4" /> Add Item
        </button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md cursor-pointer" onClick={() => setLocalFilter("all")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Inventory</div>
                <div className="text-2xl font-black">{total}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-risk-green/20 bg-risk-green/5 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md cursor-pointer" onClick={() => setLocalFilter("active")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-risk-green/10 text-risk-green">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-risk-green">Active & Ready</div>
                <div className="text-2xl font-black text-risk-green">{activeCount}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-risk-red/20 bg-risk-red/5 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md cursor-pointer" onClick={() => setLocalFilter("expired")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-risk-red/10 text-risk-red">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-risk-red">Expired</div>
                <div className="text-2xl font-black text-risk-red">{expiredCount}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-risk-orange/20 bg-risk-orange/5 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md cursor-pointer" onClick={() => setLocalFilter("maintenance")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-risk-orange/10 text-risk-orange">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-risk-orange">Maintenance Due</div>
                <div className="text-2xl font-black text-risk-orange">{maintenanceCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID, Name, or Building..."
              className="w-full rounded-md border border-border bg-secondary/50 pl-9 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="expired">Expired Only</option>
              <option value="maintenance">Maintenance Due</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-4 font-semibold">Inventory ID</th>
                  <th className="px-4 py-4 font-semibold">Equipment Name</th>
                  <th className="px-4 py-4 font-semibold">Location</th>
                  <th className="px-4 py-4 font-semibold">Dates</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">IoT Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-xs">{item.inventoryId}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{item.equipmentName}</div>
                      <div className="text-xs text-muted-foreground">{item.equipmentType} · Qty: {item.quantity}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{item.building}</div>
                      <div className="text-xs text-muted-foreground">{item.floor} - {item.zoneRoom}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      <div><span className="opacity-70">EXP:</span> {item.expiryDate}</div>
                      <div><span className="opacity-70">MNT:</span> {item.maintenanceDueDate}</div>
                    </td>
                    <td className="px-4 py-3">
                      {item.computedStatus === "Active" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-green border border-risk-green/20">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      )}
                      {item.computedStatus === "Expired" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-red/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-red border border-risk-red/20 animate-pulse">
                          <XCircle className="h-3 w-3" /> Expired
                        </span>
                      )}
                      {item.computedStatus === "Under Maintenance" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-orange/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-risk-orange border border-risk-orange/20">
                          <AlertTriangle className="h-3 w-3" /> Maintenance
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                        <Cpu className={`h-3 w-3 ${item.computedStatus === 'Active' ? 'text-primary' : ''}`} />
                        Ready
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-10 w-10 opacity-20 mb-3" />
                        <p>No fire inventory records found.</p>
                        <p className="text-xs opacity-60">Try adjusting your filters or add a new item.</p>
                      </div>
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
