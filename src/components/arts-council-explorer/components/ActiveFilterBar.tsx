import { X } from "lucide-react";
import type { ExplorerDispatch } from "../state/useExplorerState";
import { activeFilters } from "../lib/filters";
import type { ActiveFilter, CategoryField, FilterState } from "../lib/filters";
import { formatFY } from "../lib/fiscal";
import { formatISODate } from "../lib/format";
import { amountPhrase } from "../lib/summary";
import { QUINTILE_LABELS } from "../lib/places";
import { FOCUS_RING } from "./ui";

const FIELD_NAME: Record<CategoryField, string> = {
  years: "Year",
  areas: "Area",
  localAuthorities: "Local authority",
  disciplines: "Discipline",
  strands: "Strand",
  priorities: "Priority",
  recipientTypes: "Recipient type",
  placeGroups: "Places",
  deprivation: "Deprivation"
};
const RECIPIENT_TYPE_LABEL: Record<string, string> = {
  organisation: "Organisations (inferred)",
  individual: "Individuals (inferred)",
  unknown: "Unclear from name"
};

const chipText = (filter: ActiveFilter, f: FilterState, groupLabel: (id: string) => string): { name: string; value: string } => {
  switch (filter.kind) {
    case "search": {
      const where = f.searchIn === "recipient" ? " in recipients" : f.searchIn === "activity" ? " in projects" : "";
      return { name: "Search", value: `“${f.q.trim()}”${where}` };
    }
    case "amount":
      return { name: "Amount", value: amountPhrase(f.amountOver, f.amountUpTo)!.replace(/^of /, "") };
    case "dates":
      return {
        name: "Awarded",
        value:
          f.dateFrom && f.dateTo
            ? `${formatISODate(f.dateFrom)} to ${formatISODate(f.dateTo)}`
            : f.dateFrom
              ? `from ${formatISODate(f.dateFrom)}`
              : `up to ${formatISODate(f.dateTo!)}`
      };
    case "value":
      return {
        name: FIELD_NAME[filter.field],
        value:
          filter.field === "years"
            ? formatFY(filter.value)
            : filter.field === "recipientTypes"
              ? RECIPIENT_TYPE_LABEL[filter.value] ?? filter.value
              : filter.field === "placeGroups"
                ? groupLabel(filter.value)
                : filter.field === "deprivation"
                  ? QUINTILE_LABELS[filter.value] ?? filter.value
                  : filter.value
      };
  }
};

const keyOf = (f: ActiveFilter) => (f.kind === "value" ? `${f.field}:${f.value}` : f.kind);

/** Sticky bar: how many grants are shown, and every active filter value as a removable chip. */
export const ActiveFilterBar = ({
  filters,
  shown,
  total,
  dispatch,
  groupLabel = (id) => id
}: {
  filters: FilterState;
  shown: number;
  total: number;
  dispatch: ExplorerDispatch;
  /** Names designation ids for their chips. */
  groupLabel?: (id: string) => string;
}) => {
  const active = activeFilters(filters);
  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-black/80 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center gap-2 text-xs">
      <p className="font-mono text-white/60 mr-2 text-[11px]" aria-live="polite" aria-atomic="true">
        Showing <strong className="text-white font-medium">{shown.toLocaleString("en-GB")}</strong> of {total.toLocaleString("en-GB")} grants
      </p>
      {active.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {active.map((filter) => {
            const { name, value } = chipText(filter, filters, groupLabel);
            return (
              <li key={keyOf(filter)} className="pl-2.5 pr-1 py-0.5 bg-white/5 border border-white/10 rounded-md flex items-center gap-1.5 text-[11px] font-mono text-white/90">
                <span>
                  <span className="text-white/50">{name}:</span> {value}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    dispatch(
                      filter.kind === "value"
                        ? { type: "removeValue", field: filter.field, value: filter.value }
                        : { type: "clear", filter: filter.kind }
                    )
                  }
                  aria-label={`Remove filter ${name}: ${value}`}
                  className={`p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white cursor-pointer ${FOCUS_RING}`}
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {active.length > 0 && (
        <button
          type="button"
          onClick={() => dispatch({ type: "clearFilters" })}
          className={`ml-auto px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-white/70 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
        >
          Clear all
        </button>
      )}
    </div>
  );
};
