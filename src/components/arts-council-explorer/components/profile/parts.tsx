import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { formatAmount, formatGBP, formatISODate } from "../../lib/format";
import { formatFY } from "../../lib/fiscal";
import type { NamedAmount } from "../../lib/aggregate";
import type { Grant } from "../../lib/types";
import { FOCUS_RING } from "../ui";

export const LINK = `text-left underline decoration-white/30 underline-offset-2 hover:decoration-white rounded cursor-pointer ${FOCUS_RING}`;
const PANEL = "p-5 sm:p-6 bg-white/[0.02] hover:bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl transition-colors";

export const ProfileShell = ({
  kind,
  title,
  subtitle,
  onBack,
  actions,
  children
}: {
  kind: string;
  title: string;
  subtitle?: ReactNode;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <article aria-labelledby="ace-profile-title" className="space-y-6">
    <div>
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex items-center gap-1.5 text-[11px] font-mono text-white/60 hover:text-white transition-colors px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex-shrink-0 cursor-pointer ${FOCUS_RING}`}
      >
        <span aria-hidden="true">←</span>
        Back to the explorer
      </button>
    </div>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase font-mono tracking-wider text-white/50">{kind}</p>
        {/* Focused on arrival so screen readers announce the page; not interactive, so no focus ring. */}
        <h2 id="ace-profile-title" className="text-3xl md:text-4xl font-semibold tracking-tight mt-1 text-white focus:outline-none">
          {title}
        </h2>
        {subtitle && <div className="text-white/70 text-sm sm:text-base mt-2 max-w-[70ch] font-light leading-relaxed">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
    {children}
  </article>
);

export const ActionButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono text-white/80 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
  >
    {children}
  </button>
);

export const KeyFigures = ({ items }: { items: Array<{ label: string; value: string; note?: string }> }) => (
  <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {items.map((item) => (
      <div key={item.label} className={PANEL}>
        <dt className="text-[11px] uppercase font-mono tracking-wider text-white/50">{item.label}</dt>
        <dd className="mt-3">
          <span className="block text-2xl sm:text-3xl font-medium tracking-tight text-white">{item.value}</span>
          {item.note && <span className="block text-[11px] text-white/40 mt-1 font-mono">{item.note}</span>}
        </dd>
      </div>
    ))}
  </dl>
);

export const Panel = ({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) => (
  <section aria-label={title} className={`${PANEL} ${className}`}>
    <h3 className="text-xs font-semibold tracking-wider uppercase text-white/80 font-mono mb-4">{title}</h3>
    {children}
  </section>
);

/**
 * Funding per year as HTML columns, readable by screen readers as a list.
 * Every year in the dataset is shown, so gaps between funded years are visible.
 */
export const YearColumns = ({ data, years }: { data: NamedAmount[]; years: readonly string[] }) => {
  const byYear = new Map(data.map((d) => [d.name, d]));
  const all = Array.from(new Set([...years, ...data.map((d) => d.name)])).sort();
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <ol className="flex items-end gap-2 h-48" aria-label="Funding by financial year">
      {all.map((name) => {
        const d = byYear.get(name) ?? { name, amount: 0, count: 0 };
        return (
        <li key={d.name} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <span className="text-[11px] font-mono text-white/80 mb-1">{d.amount > 0 ? formatAmount(d.amount) : <span className="sr-only">No grants</span>}</span>
          <span
            className={`w-full rounded-t ${d.amount > 0 ? "bg-teal-400/80" : "bg-white/15"}`}
            style={{ height: d.amount > 0 ? `${Math.max(2, (d.amount / max) * 75)}%` : "2px" }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-mono text-white/70 mt-1 truncate max-w-full">{formatFY(d.name)}</span>
        </li>
        );
      })}
    </ol>
  );
};

/** Ranked list with proportional bars; names can link to another profile. */
export const RankedBars = ({
  items,
  limit = 8,
  onSelect,
  note
}: {
  items: NamedAmount[];
  limit?: number;
  onSelect?: (name: string) => void;
  note?: (item: NamedAmount) => string | null;
}) => {
  const max = Math.max(1, ...items.map((i) => i.amount));
  const shown = items.slice(0, limit);
  return (
    <ol className="space-y-3">
      {shown.map((item) => (
        <li key={item.name}>
          <div className="flex justify-between gap-3 text-sm">
            {onSelect && item.name !== "Unspecified" ? (
              <button type="button" onClick={() => onSelect(item.name)} className={`${LINK} text-white truncate`}>
                {item.name}
              </button>
            ) : (
              <span className="text-white truncate">{item.name}</span>
            )}
            <span className="font-mono text-white shrink-0">{formatAmount(item.amount)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-white/65 mt-0.5">
            <span>
              {item.count.toLocaleString("en-GB")} {item.count === 1 ? "grant" : "grants"}
            </span>
            {note?.(item) && <span>{note(item)}</span>}
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full mt-1 overflow-hidden" aria-hidden="true">
            <div className="bg-white/50 h-full rounded-full" style={{ width: `${(item.amount / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {items.length > limit && (
        <li className="text-[11px] font-mono text-white/65">and {(items.length - limit).toLocaleString("en-GB")} more</li>
      )}
    </ol>
  );
};

export const GrantList = ({ grants, onOpen, limit = 50 }: { grants: readonly Grant[]; onOpen: (uid: string) => void; limit?: number }) => (
  <>
    <ul className="divide-y divide-white/10">
      {grants.slice(0, limit).map((g) => (
        <li key={g.uid}>
          <button type="button" onClick={() => onOpen(g.uid)} className={`w-full text-left py-3 px-1 hover:bg-white/5 rounded ${FOCUS_RING}`}>
            <span className="flex justify-between gap-3">
              <span className="text-white text-sm">{g.activity_name || "Untitled"}</span>
              <span className="font-mono text-white text-sm shrink-0">{formatGBP(g.award_amount)}</span>
            </span>
            <span className="block text-[11px] font-mono text-white/65 mt-1">
              {[g.award_date && formatISODate(g.award_date), g.recipient, g.main_discipline, g.local_authority_current].filter(Boolean).join(", ")}
            </span>
          </button>
        </li>
      ))}
    </ul>
    {grants.length > limit && (
      <p className="text-[11px] font-mono text-white/65 mt-3">Showing the {limit} most recent of {grants.length.toLocaleString("en-GB")}.</p>
    )}
  </>
);
