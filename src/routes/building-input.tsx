import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import {
  Upload,
  MapPin,
  Building2,
  FileText,
  CheckCircle2,
  Search,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Bus,
  Church,
  Server,
  Dumbbell,
  Car,
  Landmark,
  Store,
  Wheat,
  Palette,
  Building,
  X,
  Eye,
  RotateCcw,
  Save,
  Send,
  AlertCircle,
  Calendar,
  User,
  MessageSquare,
  Trash2,
  FileImage,
  FileArchive,
  Loader2,
  Info,
  Sliders,
  Users,
  Flame,
  Zap,
  Ruler,
  AlertTriangle,
  PhoneCall,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { logActivity } from "@/lib/db";
import { createBuildingOnService } from "@/services/dbSync";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/building-input")({
  head: () => ({ meta: [{ title: "Building Assessment Input — WB-FDVA" }] }),
  component: BuildingInputPage,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const FUNCTIONAL_CATEGORIES = {
  "Group A – Assembly": [
    "Theaters",
    "Cinemas",
    "Auditoriums",
    "Stadiums",
    "Restaurants",
    "Bars",
    "Churches",
    "Exhibition Halls",
  ],
  "Group B – Business": ["Offices", "Banks", "Professional Services", "Clinics", "Research Labs"],
  "Group E – Educational": ["Schools", "Colleges", "Universities", "Daycare Centers"],
  "Group F – Factory / Industrial": [
    "Manufacturing Plants",
    "Workshops",
    "Food Processing Units",
    "Furniture Factories",
  ],
  "Group H – Hazardous": [
    "Chemical Plants",
    "Flammable Liquid Storage",
    "Explosive Facilities",
    "Toxic Material Facilities",
  ],
  "Group I – Institutional": [
    "Hospitals",
    "Nursing Homes",
    "Assisted Living",
    "Prisons",
    "Psychiatric Facilities",
  ],
  "Group M – Mercantile": [
    "Shops",
    "Supermarkets",
    "Shopping Malls",
    "Retail Stores",
    "Wholesale Stores",
  ],
  "Group R – Residential": [
    "Apartments",
    "Hotels",
    "Dormitories",
    "Lodging Houses",
    "Single Family Homes",
  ],
  "Group S – Storage": ["Warehouses", "Aircraft Hangars", "Parking Garages", "Self Storage Units"],
  "Group U – Utility & Miscellaneous": [
    "Agricultural Buildings",
    "Barns",
    "Towers",
    "Garages",
    "Sheds",
    "Greenhouses",
  ],
};

const OCCUPANCY_TYPES = [
  "Business (B)",
  "Assembly (A-1 to A-5)",
  "Educational (E)",
  "Factory (F-1, F-2)",
  "High Hazard (H-1 to H-5)",
  "Institutional (I-1 to I-4)",
  "Mercantile (M)",
  "Residential (R-1 to R-4)",
  "Storage (S-1, S-2)",
  "Utility (U)",
];

const BUILDING_TYPES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Mixed Use",
  "Public Facility",
  "Hotel",
  "Hospital",
  "Shopping Mall",
  "Office",
  "School",
  "University",
  "Data Center",
];

const CAD_CATEGORIES = [
  "Site Plan",
  "Building Plan",
  "Floor Plan",
  "Fire Safety Layout",
  "Exit Route Layout",
];

const ACCEPTED_EXTENSIONS = [".dwg", ".dxf", ".pdf", ".png", ".jpg", ".jpeg"];

const ADDITIONAL_CATEGORIES_DATA = [
  {
    category: "Mixed-Use",
    examples:
      "Buildings combining residential + commercial functions (e.g., ground-floor shops with upper-floor apartments)",
    icon: Building,
  },
  {
    category: "Commercial",
    examples: "General term for Business + Mercantile occupancies",
    icon: Store,
  },
  {
    category: "Public",
    examples: "Government buildings, libraries, museums, post offices",
    icon: Landmark,
  },
  {
    category: "Healthcare",
    examples: "Specialized healthcare facilities and medical centers",
    icon: HeartPulse,
  },
  { category: "Religious", examples: "Mosques, temples, churches, prayer halls", icon: Church },
  {
    category: "Transportation",
    examples: "Airports, railway stations, metro stations, bus terminals",
    icon: Bus,
  },
  {
    category: "Sports & Recreation",
    examples: "Gymnasiums, swimming pools, sports complexes, stadiums",
    icon: Dumbbell,
  },
  {
    category: "Cultural",
    examples: "Museums, art galleries, libraries, cultural centers",
    icon: Palette,
  },
  {
    category: "Agricultural",
    examples: "Farms, silos, greenhouses, agricultural storage buildings",
    icon: Wheat,
  },
  {
    category: "Data Centers",
    examples: "Server farms, cloud infrastructure facilities, IT operations centers",
    icon: Server,
  },
  {
    category: "Parking Structures",
    examples: "Multi-level parking garages and parking facilities",
    icon: Car,
  },
];

// ── Form State Types ───────────────────────────────────────────────────────────

interface UploadedFile {
  file: File;
  id: string;
  category: string;
  progress: number;
  status: "uploading" | "complete" | "error";
}

interface FormData {
  // General Info
  buildingName: string;
  buildingId: string;
  ownerName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  contactNumber: string;
  email: string;

  // Building Details
  buildingType: string;
  functionalCategory: string;
  builtUpArea: string;
  yearOfConstruction: string;
  buildingHeight: string;
  constructionType: string;
  fireResistanceRating: string;

  // Occupancy Details
  occupancyType: string;
  numberOfFloors: string;
  peoplePerFloor: string;
  averageDailyOccupants: string;

  // Fire Protection Systems
  sprinklerSystem: string;
  fireAlarmSystem: string;
  smokeDetectors: string;
  wetRisers: string;
  hoseReels: string;
  fireExtinguishersCount: string;

  // Utilities
  primaryPower: string;
  backupGenerator: string;
  gasShutoff: string;
  waterSupply: string;
  electricalRoomLoc: string;

  // Structural Information
  numberOfLifts: string;
  numberOfStaircases: string;
  numberOfWindows: string;
  adjacentBuildingDistance: string;
  mainConstructionMaterial: string;
  roofConstructionType: string;

  // Hazardous Materials
  hazardousMaterialsPresent: string;
  flammableLiquidsQty: string;
  gasCylindersCount: string;
  hazardStorageLoc: string;
  msdsAvailable: string;

  // Emergency Information
  assessmentDate: string;
  assessorName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  remarks: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  buildingName: "",
  buildingId: "",
  ownerName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  contactNumber: "",
  email: "",

  buildingType: "",
  functionalCategory: "",
  builtUpArea: "",
  yearOfConstruction: "",
  buildingHeight: "",
  constructionType: "Type I — Non-combustible",
  fireResistanceRating: "2-hour",

  occupancyType: "",
  numberOfFloors: "",
  peoplePerFloor: "",
  averageDailyOccupants: "",

  sprinklerSystem: "No",
  fireAlarmSystem: "No",
  smokeDetectors: "No",
  wetRisers: "No",
  hoseReels: "No",
  fireExtinguishersCount: "",

  primaryPower: "Grid",
  backupGenerator: "No",
  gasShutoff: "No",
  waterSupply: "Municipal",
  electricalRoomLoc: "",

  numberOfLifts: "",
  numberOfStaircases: "",
  numberOfWindows: "",
  adjacentBuildingDistance: "",
  mainConstructionMaterial: "Concrete",
  roofConstructionType: "Concrete Slab",

  hazardousMaterialsPresent: "No",
  flammableLiquidsQty: "",
  gasCylindersCount: "",
  hazardStorageLoc: "",
  msdsAvailable: "No",

  assessmentDate: new Date().toISOString().slice(0, 10),
  assessorName: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  remarks: "",
};

// ── Main Page ──────────────────────────────────────────────────────────────────

function BuildingInputPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const validate = (): boolean => {
    const e: ValidationErrors = {};
    if (!formData.buildingName.trim()) e.buildingName = "Building name is required";
    if (!formData.buildingType) e.buildingType = "Building type is required";
    if (!formData.numberOfFloors || Number(formData.numberOfFloors) < 1)
      e.numberOfFloors = "At least 1 floor required";
    if (!formData.builtUpArea) e.builtUpArea = "Built-up area is required";
    if (!formData.addressLine1.trim()) e.addressLine1 = "Address is required";
    if (!formData.city.trim()) e.city = "City is required";
    if (!formData.assessorName.trim()) e.assessorName = "Assessor name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildRecord = (status: "draft" | "submitted"): any => ({
    name: formData.buildingName,
    buildingId: formData.buildingId || undefined,
    ownerName: formData.ownerName || undefined,
    type: formData.buildingType || "Office",
    functionalCategory: formData.functionalCategory || undefined,
    occupancyType: formData.occupancyType || undefined,
    floors: Number(formData.numberOfFloors) || 1,
    buildingHeight: Number(formData.buildingHeight) || undefined,
    totalArea: Number(formData.builtUpArea) || 0,
    yearOfConstruction: Number(formData.yearOfConstruction) || undefined,
    contactNumber: formData.contactNumber || undefined,
    email: formData.email || undefined,
    address: [
      formData.addressLine1,
      formData.addressLine2,
      formData.city,
      formData.state,
      formData.country,
      formData.postalCode,
    ]
      .filter(Boolean)
      .join(", "),
    addressLine1: formData.addressLine1 || undefined,
    addressLine2: formData.addressLine2 || undefined,
    city: formData.city || undefined,
    state: formData.state || undefined,
    country: formData.country || undefined,
    pincode: formData.postalCode || undefined,
    latitude: Number(formData.latitude) || undefined,
    longitude: Number(formData.longitude) || undefined,
    constructionType: formData.constructionType,
    fireResistanceRating: formData.fireResistanceRating,

    // Additional synced fields
    sprinklerSystem: formData.sprinklerSystem,
    fireAlarmSystem: formData.fireAlarmSystem,
    smokeDetectors: formData.smokeDetectors,
    wetRisers: formData.wetRisers,
    hoseReels: formData.hoseReels,
    fireExtinguishersCount: Number(formData.fireExtinguishersCount) || 0,

    primaryPower: formData.primaryPower,
    backupGenerator: formData.backupGenerator,
    gasShutoff: formData.gasShutoff,
    waterSupply: formData.waterSupply,
    electricalRoomLoc: formData.electricalRoomLoc || undefined,

    numberOfLifts: Number(formData.numberOfLifts) || undefined,
    numberOfStaircases: Number(formData.numberOfStaircases) || undefined,
    numberOfWindows: Number(formData.numberOfWindows) || undefined,
    adjacentBuildingDistance: Number(formData.adjacentBuildingDistance) || undefined,
    peoplePerFloor: Number(formData.peoplePerFloor) || undefined,
    averageDailyOccupants: Number(formData.averageDailyOccupants) || undefined,
    mainConstructionMaterial: formData.mainConstructionMaterial,
    roofConstructionType: formData.roofConstructionType,

    hazardousMaterialsPresent: formData.hazardousMaterialsPresent,
    flammableLiquidsQty: Number(formData.flammableLiquidsQty) || undefined,
    gasCylindersCount: Number(formData.gasCylindersCount) || undefined,
    hazardStorageLoc: formData.hazardStorageLoc || undefined,
    msdsAvailable: formData.msdsAvailable,

    assessmentDate: formData.assessmentDate || undefined,
    assessorName: formData.assessorName || undefined,
    emergencyContactName: formData.emergencyContactName || undefined,
    emergencyContactPhone: formData.emergencyContactPhone || undefined,
    remarks: formData.remarks || undefined,
    status,
    cadFiles: uploadedFiles.filter((f) => f.status === "complete").map((f) => f.file.name),
    cadFileCategories: Object.fromEntries(
      uploadedFiles.filter((f) => f.status === "complete").map((f) => [f.file.name, f.category]),
    ),
    createdAt: Date.now(),
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const record = buildRecord("draft");
      await createBuildingOnService(record);
      await logActivity("building", `Draft saved: ${formData.buildingName || "Untitled"}`);
      showToast("✅ Draft saved successfully!");
    } catch (err) {
      console.error(err);
      showToast("❌ Error saving draft");
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      showToast("⚠️ Please fix validation errors before submitting");
      return;
    }
    setSaving(true);
    try {
      const record = buildRecord("submitted");
      await createBuildingOnService(record);
      await logActivity("building", `Assessment submitted: ${formData.buildingName}`);
      setSubmitSuccess(true);
      showToast("✅ Assessment submitted successfully!");
    } catch (err) {
      console.error(err);
      showToast("❌ Error submitting assessment");
    }
    setSaving(false);
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setUploadedFiles([]);
    setErrors({});
    setSubmitSuccess(false);
    setActiveTab("general");
    showToast("🔄 Form reset");
  };

  if (submitSuccess) {
    return (
      <AppShell title="Building Assessment Input" subtitle="Assessment submitted successfully.">
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="h-20 w-20 rounded-full bg-risk-green/20 flex items-center justify-center animate-in zoom-in">
            <CheckCircle2 className="h-10 w-10 text-risk-green" />
          </div>
          <h2 className="text-2xl font-bold">Assessment Submitted!</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Building <strong>{formData.buildingName}</strong> has been saved and is now available
            across all modules — Dashboard, Vulnerability Assessment, Commander View, and Reports.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="rounded-md border border-border bg-secondary px-6 py-2.5 text-sm font-semibold hover:bg-secondary/80"
            >
              New Assessment
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const TABS = [
    { id: "general", label: "General Information", icon: Info },
    { id: "details", label: "Building Details", icon: Sliders },
    { id: "occupancy", label: "Occupancy Details", icon: Users },
    { id: "fireSystems", label: "Fire Protection Systems", icon: Flame },
    { id: "utilities", label: "Utilities", icon: Zap },
    { id: "structural", label: "Structural Information", icon: Ruler },
    { id: "hazardous", label: "Hazardous Materials", icon: AlertTriangle },
    { id: "emergency", label: "Emergency Information", icon: PhoneCall },
    { id: "documents", label: "Documents", icon: Upload },
  ];

  return (
    <AppShell
      title="Building Assessment Input"
      subtitle="Collect all building information required for fire vulnerability assessment."
    >
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-card border border-border shadow-xl px-4 py-3 text-sm font-medium animate-in slide-in-from-top-2 fade-in">
          {toastMessage}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          formData={formData}
          files={uploadedFiles}
          onClose={() => setShowPreview(false)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar Tabs */}
        <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </nav>

        {/* Main Content */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 shadow-sm min-h-[450px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "general" && (
                  <GeneralInfoForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("details")}
                  />
                )}
                {activeTab === "details" && (
                  <BuildingDetailsForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("occupancy")}
                  />
                )}
                {activeTab === "occupancy" && (
                  <OccupancyDetailsForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("fireSystems")}
                  />
                )}
                {activeTab === "fireSystems" && (
                  <FireSystemsForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("utilities")}
                  />
                )}
                {activeTab === "utilities" && (
                  <UtilitiesForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("structural")}
                  />
                )}
                {activeTab === "structural" && (
                  <StructuralInfoForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("hazardous")}
                  />
                )}
                {activeTab === "hazardous" && (
                  <HazardousMaterialsForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("emergency")}
                  />
                )}
                {activeTab === "emergency" && (
                  <EmergencyInfoForm
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    onNext={() => setActiveTab("documents")}
                  />
                )}
                {activeTab === "documents" && (
                  <CADUploadForm files={uploadedFiles} setFiles={setUploadedFiles} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold hover:bg-secondary/80 disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm transition-all hover:scale-[1.02]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
              Submit Assessment
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary transition-all hover:scale-[1.02]"
            >
              <RotateCcw className="h-4 w-4" /> Reset Form
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary ml-auto transition-all hover:scale-[1.02]"
            >
              <Eye className="h-4 w-4" /> Live Preview
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Tab Button ─────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground shadow-sm scale-[1.01]"
          : "hover:bg-secondary text-muted-foreground hover:text-foreground hover:translate-x-1"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ── Tab 1: General Information ────────────────────────────────────────────

function GeneralInfoForm({
  formData,
  errors,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  const [mapSearch, setMapSearch] = useState("");
  const [mapLoaded, setMapLoaded] = useState(!!(formData.latitude && formData.longitude));

  const handleSearchLocation = () => {
    const lat = (20 + Math.random() * 10).toFixed(6);
    const lng = (72 + Math.random() * 10).toFixed(6);
    updateField("latitude", lat);
    updateField("longitude", lng);
    setMapLoaded(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General Information</h2>
        <p className="text-sm text-muted-foreground">
          General details about the structure, ownership, and geographical position.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Building Name *" error={errors.buildingName}>
          <Input
            value={formData.buildingName}
            onChange={(v) => updateField("buildingName", v)}
            placeholder="e.g. Apollo Tower"
            error={!!errors.buildingName}
          />
        </Field>
        <Field label="Building ID">
          <Input
            value={formData.buildingId}
            onChange={(v) => updateField("buildingId", v)}
            placeholder="e.g. BLD-2024-001"
          />
        </Field>
        <Field label="Owner Name">
          <Input
            value={formData.ownerName}
            onChange={(v) => updateField("ownerName", v)}
            placeholder="Property owner"
          />
        </Field>
        <Field label="Contact Number">
          <Input
            value={formData.contactNumber}
            onChange={(v) => updateField("contactNumber", v)}
            placeholder="Owner or office contact"
          />
        </Field>
        <Field label="Email Address">
          <Input
            type="email"
            value={formData.email}
            onChange={(v) => updateField("email", v)}
            placeholder="contact@building.com"
          />
        </Field>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="text-base font-semibold mb-4">Location & Address Details</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Address Fields */}
          <div className="space-y-4">
            <Field label="Address Line 1 *" error={errors.addressLine1}>
              <Input
                value={formData.addressLine1}
                onChange={(v) => updateField("addressLine1", v)}
                placeholder="Street address"
                error={!!errors.addressLine1}
              />
            </Field>
            <Field label="Address Line 2">
              <Input
                value={formData.addressLine2}
                onChange={(v) => updateField("addressLine2", v)}
                placeholder="Apartment, suite, etc."
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City *" error={errors.city}>
                <Input
                  value={formData.city}
                  onChange={(v) => updateField("city", v)}
                  placeholder="City"
                  error={!!errors.city}
                />
              </Field>
              <Field label="State">
                <Input
                  value={formData.state}
                  onChange={(v) => updateField("state", v)}
                  placeholder="State"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Country">
                <Input
                  value={formData.country}
                  onChange={(v) => updateField("country", v)}
                  placeholder="Country"
                />
              </Field>
              <Field label="Postal Code">
                <Input
                  value={formData.postalCode}
                  onChange={(v) => updateField("postalCode", v)}
                  placeholder="Pincode"
                />
              </Field>
            </div>
          </div>

          {/* Map Section */}
          <div className="space-y-4">
            <Field label="Search Location">
              <div className="flex gap-2">
                <Input
                  value={mapSearch}
                  onChange={setMapSearch}
                  placeholder="Search for a place..."
                />
                <button
                  onClick={handleSearchLocation}
                  className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <div className="h-44 w-full rounded-lg border border-border bg-secondary/30 flex items-center justify-center relative overflow-hidden">
              {mapLoaded ? (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900/30 dark:to-green-900/30 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <MapPin className="h-10 w-10 text-primary mx-auto animate-bounce" />
                    <p className="text-sm font-medium">Location pinned</p>
                    <p className="text-xs text-muted-foreground">
                      {formData.latitude}, {formData.longitude}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Search location or enter coordinates
                  </p>
                  <button
                    onClick={handleSearchLocation}
                    className="rounded-md bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-sm border border-border hover:bg-background"
                  >
                    Place Marker
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitude">
                <Input
                  value={formData.latitude}
                  onChange={(v) => updateField("latitude", v)}
                  placeholder="Auto-fill"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  value={formData.longitude}
                  onChange={(v) => updateField("longitude", v)}
                  placeholder="Auto-fill"
                />
              </Field>
            </div>
            {formData.latitude && formData.longitude && (
              <button
                onClick={() => {
                  updateField("latitude", "");
                  updateField("longitude", "");
                  setMapLoaded(false);
                }}
                className="text-xs text-risk-red hover:underline block"
              >
                Clear Coordinates
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Building Details →
        </button>
      </div>
    </div>
  );
}

// ── Tab 2: Building Details ────────────────────────────────────────────

function BuildingDetailsForm({
  formData,
  errors,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Building Details</h2>
        <p className="text-sm text-muted-foreground">
          Structure dimension, classification type, and fire resistance parameters.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Building Type *" error={errors.buildingType}>
          <Select
            value={formData.buildingType}
            onChange={(v) => updateField("buildingType", v)}
            options={BUILDING_TYPES}
            placeholder="Select type..."
            error={!!errors.buildingType}
          />
        </Field>
        <Field label="Functional Category">
          <select
            value={formData.functionalCategory}
            onChange={(e) => updateField("functionalCategory", e.target.value)}
            className={selectClasses}
          >
            <option value="">Select category...</option>
            {Object.entries(FUNCTIONAL_CATEGORIES).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Built-up Area (sq.m) *" error={errors.builtUpArea}>
          <Input
            type="number"
            value={formData.builtUpArea}
            onChange={(v) => updateField("builtUpArea", v)}
            placeholder="Total area"
            error={!!errors.builtUpArea}
          />
        </Field>
        <Field label="Year of Construction">
          <Input
            type="number"
            value={formData.yearOfConstruction}
            onChange={(v) => updateField("yearOfConstruction", v)}
            placeholder="e.g. 2015"
          />
        </Field>
        <Field label="Building Height (m)">
          <Input
            type="number"
            value={formData.buildingHeight}
            onChange={(v) => updateField("buildingHeight", v)}
            placeholder="Height in meters"
          />
        </Field>
        <Field label="Construction Type">
          <Select
            value={formData.constructionType}
            onChange={(v) => updateField("constructionType", v)}
            options={[
              "Type I — Non-combustible",
              "Type II — Steel",
              "Type III — Masonry",
              "Type IV — Heavy Timber",
              "Type V — Wood Frame",
            ]}
          />
        </Field>
        <Field label="Fire Resistance Rating">
          <Select
            value={formData.fireResistanceRating}
            onChange={(v) => updateField("fireResistanceRating", v)}
            options={["Not Rated", "1-hour", "2-hour", "3-hour", "4-hour"]}
          />
        </Field>
      </div>

      <AdditionalCategoriesTable />

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Occupancy Details →
        </button>
      </div>
    </div>
  );
}

// ── Tab 3: Occupancy Details ───────────────────────────────────────────

function OccupancyDetailsForm({
  formData,
  errors,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Occupancy Details</h2>
        <p className="text-sm text-muted-foreground">
          Information regarding daily usage intensity, floor counts, and average populations.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Occupancy Type">
          <Select
            value={formData.occupancyType}
            onChange={(v) => updateField("occupancyType", v)}
            options={OCCUPANCY_TYPES}
            placeholder="Select occupancy..."
          />
        </Field>
        <Field label="Number of Floors *" error={errors.numberOfFloors}>
          <Input
            type="number"
            value={formData.numberOfFloors}
            onChange={(v) => updateField("numberOfFloors", v)}
            placeholder="e.g. 12"
            error={!!errors.numberOfFloors}
          />
        </Field>
        <Field label="Average Occupants per Floor">
          <Input
            type="number"
            value={formData.peoplePerFloor}
            onChange={(v) => updateField("peoplePerFloor", v)}
            placeholder="Avg. occupancy"
          />
        </Field>
        <Field label="Average Daily Occupants (Total)">
          <Input
            type="number"
            value={formData.averageDailyOccupants}
            onChange={(v) => updateField("averageDailyOccupants", v)}
            placeholder="Total daily occupants"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Fire Protection Systems →
        </button>
      </div>
    </div>
  );
}

// ── Tab 4: Fire Protection Systems ────────────────────────────────────────

function FireSystemsForm({
  formData,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Fire Protection Systems</h2>
        <p className="text-sm text-muted-foreground">
          Availability of proactive fire suppression, containment, and notification systems.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sprinkler System">
          <Select
            value={formData.sprinklerSystem}
            onChange={(v) => updateField("sprinklerSystem", v)}
            options={["Yes", "No", "Partial"]}
          />
        </Field>
        <Field label="Fire Alarm System">
          <Select
            value={formData.fireAlarmSystem}
            onChange={(v) => updateField("fireAlarmSystem", v)}
            options={["Yes", "No", "Partial"]}
          />
        </Field>
        <Field label="Smoke Detectors Installed">
          <Select
            value={formData.smokeDetectors}
            onChange={(v) => updateField("smokeDetectors", v)}
            options={["Yes", "No"]}
          />
        </Field>
        <Field label="Wet Risers Connected">
          <Select
            value={formData.wetRisers}
            onChange={(v) => updateField("wetRisers", v)}
            options={["Yes", "No"]}
          />
        </Field>
        <Field label="Hose Reels Working">
          <Select
            value={formData.hoseReels}
            onChange={(v) => updateField("hoseReels", v)}
            options={["Yes", "No"]}
          />
        </Field>
        <Field label="Fire Extinguishers Count">
          <Input
            type="number"
            value={formData.fireExtinguishersCount}
            onChange={(v) => updateField("fireExtinguishersCount", v)}
            placeholder="Total count on site"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Utilities →
        </button>
      </div>
    </div>
  );
}

// ── Tab 5: Utilities ──────────────────────────────────────────────────

function UtilitiesForm({
  formData,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Utilities</h2>
        <p className="text-sm text-muted-foreground">
          Power grid settings, gas valves, water supply, and switchboards.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Primary Power Source">
          <Select
            value={formData.primaryPower}
            onChange={(v) => updateField("primaryPower", v)}
            options={["Grid", "Solar", "Generator", "Grid + Solar", "Grid + Generator"]}
          />
        </Field>
        <Field label="Backup Generator Present">
          <Select
            value={formData.backupGenerator}
            onChange={(v) => updateField("backupGenerator", v)}
            options={["Yes", "No"]}
          />
        </Field>
        <Field label="Gas Line Shutoff Valve Accessible">
          <Select
            value={formData.gasShutoff}
            onChange={(v) => updateField("gasShutoff", v)}
            options={["Yes", "No", "N/A - No Gas Lines"]}
          />
        </Field>
        <Field label="Fire Water Supply Source">
          <Select
            value={formData.waterSupply}
            onChange={(v) => updateField("waterSupply", v)}
            options={["Municipal Main", "Borewell", "Dedicated Fire Tank", "Mixed Reservoirs"]}
          />
        </Field>
        <Field label="Electrical Room Location">
          <Input
            value={formData.electricalRoomLoc}
            onChange={(v) => updateField("electricalRoomLoc", v)}
            placeholder="e.g. Basement 1, Room B-12"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Structural Information →
        </button>
      </div>
    </div>
  );
}

// ── Tab 6: Structural Information ───────────────────────────────────────────

function StructuralInfoForm({
  formData,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Structural Information</h2>
        <p className="text-sm text-muted-foreground">
          Layout vectors, elevator counts, staircase channels, and window apertures.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Number of Lifts">
          <Input
            type="number"
            value={formData.numberOfLifts}
            onChange={(v) => updateField("numberOfLifts", v)}
            placeholder="Total lifts"
          />
        </Field>
        <Field label="Number of Staircases">
          <Input
            type="number"
            value={formData.numberOfStaircases}
            onChange={(v) => updateField("numberOfStaircases", v)}
            placeholder="Total staircases"
          />
        </Field>
        <Field label="Number of Windows">
          <Input
            type="number"
            value={formData.numberOfWindows}
            onChange={(v) => updateField("numberOfWindows", v)}
            placeholder="Total windows"
          />
        </Field>
        <Field label="Adjacent Building Distance (m)">
          <Input
            type="number"
            value={formData.adjacentBuildingDistance}
            onChange={(v) => updateField("adjacentBuildingDistance", v)}
            placeholder="Distance in meters"
          />
        </Field>
        <Field label="Main Construction Material">
          <Select
            value={formData.mainConstructionMaterial}
            onChange={(v) => updateField("mainConstructionMaterial", v)}
            options={[
              "Concrete",
              "Steel Frame",
              "Concrete & Steel",
              "Brick Masonry",
              "Timber / Wood Frame",
            ]}
          />
        </Field>
        <Field label="Roof Construction Type">
          <Select
            value={formData.roofConstructionType}
            onChange={(v) => updateField("roofConstructionType", v)}
            options={[
              "Concrete Slab",
              "Corrugated Metal sheets",
              "Wooden Deck",
              "Tile / Slated Roof",
            ]}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Hazardous Materials →
        </button>
      </div>
    </div>
  );
}

// ── Tab 7: Hazardous Materials ─────────────────────────────────────────────

function HazardousMaterialsForm({
  formData,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Hazardous Materials</h2>
        <p className="text-sm text-muted-foreground">
          Inventory of combustible chemicals, fuel reserves, and safety sheets.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Hazardous Materials Present">
          <Select
            value={formData.hazardousMaterialsPresent}
            onChange={(v) => updateField("hazardousMaterialsPresent", v)}
            options={["No", "Yes"]}
          />
        </Field>
        {formData.hazardousMaterialsPresent === "Yes" && (
          <>
            <Field label="Flammable Liquids Quantity (Liters)">
              <Input
                type="number"
                value={formData.flammableLiquidsQty}
                onChange={(v) => updateField("flammableLiquidsQty", v)}
                placeholder="Volume in liters"
              />
            </Field>
            <Field label="Gas Cylinders Count">
              <Input
                type="number"
                value={formData.gasCylindersCount}
                onChange={(v) => updateField("gasCylindersCount", v)}
                placeholder="Total cylinders"
              />
            </Field>
            <Field label="Storage Location Description">
              <Input
                value={formData.hazardStorageLoc}
                onChange={(v) => updateField("hazardStorageLoc", v)}
                placeholder="e.g. Storage Room A-3, Back Yard"
              />
            </Field>
            <Field label="MSDS Available on Site">
              <Select
                value={formData.msdsAvailable}
                onChange={(v) => updateField("msdsAvailable", v)}
                options={["Yes", "No"]}
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Emergency Information →
        </button>
      </div>
    </div>
  );
}

// ── Tab 8: Emergency Information ───────────────────────────────────────────

function EmergencyInfoForm({
  formData,
  errors,
  updateField,
  onNext,
}: {
  formData: FormData;
  errors: ValidationErrors;
  updateField: (f: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Emergency & Assessment Info
        </h2>
        <p className="text-sm text-muted-foreground">
          Audit tracking parameters, lead inspector, and emergency contact registries.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assessment Date">
          <Input
            type="date"
            value={formData.assessmentDate}
            onChange={(v) => updateField("assessmentDate", v)}
          />
        </Field>
        <Field label="Assessor Name *" error={errors.assessorName}>
          <Input
            value={formData.assessorName}
            onChange={(v) => updateField("assessorName", v)}
            placeholder="Full name of assessor"
            error={!!errors.assessorName}
          />
        </Field>
        <Field label="Emergency Contact Person">
          <Input
            value={formData.emergencyContactName}
            onChange={(v) => updateField("emergencyContactName", v)}
            placeholder="e.g. Chief Fire Warden"
          />
        </Field>
        <Field label="Emergency Contact Phone">
          <Input
            value={formData.emergencyContactPhone}
            onChange={(v) => updateField("emergencyContactPhone", v)}
            placeholder="+1 555-0199"
          />
        </Field>
      </div>
      <Field label="Remarks / Audit Notes">
        <textarea
          value={formData.remarks}
          onChange={(e) => updateField("remarks", e.target.value)}
          placeholder="Add any additional notes, observations, or evacuation instructions..."
          rows={4}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </Field>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Next: Documents & CAD Upload →
        </button>
      </div>
    </div>
  );
}

// ── Tab 9: Documents (CAD Upload) ──────────────────────────────────────────────

function CADUploadForm({
  files,
  setFiles,
}: {
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const simulateUpload = (file: File, category: string) => {
    const id = `${file.name}-${Date.now()}`;
    const newFile: UploadedFile = { file, id, category, progress: 0, status: "uploading" };
    setFiles((prev) => [...prev, newFile]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: 100, status: "complete" } : f)),
        );
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: Math.min(progress, 99) } : f)),
        );
      }
    }, 250);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        simulateUpload(file, "Floor Plan");
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateCategory = (id: string, category: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)));
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="h-8 w-8 text-red-500" />;
    if (ext === "png" || ext === "jpg" || ext === "jpeg")
      return <FileImage className="h-8 w-8 text-blue-500" />;
    return <FileArchive className="h-8 w-8 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">CAD Drawing & Documents Upload</h2>
        <p className="text-sm text-muted-foreground">
          Upload building layouts, floor blueprints, fire safety diagrams, and evacuation maps.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 bg-secondary/20"
        }`}
      >
        <div
          className={`h-14 w-14 rounded-full flex items-center justify-center mb-4 transition-colors ${dragOver ? "bg-primary/20" : "bg-primary/10"}`}
        >
          <Upload
            className={`h-7 w-7 ${dragOver ? "text-primary animate-bounce" : "text-primary"}`}
          />
        </div>
        <h3 className="font-semibold text-base mb-1">Drag & Drop drawings here</h3>
        <p className="text-sm text-muted-foreground mb-4">or click to browse your computer</p>
        <span className="rounded-md bg-secondary border border-border px-4 py-2 text-sm font-medium">
          Select CAD Drawing
        </span>
        <p className="text-xs text-muted-foreground mt-4">
          Supported: .dwg, .dxf, .pdf, .png, .jpg — Multiple files allowed
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            Uploaded Drawings{" "}
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          </h4>
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-4 bg-background">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(f.file.name)}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(f.file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      value={f.category}
                      onChange={(e) => updateCategory(f.id, e.target.value)}
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    >
                      {CAD_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {f.status === "complete" && (
                      <span className="text-xs font-medium text-risk-green bg-risk-green/10 px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </span>
                    )}
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-muted-foreground hover:text-risk-red p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {f.status === "uploading" && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(f.progress)}% uploaded
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 5: Review ──────────────────────────────────────────────────────────

function ReviewSection({ formData, files }: { formData: FormData; files: UploadedFile[] }) {
  const sections = [
    {
      title: "General Information",
      icon: Info,
      items: [
        ["Building Name", formData.buildingName],
        ["Building ID", formData.buildingId],
        ["Owner", formData.ownerName],
        ["Contact Phone", formData.contactNumber],
        ["Email", formData.email],
        ["Address", [formData.addressLine1, formData.addressLine2].filter(Boolean).join(", ")],
        ["City", formData.city],
        ["State", formData.state],
        ["Country", formData.country],
        ["Postal Code", formData.postalCode],
        ["Latitude", formData.latitude],
        ["Longitude", formData.longitude],
      ],
    },
    {
      title: "Building Details",
      icon: Sliders,
      items: [
        ["Type", formData.buildingType],
        ["Category", formData.functionalCategory],
        ["Built Area", formData.builtUpArea ? `${formData.builtUpArea} sq.m` : ""],
        ["Year Built", formData.yearOfConstruction],
        ["Height", formData.buildingHeight ? `${formData.buildingHeight} m` : ""],
        ["Construction Type", formData.constructionType],
        ["Fire Resistance Rating", formData.fireResistanceRating],
      ],
    },
    {
      title: "Occupancy Details",
      icon: Users,
      items: [
        ["Occupancy", formData.occupancyType],
        ["Floors count", formData.numberOfFloors],
        ["Avg. People/Floor", formData.peoplePerFloor],
        ["Daily Occupants Total", formData.averageDailyOccupants],
      ],
    },
    {
      title: "Fire Protection Systems",
      icon: Flame,
      items: [
        ["Sprinklers", formData.sprinklerSystem],
        ["Alarms", formData.fireAlarmSystem],
        ["Smoke Detectors", formData.smokeDetectors],
        ["Wet Risers", formData.wetRisers],
        ["Hose Reels", formData.hoseReels],
        ["Extinguishers count", formData.fireExtinguishersCount],
      ],
    },
    {
      title: "Utilities",
      icon: Zap,
      items: [
        ["Primary Power", formData.primaryPower],
        ["Backup Gen", formData.backupGenerator],
        ["Gas Valve Shutoff", formData.gasShutoff],
        ["Water Supply", formData.waterSupply],
        ["Elec Room Location", formData.electricalRoomLoc],
      ],
    },
    {
      title: "Structural Details",
      icon: Ruler,
      items: [
        ["Lifts count", formData.numberOfLifts],
        ["Staircases count", formData.numberOfStaircases],
        ["Windows count", formData.numberOfWindows],
        [
          "Adjacent building dist",
          formData.adjacentBuildingDistance ? `${formData.adjacentBuildingDistance} m` : "",
        ],
        ["Main Material", formData.mainConstructionMaterial],
        ["Roof Structure", formData.roofConstructionType],
      ],
    },
    {
      title: "Hazardous Materials",
      icon: AlertTriangle,
      items: [
        ["HazMat Present", formData.hazardousMaterialsPresent],
        [
          "Flammable liquids",
          formData.flammableLiquidsQty ? `${formData.flammableLiquidsQty} Liters` : "",
        ],
        ["Gas Cylinders count", formData.gasCylindersCount],
        ["Storage Location", formData.hazardStorageLoc],
        ["MSDS Available", formData.msdsAvailable],
      ],
    },
    {
      title: "Emergency & Assessment Info",
      icon: PhoneCall,
      items: [
        ["Audit Date", formData.assessmentDate],
        ["Assessor", formData.assessorName],
        ["Emergency Contact", formData.emergencyContactName],
        ["Emergency Contact Phone", formData.emergencyContactPhone],
        ["Audit Remarks", formData.remarks],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-xl font-bold">Review Your Submission</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verify all information categories before submitting. Use the action buttons below to
          complete.
        </p>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        const filledItems = section.items.filter(([, v]) => v);
        if (filledItems.length === 0) return null;
        return (
          <div key={section.title} className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{section.title}</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {filledItems.map(([label, value]) => (
                <div key={label} className="px-4 py-3 bg-card">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium mt-0.5 break-words">{value}</dd>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* CAD Files */}
      {files.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">CAD Files & Documents ({files.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {files.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between bg-card">
                <span className="text-sm">{f.file.name}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {f.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────────

function PreviewModal({
  formData,
  files,
  onClose,
}: {
  formData: FormData;
  files: UploadedFile[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-xl border border-border shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur flex items-center justify-between px-6 py-4 border-b border-border z-10">
          <h2 className="text-lg font-bold">Assessment Preview Summary</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <ReviewSection formData={formData} files={files} />
        </div>
      </div>
    </div>
  );
}

// ── Additional Categories Table ────────────────────────────────────────────────

function AdditionalCategoriesTable() {
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const filteredData = ADDITIONAL_CATEGORIES_DATA.filter(
    (item) =>
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.examples.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) =>
    sortAsc ? a.category.localeCompare(b.category) : b.category.localeCompare(a.category),
  );

  const exportCsv = () => {
    const csvContent =
      "Category,Examples\n" +
      filteredData.map((row) => `"${row.category}","${row.examples}"`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "additional_categories.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Additional Functional Categories</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f4f4f5; }
            </style>
          </head>
          <body>
            <h2>Additional Functional Categories</h2>
            <p>Often Used in Planning & Architecture</p>
            <table>
              <thead>
                <tr><th>Category</th><th>Examples</th></tr>
              </thead>
              <tbody>
                ${filteredData.map((row) => `<tr><td>${row.category}</td><td>${row.examples}</td></tr>`).join("")}
              </tbody>
            </table>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Additional Functional Categories{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (Often Used in Planning & Architecture)
          </span>
        </h3>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
        These additional categories are commonly used in planning, architecture, occupancy
        classification, and fire vulnerability assessments.
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-border bg-muted/20">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={exportCsv}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> Export
              Excel
            </button>
            <button
              onClick={exportPdf}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> Export PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold w-1/3">
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors uppercase tracking-wider"
                  >
                    Category <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 font-semibold tracking-wider">
                  Examples
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.length > 0 ? (
                filteredData.map((row) => {
                  const Icon = row.icon;
                  return (
                    <tr key={row.category} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        {row.category}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground leading-relaxed">
                        {row.examples}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-muted-foreground">
                    No categories found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Reusable UI Components ─────────────────────────────────────────────────────

const inputClasses =
  "flex h-10 w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm shadow-sm transition-all duration-300 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const selectClasses =
  "flex h-10 w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const errorInputClasses = "border-risk-red focus-visible:ring-risk-red";

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClasses} ${error ? errorInputClasses : ""}`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${selectClasses} ${error ? errorInputClasses : ""}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-muted-foreground">{label}</span>
      {children}
      {error && (
        <span className="flex items-center gap-1 mt-1 text-xs text-risk-red">
          <AlertCircle className="h-3 w-3" /> {error}
        </span>
      )}
    </label>
  );
}
