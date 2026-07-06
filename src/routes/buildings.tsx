import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
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
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all duration-300 ease-in-out"
        >
          <Plus className="h-3.5 w-3.5" /> Add Building
        </button>
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
              className="group rounded-lg border border-border bg-card/60 backdrop-blur-sm p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 ease-in-out"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {b.type}
                  </div>
                  <h3 className="mt-0.5 text-base font-semibold truncate">{b.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{b.address}</p>
                </div>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Floors" value={b.floors} />
                <Stat label="Area (m²)" value={b.totalArea.toLocaleString()} />
                <Stat label="FRR" value={b.fireResistanceRating} />
              </dl>
              <div className="mt-4 flex gap-2">
                <Link
                  to="/floor-plans"
                  className="flex-1 text-center rounded-md border border-border bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/60 transition-all duration-300 ease-in-out"
                >
                  Floor Plans
                </Link>
                <button
                  onClick={() => setEditing(b)}
                  className="grid h-8 w-8 place-items-center rounded-md border border-border bg-secondary hover:bg-secondary/60 transition-all duration-300 ease-in-out"
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
                  className="grid h-8 w-8 place-items-center rounded-md border border-border bg-secondary hover:bg-risk-red/10 hover:text-risk-red transition-all duration-300 ease-in-out"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <BuildingForm
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
    <div className="rounded-md bg-secondary px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-xs">{value}</div>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">
            {"id" in initial && initial.id ? "Edit Building" : "Add Building"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const { id: _id, createdAt: _c, ...rest } = form as Building;
            onSave(rest);
          }}
          className="grid gap-3 p-5"
        >
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as BuildingType })}
                className="input"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Floors">
              <input
                type="number"
                min={1}
                value={form.floors}
                onChange={(e) => setForm({ ...form, floors: +e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Address">
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Area (m²)">
              <input
                type="number"
                value={form.totalArea}
                onChange={(e) => setForm({ ...form, totalArea: +e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Fire Resistance Rating">
              <input
                value={form.fireResistanceRating}
                onChange={(e) => setForm({ ...form, fireResistanceRating: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Construction Type">
            <input
              value={form.constructionType}
              onChange={(e) => setForm({ ...form, constructionType: e.target.value })}
              className="input"
            />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
