import { useId, useRef, useState } from "react";
import { ExportMenu } from "./ExportMenu";
import type { ReactNode } from "react";

import { FOCUS_RING } from "./focus";

export { FOCUS_RING };

const CARD = "bg-white/[0.02] hover:bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl transition-colors";

export const Card = ({
  children,
  className = "",
  padded = true
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) => <div className={`${padded ? "p-5 sm:p-6 " : ""}${CARD} ${className}`.trim()}>{children}</div>;

/** Pill toggle with pressed state, used for chart options. */
export const SegmentedToggle = <T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <div role="group" aria-label={label} className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10 text-[11px] font-mono">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${FOCUS_RING} ${
          value === option.value ? "bg-white text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const CHART_OR_TABLE = [
  { value: "chart", label: "Chart" },
  { value: "table", label: "Table" }
] as const;

/**
 * Card with a chart heading. When `table` is given, a Chart/Table switch
 * offers the same figures as an accessible table (and a keyboard way to filter).
 */
export const ChartCard = ({
  title,
  description,
  actions,
  table,
  children,
  className = "",
  exportName,
  csv,
  imageExport = true
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Enables the Download menu; used in file names. */
  exportName?: string;
  /** The chart's data as CSV, for the Download menu. */
  csv?: () => string;
  /** False for HTML visuals with no SVG to export (data download only). */
  imageExport?: boolean;
}) => {
  const [view, setView] = useState<"chart" | "table">("chart");
  const headingId = useId();
  const body = useRef<HTMLDivElement>(null);
  return (
    <section aria-labelledby={headingId} className={`relative has-[[data-popover-open]]:z-40 p-5 sm:p-6 ${CARD} flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-xs font-semibold tracking-wider uppercase text-white/80 font-mono">
            {title}
          </h3>
          <p className="text-xs text-white/50 mt-1 font-sans max-w-[60ch]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          {table && <SegmentedToggle label={`Show ${title.toLowerCase()} as`} options={CHART_OR_TABLE} value={view} onChange={setView} />}
          {exportName && (
            <ExportMenu
              title={title}
              name={exportName}
              chartRoot={body}
              csv={csv}
              images={imageExport}
              imageAvailable={view === "chart" || !table}
            />
          )}
        </div>
      </div>
      <div ref={body}>{view === "table" && table ? <div className="mt-5">{table}</div> : children}</div>
    </section>
  );
};

/** Plain table used as the accessible alternative to a chart. */
export const ChartTable = ({
  caption,
  columns,
  rows
}: {
  caption: string;
  columns: ReadonlyArray<{ label: string; align?: "right" }>;
  rows: ReadonlyArray<{ key: string; cells: ReactNode[]; selected?: boolean }>;
}) => (
  <div className="overflow-x-auto max-h-80 overflow-y-auto">
    <table className="w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-[11px] uppercase font-mono text-white/50 border-b border-white/10 bg-white/[0.02]">
          {columns.map((c) => (
            <th key={c.label} scope="col" className={`py-2 px-2.5 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {rows.map((row) => (
          <tr key={row.key} className={`hover:bg-white/[0.03] transition-colors ${row.selected ? "bg-emerald-950/40 text-emerald-300" : ""}`}>
            {row.cells.map((cell, i) => (
              <td key={i} className={`py-2 px-2.5 text-white/85 ${columns[i]?.align === "right" ? "text-right font-mono" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** "Filter"/"Selected" button for chart tables. */
export const FilterButton = ({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    aria-pressed={selected}
    aria-label={`${selected ? "Remove filter" : "Filter by"} ${label}`}
    onClick={onClick}
    className={`px-2 py-0.5 rounded border text-[11px] font-mono cursor-pointer transition-colors ${FOCUS_RING} ${
      selected
        ? "border-emerald-800/80 bg-emerald-950/60 text-emerald-400 font-semibold"
        : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
    }`}
  >
    {selected ? "Selected" : "Filter"}
  </button>
);
