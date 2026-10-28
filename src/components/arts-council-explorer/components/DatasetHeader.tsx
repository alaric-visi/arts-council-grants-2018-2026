import { Database } from "lucide-react";
import { formatFY, isFYInProgress } from "../lib/fiscal";
import { formatAmount } from "../lib/format";
import type { DataSource, DatasetMeta } from "../lib/types";

const BADGE: Record<DataSource, { label: string; tone: "ok" | "warn" }> = {
  supabase: { label: "Supabase live DB", tone: "ok" },
  static: { label: "Static dataset", tone: "ok" },
  props: { label: "Provided dataset", tone: "ok" },
  sample: { label: "Sample data only", tone: "warn" }
};

export const DatasetHeader = ({
  meta,
  source,
  showBadge
}: {
  meta: DatasetMeta | null;
  source: DataSource | null;
  showBadge: boolean;
}) => {
  const years = meta?.funding_years ?? [];
  const first = years[0]?.funding_year;
  const last = years[years.length - 1];
  const badge = source ? BADGE[source] : null;
  // Judged now rather than at build time, so an old build doesn't keep calling a finished year "in progress".

  return (
    <header className="mb-8">
      <h1 className="m-0 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white mb-3">
        Arts Council Funding
      </h1>

      <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/60 mb-4 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        <span>Public Funding Datasets</span>
        <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
        <span className="text-white/50">2018–2026 Archive</span>
        {showBadge && badge && (
          <>
            <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden="true" />
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono border ${
                badge.tone === "ok"
                  ? "border-emerald-800/80 bg-emerald-950/60 text-emerald-400"
                  : "border-amber-800/80 bg-amber-950/60 text-amber-400"
              }`}
            >
              <Database className="w-3 h-3" />
              {badge.label}
            </div>
          </>
        )}
      </div>

      <p className="m-0 max-w-[65ch] text-sm sm:text-base text-white/70 leading-relaxed font-light">
        {meta && meta.row_count > 0 && first && last ? (
          <>
            An interactive archive of <strong className="text-white font-medium">{meta.row_count.toLocaleString()}</strong> National Lottery Project
            Grants worth <strong className="text-white font-medium">{formatAmount(meta.total_awarded)}</strong>, awarded{" "}
            {first === last.funding_year
              ? `in ${formatFY(first)}`
              : `from ${formatFY(first)} to ${formatFY(last.funding_year)}`}
            .{isFYInProgress(last.funding_year) && ` ${formatFY(last.funding_year)} is still in progress, so its figures are incomplete.`}
          </>
        ) : (
          "An interactive archive of National Lottery Project Grants awarded by Arts Council England."
        )}
      </p>
    </header>
  );
};
