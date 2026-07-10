import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, type Building, type BuildingType } from "@/lib/db";
import { logActivity } from "@/lib/db";

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
const EMPTY: Omit<Building, "id" | "createdAt"> = {
  name: "",
  type: "Office",
  address: "",
  floors: 1,
  totalArea: 0,
  constructionType: "Type I — Non-combustible",
  fireResistanceRating: "1-hour",
};

function BuildingsPage() {
  const buildings = useLiveQuery(() => db.buildings.orderBy("id").reverse().toArray(), []);
  const [editing, setEditing] = useState<Building | null>(null);
  const [creating, setCreating] = useState(false);

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
      {buildings && buildings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No buildings yet"
          description="Add your first building to begin configuring floors and zones."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buildings?.map((b) => (
            <div
              key={b.id}
              className="group flex flex-col justify-between rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ease-in-out"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      {b.type}
                    </div>
                    <h3 className="mt-1 text-lg font-bold truncate">{b.name}</h3>
                    <p className="text-xs text-muted-foreground/80 truncate font-medium">{b.address}</p>
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background/50 backdrop-blur-sm border border-border/50 text-primary shadow-inner group-hover:bg-background transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <Stat label="Floors" value={b.floors} />
                  <Stat label="Area (m²)" value={b.totalArea.toLocaleString()} />
                  <Stat label="FRR" value={b.fireResistanceRating} />
                </dl>
              </div>
              <div className="mt-6 flex gap-2">
                <Link
                  to="/floor-plans"
                  className="flex-1 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium shadow-sm hover:bg-muted/80 transition-colors"
                >
                  Floor Plans
                </Link>
                <button
                  onClick={() => setEditing(b)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground shadow-sm hover:bg-muted/80 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
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
                  className="grid h-9 w-9 place-items-center rounded-md border border-border/60 bg-background/50 text-muted-foreground hover:text-risk-red hover:bg-risk-red/10 hover:border-risk-red/20 shadow-sm transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BuildingForm
          key={editing ? editing.id : "new"}
          initial={editing ?? { ...EMPTY }}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (data) => {
            if (editing) {
              await db.buildings.update(editing.id!, data);
              await logActivity("building", `Updated ${data.name}`);
            } else {
              await db.buildings.add({ ...(data as Omit<Building, "id">), createdAt: Date.now() });
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-background/40 backdrop-blur-sm border border-border/40 p-2 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="font-mono text-xs font-bold text-foreground">{value}</div>
    </div>
  );
}

function BuildingForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Omit<Building, "id" | "createdAt"> | Building;
  onClose: () => void;
  onSave: (b: Omit<Building, "id" | "createdAt">) => void;
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
            const { id: _id, createdAt: _c, ...rest } = form as Building;
            onSave(rest);
          }}
          className="p-6 space-y-5"
        >
          <Field label="Building Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Headquarters"
            />
          </Field>
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
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
