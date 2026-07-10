import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Users, Info, Calendar, Clock, Activity, Settings, MapPin, ChevronDown, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/occupancy")({
  head: () => ({
    meta: [
      { title: "Occupancy — WB-FDVA" },
      { name: "description", content: "Occupancy heatmaps and overrides per zone and time." },
    ],
  }),
  component: OccupancyPage,
});

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function OccupancyPage() {
  const zones = useLiveQuery(() => db.zones.toArray(), []);
  const [zoneId, setZoneId] = useState<number | null>(null);

  const heat = DAYS.map((d, di) =>
    HOURS.map((h) => {
      const weekday = di < 5 ? 1 : 0.4;
      const office = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      return Math.round(weekday * office * 100);
    }),
  );

  const trend = HOURS.map((h) => ({
    hour: `${h}:00`,
    value: Math.round(Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 100),
  }));

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    start: "09:00",
    end: "11:00",
    expected: 25,
    label: "Conference Room A",
  });
  const overrides = useLiveQuery(
    () =>
      zoneId
        ? db.occupancy.where("zoneId").equals(zoneId).reverse().toArray()
        : Promise.resolve([] as any[]),
    [zoneId],
  );

  return (
    <AppShell 
      title={
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary opacity-90" />
          <span>Occupancy</span>
        </div>
      }
      subtitle={
        <span className="text-[11px] font-medium opacity-60 tracking-wide uppercase">
          Time-of-day, day-of-week, and override management
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground flex items-center gap-2">
              Weekly Heatmap <Info className="h-3 w-3 text-muted-foreground/70 cursor-help" />
            </h3>
            <select className="bg-secondary/40 border border-border/50 text-[10px] rounded-md px-2.5 py-1.5 uppercase tracking-wider font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="overflow-x-auto relative z-10 pb-2">
            <div
              className="inline-grid gap-1.5"
              style={{ gridTemplateColumns: `64px repeat(24, minmax(20px, 1fr))` }}
            >
              <div />
              {HOURS.map((h) => (
                <div key={h} className="text-[9px] font-semibold text-center text-muted-foreground/80 mb-1">
                  {h}
                </div>
              ))}
              {DAYS.map((d, di) => (
                <DayRow key={d} label={d} values={heat[di]} />
              ))}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest relative z-10 border-t border-border/40 pt-4">
            <span>Low</span>
            <div className="flex gap-1.5">
              {[10, 30, 50, 70, 90].map((v) => (
                <span
                  key={v}
                  className="h-3.5 w-8 rounded-sm shadow-sm"
                  style={{ background: `rgba(229, 90, 50, ${v / 100})` }}
                />
              ))}
            </div>
            <span>High</span>
          </div>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Occupancy</h4>
              </div>
              <div className="text-3xl font-mono font-black text-foreground">72</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-1">People currently inside</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm group hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-risk-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-risk-green" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today's Change</h4>
              </div>
              <div className="text-3xl font-mono font-black text-risk-green flex items-baseline">
                +18<span className="text-lg">%</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-risk-green" /> Compared with yesterday
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm flex-1 flex flex-col min-h-[260px] group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Daily Trend
              </h3>
              <select className="bg-secondary/40 border border-border/50 text-[10px] rounded-md px-2.5 py-1.5 uppercase tracking-wider font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option>Today</option>
                <option>Yesterday</option>
              </select>
            </div>
            <div className="flex gap-5 mb-4 px-1">
              <div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Peak</div>
                <div className="font-mono text-base font-bold text-foreground">100</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Current</div>
                <div className="font-mono text-base font-bold text-primary">72</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Avg</div>
                <div className="font-mono text-base font-bold text-muted-foreground/80">45</div>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                <AreaChart data={trend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(var(--card), 0.95)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                      backdropFilter: "blur(8px)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-6 border-b border-border/40 pb-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-wide text-foreground">Manual Occupancy Override</h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Configure temporary zone occupancy targets</p>
          </div>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-2 space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Zone</span>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <select
                value={zoneId ?? ""}
                onChange={(e) => setZoneId(+e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="">Select zone…</option>
                {zones?.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zoneId} · {z.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Date</span>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="date"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Start Time</span>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="time"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
          </label>
          
          <label className="space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">End Time</span>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="time"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </div>
          </label>
          
          <label className="lg:col-span-5 sm:col-span-2 md:col-span-1 space-y-2 group/label">
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground group-focus-within/label:text-primary transition-colors">Expected Occupancy</span>
            <div className="relative">
              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 group-focus-within/label:text-primary transition-colors" />
              <input
                type="number"
                placeholder="Enter expected headcount..."
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border/60 bg-secondary/40 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={form.expected}
                onChange={(e) => setForm({ ...form, expected: +e.target.value })}
              />
            </div>
          </label>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/40">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 w-full sm:w-auto flex-1 max-w-xl">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Override Information</h4>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                Manual occupancy overrides temporarily replace system-calculated occupancy for the selected zone and time period. This affects live risk score calculations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/60 hover:bg-secondary/80 text-xs font-bold text-foreground transition-all shadow-sm">
              View Override History
            </button>
            <button
              disabled={!zoneId}
              onClick={async () => {
                if (!zoneId) return;
                await db.occupancy.add({
                  zoneId,
                  date: form.date,
                  startTime: form.start,
                  endTime: form.end,
                  expectedOccupancy: form.expected,
                  label: form.label,
                });
                await db.zones.update(zoneId, { occupancy: form.expected });
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-primary hover:from-blue-500 hover:to-blue-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              Save Override
            </button>
          </div>
        </div>
        
        {(overrides?.length ?? 0) > 0 && (
          <div className="mt-8 border-t border-border/40 pt-6">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Recent Overrides</h4>
            <ul className="divide-y divide-border/40 text-xs">
              {overrides?.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3 group hover:bg-secondary/20 px-3 -mx-3 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-secondary border border-border/50 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium">
                      <span className="text-muted-foreground">{o.date}</span>
                      <span className="mx-2 text-muted-foreground/50">·</span>
                      <span className="font-mono">{o.startTime} – {o.endTime}</span>
                    </span>
                  </div>
                  <span className="font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-md">{o.expectedOccupancy} pax</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DayRow({ label, values }: { label: string; values: number[] }) {
  return (
    <>
      <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-2">{label}</div>
      {values.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-[3px] hover:scale-125 hover:z-10 hover:shadow-md transition-transform origin-center cursor-crosshair border border-black/10 dark:border-white/5"
          style={{ background: `rgba(229, 90, 50, ${Math.max(0.05, Math.min(1, v / 100))})` }}
          title={`${label} at ${i}:00\nOccupancy: ${v}%`}
        />
      ))}
    </>
  );
}
