import { Landmark, Receipt, Scale, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatAmount } from "../lib/format";
import type { Comparison, Stats } from "../lib/aggregate";

const change = (current: number, previous: number, label: string): string | null => {
  if (previous <= 0) return current > 0 ? `None in ${label}` : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "▲ " : pct < 0 ? "▼ " : ""}${pct > 0 ? "+" : ""}${pct}% vs ${label}`;
};

const StatCard = ({
  label,
  value,
  note,
  delta,
  icon: Icon
}: {
  label: string;
  value: string;
  note: string;
  delta?: string | null;
  icon: LucideIcon;
}) => {
  const isNegative = delta?.includes("▼");
  return (
    <div className="p-4 sm:p-5 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl flex flex-col justify-between transition-colors">
      <div className="flex justify-between items-start text-white/50">
        <h3 className="text-[11px] uppercase font-mono tracking-wider text-white/50">{label}</h3>
        <Icon className="w-4 h-4 text-white/40" aria-hidden="true" />
      </div>
      <div className="mt-3">
        <p className="text-2xl sm:text-3xl font-medium tracking-tight text-white">{value}</p>
        {delta && (
          <p className={`text-[11px] mt-1 font-mono ${isNegative ? "text-amber-400/90" : "text-emerald-400"}`}>
            {delta}
          </p>
        )}
        <p className="text-[11px] text-white/40 mt-1 font-mono">{note}</p>
      </div>
    </div>
  );
};

export const StatCards = ({ stats, comparison }: { stats: Stats; comparison: Comparison | null }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard
      label="Total Awarded"
      value={formatAmount(stats.totalAwarded)}
      delta={comparison && change(stats.totalAwarded, comparison.totalAwarded, comparison.label)}
      note="Combined total funding"
      icon={Landmark}
    />
    <StatCard
      label="Grants"
      value={stats.count.toLocaleString("en-GB")}
      delta={comparison && change(stats.count, comparison.count, comparison.label)}
      note="Matched award records"
      icon={Receipt}
    />
    <StatCard
      label="Median Award"
      value={formatAmount(stats.medianAward)}
      note={stats.count ? `Mean ${formatAmount(stats.avgAward)}, largest ${formatAmount(stats.maxAward)}` : "No grants in view"}
      icon={Scale}
    />
    <StatCard
      label="Recipients"
      value={stats.recipientCount.toLocaleString("en-GB")}
      note="Distinct recipients in view"
      icon={Users}
    />
  </div>
);
