import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "danger" | "warn" | "success";
  hint?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    danger: "text-risk-red",
    warn: "text-risk-orange",
    success: "text-risk-green",
  }[tone];
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors">{label}</div>
        <div className={`p-2 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50 shadow-inner group-hover:bg-background transition-colors`}>
          <Icon className={`h-5 w-5 ${toneClass}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className={`text-3xl font-extrabold tabular-nums tracking-tight ${toneClass}`}>{value}</div>
        {hint && <div className="mt-1.5 text-xs text-muted-foreground/80 font-medium">{hint}</div>}
      </div>
    </div>
  );
}
