import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { ZONE_MULTIPLIER } from "@/lib/vulnerability";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Save, RefreshCw, Database } from "lucide-react";
import { seedAllModules } from "@/lib/seed";
import { syncFullDatabase } from "@/services/dbSync";


export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WB-FDVA" },
      { name: "description", content: "Application preferences, templates, and zone multipliers." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [mult, setMult] = useState(ZONE_MULTIPLIER);
  const [orgName, setOrgName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wb-org-name") || "TrustGrid.AI Demo Org";
    }
    return "TrustGrid.AI Demo Org";
  });
  const [mapsApiKey, setMapsApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wb-maps-api-key") || "";
    }
    return "";
  });

  const handleSave = () => {
    localStorage.setItem("wb-org-name", orgName);
    localStorage.setItem("wb-maps-api-key", mapsApiKey);
    toast.success("Settings saved successfully");
  };

  return (
    <AppShell
      title="Settings"
      subtitle="System preferences, API configurations, and assessment parameters"
      actions={
        <button
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          onClick={handleSave}
        >
          <Save className="h-3.5 w-3.5" /> Save Changes
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Organization Profile"
          description="Manage your organization's branding and display name."
        >
          <label className="block text-xs mb-3">
            <span className="block text-muted-foreground mb-1">Organization Name</span>
            <input
              className="input w-full"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              defaultChecked
            />{" "}
            Enable TrustGrid.AI Branding
          </label>
        </Section>

        <Section title="Integrations & APIs" description="Manage external service connections.">
          <label className="block text-xs mb-3">
            <span className="block text-muted-foreground mb-1">Google Maps API Key</span>
            <input
              type="password"
              placeholder="AIzaSy..."
              className="input w-full"
              value={mapsApiKey}
              onChange={(e) => setMapsApiKey(e.target.value)}
            />
          </label>
          <label className="block text-xs">
            <span className="block text-muted-foreground mb-1">Weather Service API</span>
            <input type="password" placeholder="Optional..." className="input w-full" />
          </label>
        </Section>

        <Section
          title="Assessment Parameters & Formula Configuration"
          description="Tune the vulnerability scoring algorithm variables."
        >
          <div className="space-y-3">
            <div className="p-3 bg-secondary/50 rounded-md border border-border">
              <h4 className="text-xs font-semibold mb-2">Base Formula:</h4>
              <code className="text-[10px] text-muted-foreground block">
                Score = (FireLoad × OccDensity × Exposure) / (Protection × Exits)
              </code>
            </div>
            {(
              [
                "Fire Load Base (MJ/m²)",
                "Occupancy Density Multiplier",
                "Exposure Factor Base",
                "Evacuation Difficulty Base",
              ] as const
            ).map((k) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span>{k}</span>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="1.0"
                  className="input w-24 text-right"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Zone Multipliers"
          description="Used in the impact magnitude formula (display only — engine uses defaults)."
        >
          {(["RED", "ORANGE", "YELLOW", "SAFE"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="capitalize text-xs font-medium">{k}</span>
              <input
                type="number"
                step="0.1"
                value={mult[k]}
                onChange={(e) => setMult({ ...mult, [k]: +e.target.value })}
                className="input w-24 text-right"
              />
            </div>
          ))}
        </Section>

        <Section
          title="Notification Settings"
          description="Configure alerts and emergency broadcasts."
        >
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                defaultChecked
              />{" "}
              SMS Alerts for Critical Incidents
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                defaultChecked
              />{" "}
              Push Notifications (Mobile App)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                defaultChecked
              />{" "}
              Email Reports (Weekly Audit)
            </label>
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                defaultChecked
              />{" "}
              Automated EMS Dispatch Routing
            </label>
          </div>
        </Section>

        <Section title="Data Management & Google Sheets Sync" description="Manage multi-module database entries and sync with Google Sheets backend.">
          <div className="space-y-2">
            <button
              onClick={async () => {
                toast.info("Seeding all 9 modules with Indian data...");
                try {
                  const res = await seedAllModules();
                  toast.success(`Seeded ${res.buildings} buildings, ${res.personnel} personnel, ${res.fireInventory} inventory, ${res.incidents} incidents & ${res.occupancy} occupancy events!`);
                } catch (err: any) {
                  toast.error("Seeding error: " + (err.message || String(err)));
                }
              }}
              className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary w-full text-center hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Seed All Modules & Push to Google Sheets
            </button>

            <button
              onClick={async () => {
                toast.info("Fetching database from Google Sheets...");
                try {
                  await syncFullDatabase();
                  toast.success("Full database synced from Google Sheets!");
                } catch (err: any) {
                  toast.error("Sync error: " + (err.message || String(err)));
                }
              }}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground w-full text-center hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
            >
              <Database className="h-3.5 w-3.5 text-muted-foreground" /> Fetch & Re-Sync from Google Sheets
            </button>

            <button
              onClick={async () => {
                if (!confirm("This wipes all local data and re-seeds all modules. Continue?")) return;
                await Promise.all([
                  db.buildings.clear(),
                  db.floors.clear(),
                  db.zones.clear(),
                  db.personnel.clear(),
                  db.incidents.clear(),
                  db.occupancy.clear(),
                  db.fireInventory.clear(),
                  db.activity.clear(),
                ]);
                await seedAllModules();
                toast.success("Database reset & re-seeded across all modules.");
              }}
              className="rounded-md border border-risk-red/50 bg-risk-red/10 px-3 py-2 text-xs font-semibold text-risk-red w-full text-center hover:bg-risk-red/20 transition-colors"
            >
              Reset Local Database
            </button>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 h-full">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground mb-3">{description}</p>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
