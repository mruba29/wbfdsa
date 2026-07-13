import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useRef } from "react";
import { Building2, Plus, Pencil, Trash2, X, Search, Filter, AlertTriangle, ShieldCheck, Map, Flame, Users, Box, Building, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, type Building as DbBuilding, type BuildingType } from "@/lib/db";
import { logActivity } from "@/lib/db";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/buildings")({
  head: () => ({
    meta: [
      { title: "Buildings — WB-FDVA" },
      { name: "description", content: "Manage buildings in the assessment registry." },
    ],
  }),
  component: BuildingsPage,
});

const TYPES: BuildingType[] = [
  "Hotel",
  "Hospital",
  "Shopping Mall",
  "Office",
  "School",
  "University",
  "Data Center",
  "Mixed Use",
];

const ORGANIZATIONS = ["CM", "Velam Mall", "Sangam Mall"];

const EMPTY: Omit<DbBuilding, "id" | "createdAt"> = {
  name: "",
  type: "Office",
  address: "",
  floors: 1,
  totalArea: 0,
  constructionType: "Type I — Non-combustible",
  fireResistanceRating: "1-hour",
  ownerName: "CM",
};

function BuildingsPage() {
  const { organization, setOrganization } = useApp();
  
  // Set default organization if none selected
  useEffect(() => {
    if (!organization) {
      setOrganization(ORGANIZATIONS[0]);
    }
  }, [organization, setOrganization]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [editing, setEditing] = useState<DbBuilding | null>(null);
  const [creating, setCreating] = useState(false);

  const enrichedBuildings = useLiveQuery(async () => {
    let allBuildings = await db.buildings.orderBy("id").reverse().toArray();
    
    // Filter by organization early
    if (organization) {
      allBuildings = allBuildings.filter(b => b.ownerName === organization);
    }
    
    return await Promise.all(allBuildings.map(async b => {
      const incidents = await db.incidents.where("buildingId").equals(b.id!).toArray();
      const activeAlerts = incidents.filter(i => i.status === "active").length;
      
      const inventory = await db.fireInventory.where("building").equals(b.name).toArray();
      const fireInventoryCount = inventory.length;

      const zones = await db.zones.where("buildingId").equals(b.id!).toArray();
      const totalOccupants = zones.reduce((sum, z) => sum + z.occupancy, 0);

      const riskStatus = activeAlerts > 0 ? "High" : "Low";
      const buildingHealth = activeAlerts > 0 ? "Critical" : "Good";
      
      return {
        ...b,
        activeAlerts,
        fireInventoryCount,
        totalOccupants,
        riskStatus,
        buildingHealth
      };
    }));
  }, [organization]);

  // Client side filters (Search & Type)
  const filtered = enrichedBuildings?.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "All" && b.type !== typeFilter) return false;
    return true;
  });

  return (
    <AppShell
      title="Buildings"
      subtitle="Registry and configuration"
      actions={
        <Button
          onClick={() => setCreating(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Building
        </Button>
      }
    >
      <div className="mb-10 relative z-50 flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl border border-border/60 bg-card/60 backdrop-blur-md p-4 shadow-sm">
        
        {/* Organization Selector (Premium Custom UI) */}
        <div className="relative z-50" ref={orgDropdownRef}>
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            className="flex items-center gap-3 bg-[#0B1220]/90 px-4 py-2.5 rounded-xl border border-[#2A5FFF]/30 backdrop-blur-xl shadow-sm hover:border-[#2A5FFF]/60 hover:shadow-lg hover:shadow-blue-900/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 text-left group"
          >
            <div className="bg-[#2A5FFF]/15 p-1.5 rounded-lg group-hover:bg-[#2A5FFF]/25 transition-colors">
              <Building className="h-4 w-4 text-[#2A5FFF]" />
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Organization</span>
              <span className="text-sm font-bold text-white truncate">{organization}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOrgDropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </button>
          
          {isOrgDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-[#0B1220]/95 border border-[#2A5FFF]/30 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {ORGANIZATIONS.map(org => {
                const isSelected = organization === org;
                return (
                  <button
                    key={org}
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setTimeout(() => setOrganization(org), 200); // Wait for dropdown closing animation before refreshing building cards
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-all duration-200 flex items-center ${
                      isSelected 
                        ? 'bg-[#2563EB] text-white' 
                        : 'text-gray-300 hover:bg-[#1E4ED8] hover:text-white'
                    }`}
                  >
                    <div className={`w-1 h-5 rounded-full mr-3 transition-colors duration-200 ${isSelected ? 'bg-white' : 'bg-transparent'}`} />
                    <span className="truncate">{org}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex w-full sm:w-auto flex-wrap items-center gap-3 ml-auto">
          <div className="flex w-full sm:w-64 items-center gap-2 relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Building..."
              className="w-full pl-9 bg-background/50"
            />
          </div>
          <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-md border border-border/60 h-10">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">All Building Types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!filtered || filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No buildings available for this organization."
          description={`There are currently no buildings assigned to ${organization}.`}
          action={
            <Button onClick={() => setCreating(true)} className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" /> Add Building
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered?.map((b) => (
            <div
              key={b.id}
              className="group flex flex-col justify-between rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 overflow-hidden"
            >
              <div className="h-32 w-full bg-secondary/50 relative overflow-hidden flex items-center justify-center border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent z-10" />
                <Building2 className="h-12 w-12 text-muted-foreground/30 z-0" />
                <div className="absolute top-3 left-3 z-20 flex gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${b.buildingHealth === "Critical" ? "bg-risk-red/20 text-risk-red border border-risk-red/30" : "bg-risk-green/20 text-risk-green border border-risk-green/30"}`}>
                    Health: {b.buildingHealth}
                  </span>
                  {b.activeAlerts > 0 && (
                    <span className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-500 border border-orange-500/30">
                      <AlertTriangle className="mr-1 h-3 w-3" /> {b.activeAlerts} Alerts
                    </span>
                  )}
                </div>
                <div className="absolute bottom-3 left-3 z-20">
                  <h3 className="text-xl font-bold truncate text-foreground">{b.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary bg-primary/10 px-1.5 rounded">{b.ownerName}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">• {b.type}</span>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <dl className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                  <StatItem icon={Building2} label="Total Floors" value={b.floors} />
                  <StatItem icon={Users} label="Occupancy" value={b.totalOccupants.toLocaleString()} />
                  <StatItem icon={Box} label="Fire Inventory Count" value={b.fireInventoryCount} />
                  <StatItem icon={ShieldCheck} label="Risk Status" value={b.riskStatus} />
                </dl>
                
                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span>Last Updated: {new Date(b.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-4 bg-muted/20 border-t border-border/50 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/buildings"
                    className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    to="/floor-plans"
                    className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors"
                  >
                    Floor Plans
                  </Link>
                  <Link
                    to="/portfolio-map"
                    className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors"
                  >
                    <Map className="mr-1.5 h-3.5 w-3.5" /> Portfolio Map
                  </Link>
                  <Link
                    to="/reports"
                    className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition-colors"
                  >
                    Reports
                  </Link>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditing(b)}
                    className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${b.name}?`)) return;
                      await db.transaction(
                        "rw",
                        db.buildings,
                        db.floors,
                        db.zones,
                        db.incidents,
                        async () => {
                          await db.buildings.delete(b.id!);
                          await db.floors.where("buildingId").equals(b.id!).delete();
                          await db.zones.where("buildingId").equals(b.id!).delete();
                          await db.incidents.where("buildingId").equals(b.id!).delete();
                        },
                      );
                      await logActivity("building", `Removed ${b.name}`);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-risk-red hover:bg-risk-red/10 hover:border-risk-red/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BuildingForm
          key={editing ? editing.id : "new"}
          initial={editing ?? { ...EMPTY, ownerName: organization || ORGANIZATIONS[0] }}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (data) => {
            if (editing) {
              await db.buildings.update(editing.id!, data);
              await logActivity("building", `Updated ${data.name}`);
            } else {
              await db.buildings.add({ 
                ...(data as Omit<DbBuilding, "id">), 
                createdAt: Date.now() 
              });
              await logActivity("building", `Added ${data.name}`);
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5 bg-background/50 rounded-lg p-2 border border-border/40">
      <div className="bg-primary/10 p-1.5 rounded-md shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="font-mono text-xs font-bold text-foreground mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}

function BuildingForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Omit<DbBuilding, "id" | "createdAt"> | DbBuilding;
  onClose: () => void;
  onSave: (b: Omit<DbBuilding, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState({ ...initial });
  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/30 rounded-t-xl">
          <h3 className="font-bold text-lg">
            {"id" in initial && initial.id ? "Edit Building" : "Add Building"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const { id: _id, createdAt: _c, ...rest } = form as DbBuilding;
            onSave(rest);
          }}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-5">
            <Field label="Building Name">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Headquarters"
              />
            </Field>
            <Field label="Organization (Mandatory)">
              <select
                required
                value={form.ownerName || ""}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ORGANIZATIONS.map((org) => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Primary Use Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as BuildingType })}
                className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Total Floors">
              <Input
                type="number"
                min={1}
                value={form.floors}
                onChange={(e) => setForm({ ...form, floors: +e.target.value })}
              />
            </Field>
          </div>
          <Field label="Physical Address">
            <Input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Main St..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-5">
            <Field label="Total Area (m²)">
              <Input
                type="number"
                value={form.totalArea}
                onChange={(e) => setForm({ ...form, totalArea: +e.target.value })}
              />
            </Field>
            <Field label="Fire Resistance Rating (FRR)">
              <Input
                value={form.fireResistanceRating}
                onChange={(e) => setForm({ ...form, fireResistanceRating: e.target.value })}
                placeholder="e.g. 2-hour"
              />
            </Field>
          </div>
          <Field label="Construction Type">
            <Input
              value={form.constructionType}
              onChange={(e) => setForm({ ...form, constructionType: e.target.value })}
              placeholder="e.g. Type I — Non-combustible"
            />
          </Field>
          <div className="mt-8 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Save Building
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground font-semibold">{label}</span>
      {children}
    </label>
  );
}
