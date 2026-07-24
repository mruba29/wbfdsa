import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useRef } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Layers,
  Upload,
  Info,
  ChevronDown,
  CheckCircle2,
  MapPin,
  FileText,
  Sliders,
  Shield,
  Eye,
  Building,
  Save,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, type Building as DbBuilding, type BuildingType } from "@/lib/db";
import { logActivity } from "@/lib/db";
import { useApp } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/buildings")({
  head: () => ({
    meta: [
      { title: "Building Master Data — WB-FDVA" },
      {
        name: "description",
        content: "Master registry for building metadata, floor details, and CAD file uploads.",
      },
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
  "Residential",
  "Commercial",
  "Industrial",
  "Public Facility",
];

const ORGANIZATIONS = ["All Campuses", "CM", "Velam Mall", "Sangam Mall"];

const EMPTY_BUILDING: Omit<DbBuilding, "id" | "createdAt"> = {
  name: "",
  ownerName: "CM",
  type: "Office",
  functionalCategory: "Group B – Business",
  occupancyType: "Business (B)",
  floors: 1,
  buildingHeight: 15,
  totalArea: 1000,
  yearOfConstruction: 2020,
  contactNumber: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  constructionType: "Type I — Non-combustible",
  fireResistanceRating: "2-hour",
  numberOfLifts: 2,
  numberOfStaircases: 2,
  numberOfWindows: 20,
  adjacentBuildingDistance: 10,
  peoplePerFloor: 50,
  remarks: "",
  cadFiles: [],
};

function BuildingsPage() {
  const { organization, setOrganization } = useApp();
  const [search, setSearch] = useState("");
  const [selectedCampus, setSelectedCampus] = useState("All Campuses");
  const [typeFilter, setTypeFilter] = useState("All");

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"metadata" | "floors" | "cad">("metadata");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<DbBuilding, "id" | "createdAt">>(EMPTY_BUILDING);

  // Info Modal State
  const [viewingBuilding, setViewingBuilding] = useState<DbBuilding | null>(null);

  // Cad Upload File State
  const [uploadCadName, setUploadCadName] = useState("");
  const [uploadCadCategory, setUploadCadCategory] = useState("Floor Plan");

  // Query DB
  const rawBuildings = useLiveQuery(() => db.buildings.orderBy("id").reverse().toArray(), []);

  const filteredBuildings = (rawBuildings ?? []).filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.address.toLowerCase().includes(search.toLowerCase()) ||
      (b.ownerName && b.ownerName.toLowerCase().includes(search.toLowerCase()));

    const matchesCampus =
      selectedCampus === "All Campuses" || b.ownerName === selectedCampus;

    const matchesType = typeFilter === "All" || b.type === typeFilter;

    return matchesSearch && matchesCampus && matchesType;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_BUILDING);
    setActiveFormTab("metadata");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (b: DbBuilding) => {
    setEditingId(b.id!);
    const { id, createdAt, ...rest } = b;
    setFormData({
      ...EMPTY_BUILDING,
      ...rest,
      cadFiles: rest.cadFiles || [],
    });
    setActiveFormTab("metadata");
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete building "${name}"?`)) {
      await db.buildings.delete(id);
      await logActivity("building", `Deleted building: ${name}`);
      toast.success(`Building "${name}" deleted`);
    }
  };

  const handleSaveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Building name is required");
      return;
    }

    if (editingId) {
      await db.buildings.update(editingId, {
        ...formData,
      });
      await logActivity("building", `Updated building metadata: ${formData.name}`);
      toast.success("Building updated successfully");
    } else {
      const newId = await db.buildings.add({
        ...formData,
        createdAt: Date.now(),
      });
      await logActivity("building", `Created building: ${formData.name}`);

      // Seed default floors for new building
      for (let lvl = 1; lvl <= (formData.floors || 1); lvl++) {
        await db.floors.add({
          buildingId: newId,
          level: lvl,
          name: `Floor ${lvl}`,
          totalExits: 4,
          availableExits: 4,
          blockedExits: 0,
          elevatorWorking: true,
        });
      }

      toast.success("New building created successfully");
    }

    setIsFormOpen(false);
  };

  const handleAddCadFile = () => {
    if (!uploadCadName.trim()) return;
    const currentFiles = formData.cadFiles || [];
    setFormData({
      ...formData,
      cadFiles: [...currentFiles, uploadCadName.trim()],
    });
    setUploadCadName("");
    toast.success("CAD file attached to draft");
  };

  const handleRemoveCadFile = (fileName: string) => {
    const currentFiles = formData.cadFiles || [];
    setFormData({
      ...formData,
      cadFiles: currentFiles.filter((f) => f !== fileName),
    });
  };

  return (
    <AppShell
      title="Building Master"
      subtitle="Unified management of metadata, structural details, floor plans, and CAD files"
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/floor-plans"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-border bg-background hover:bg-secondary transition-colors"
          >
            <Layers className="h-4 w-4 text-primary" /> View Floor Plans
          </Link>
          <Button onClick={handleOpenAdd} className="gap-2 bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Add Building
          </Button>
        </div>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search building name, address, or owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/40"
              />
            </div>

            {/* Campus Selector */}
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              {ORGANIZATIONS.map((org) => (
                <option key={org} value={org}>
                  Campus: {org}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-background border border-border/60 text-foreground shadow-sm"
            >
              <option value="All">Type: All</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{filteredBuildings.length}</span>{" "}
            buildings
          </div>
        </div>

        {/* Buildings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBuildings.map((building) => {
            const cadCount = building.cadFiles ? building.cadFiles.length : 0;
            return (
              <div
                key={building.id}
                className="group relative flex flex-col justify-between p-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md shadow-md hover:border-primary/50 transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground leading-tight group-hover:text-primary transition-colors">
                          {building.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">
                          {building.ownerName || "Default Campus"}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground border border-border/40 shrink-0">
                      {building.type}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {building.address || "No address specified"}
                  </p>

                  {/* Quick Specs */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/30 text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Floors
                      </span>
                      <span className="font-bold text-foreground">{building.floors}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Total Area
                      </span>
                      <span className="font-bold text-foreground">
                        {building.totalArea ? `${building.totalArea} m²` : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        CAD Files
                      </span>
                      <span className="font-bold text-primary">{cadCount} attached</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewingBuilding(building)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" /> View Info
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(building)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="Edit Building"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(building.id!, building.name)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete Building"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add / Edit Building Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-8">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">
                      {editingId ? "Edit Building Master Record" : "Add New Building"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Configure building metadata, structural details, and CAD plans
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveFormTab("metadata")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    activeFormTab === "metadata"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  1. Building Metadata
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("floors")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    activeFormTab === "floors"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  2. Floor Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("cad")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    activeFormTab === "cad"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  3. CAD Upload
                </button>
              </div>

              <form onSubmit={handleSaveBuilding} className="space-y-4">
                {/* TAB 1: Metadata */}
                {activeFormTab === "metadata" && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Building Name *
                        </label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Corporate Tower A"
                          required
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Campus / Owner
                        </label>
                        <Input
                          value={formData.ownerName}
                          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          placeholder="e.g. Velam Mall"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Building Type
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-medium"
                        >
                          {TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Functional Category
                        </label>
                        <Input
                          value={formData.functionalCategory || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, functionalCategory: e.target.value })
                          }
                          placeholder="e.g. Group B – Business"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Total Area (m²)
                        </label>
                        <Input
                          type="number"
                          value={formData.totalArea}
                          onChange={(e) =>
                            setFormData({ ...formData, totalArea: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Height (m)
                        </label>
                        <Input
                          type="number"
                          value={formData.buildingHeight || 0}
                          onChange={(e) =>
                            setFormData({ ...formData, buildingHeight: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Construction Year
                        </label>
                        <Input
                          type="number"
                          value={formData.yearOfConstruction || 2020}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              yearOfConstruction: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">
                        Street Address
                      </label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Complete postal address"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: Floor Details */}
                {activeFormTab === "floors" && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Total Floor Count
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.floors}
                          onChange={(e) =>
                            setFormData({ ...formData, floors: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Est. Occupants per Floor
                        </label>
                        <Input
                          type="number"
                          value={formData.peoplePerFloor || 0}
                          onChange={(e) =>
                            setFormData({ ...formData, peoplePerFloor: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Number of Lifts
                        </label>
                        <Input
                          type="number"
                          value={formData.numberOfLifts || 0}
                          onChange={(e) =>
                            setFormData({ ...formData, numberOfLifts: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Number of Staircases
                        </label>
                        <Input
                          type="number"
                          value={formData.numberOfStaircases || 0}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              numberOfStaircases: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Number of Windows
                        </label>
                        <Input
                          type="number"
                          value={formData.numberOfWindows || 0}
                          onChange={(e) =>
                            setFormData({ ...formData, numberOfWindows: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Construction Type
                        </label>
                        <Input
                          value={formData.constructionType}
                          onChange={(e) =>
                            setFormData({ ...formData, constructionType: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-muted-foreground block mb-1">
                          Fire Resistance Rating
                        </label>
                        <Input
                          value={formData.fireResistanceRating}
                          onChange={(e) =>
                            setFormData({ ...formData, fireResistanceRating: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CAD Upload */}
                {activeFormTab === "cad" && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-xl border border-dashed border-border bg-secondary/20 text-center space-y-2">
                      <Upload className="h-8 w-8 text-primary mx-auto" />
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Attach CAD Floor Plan Files</h4>
                        <p className="text-muted-foreground text-[11px]">
                          Supported formats: .DWG, .DXF, .SVG, .PNG, .PDF
                        </p>
                      </div>

                      <div className="flex items-center gap-2 max-w-md mx-auto pt-2">
                        <Input
                          value={uploadCadName}
                          onChange={(e) => setUploadCadName(e.target.value)}
                          placeholder="e.g. Floor_1_Architectural.dxf"
                          className="bg-background text-xs"
                        />
                        <Button
                          type="button"
                          onClick={handleAddCadFile}
                          className="shrink-0 text-xs bg-primary text-primary-foreground"
                        >
                          Attach
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-muted-foreground mb-2">Attached CAD Drawings</h4>
                      {formData.cadFiles && formData.cadFiles.length > 0 ? (
                        <div className="space-y-2">
                          {formData.cadFiles.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/40"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-foreground">{file}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCadFile(file)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No CAD files attached yet.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="text-xs bg-primary text-primary-foreground gap-2">
                    <Save className="h-4 w-4" /> Save Building Record
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Building Information Drawer/Modal */}
        {viewingBuilding && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{viewingBuilding.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {viewingBuilding.ownerName || "Campus Master Data"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingBuilding(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Building Type</span>
                  <p className="font-bold text-foreground">{viewingBuilding.type}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Category</span>
                  <p className="font-bold text-foreground">
                    {viewingBuilding.functionalCategory || "Group B - Business"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Floors</span>
                  <p className="font-bold text-foreground">{viewingBuilding.floors} Floors</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Total Area</span>
                  <p className="font-bold text-foreground">{viewingBuilding.totalArea} m²</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Lifts / Stairs</span>
                  <p className="font-bold text-foreground">
                    {viewingBuilding.numberOfLifts || 2} Lifts / {viewingBuilding.numberOfStaircases || 2} Stairs
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/40 space-y-1">
                  <span className="text-muted-foreground font-medium">Fire Rating</span>
                  <p className="font-bold text-primary">
                    {viewingBuilding.fireResistanceRating || "2-hour"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-muted-foreground">Address</span>
                <p className="p-3 rounded-xl bg-secondary/30 text-foreground">
                  {viewingBuilding.address || "Address not provided"}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-muted-foreground">Attached CAD Plans</span>
                {viewingBuilding.cadFiles && viewingBuilding.cadFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewingBuilding.cadFiles.map((f, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-semibold"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No CAD plans attached</p>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-border/40">
                <Button onClick={() => setViewingBuilding(null)} className="text-xs bg-primary text-primary-foreground">
                  Close Detail View
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
