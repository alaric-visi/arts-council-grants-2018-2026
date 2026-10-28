import { useId } from "react";
import { formatGBP, formatISODate } from "../lib/format";
import { formatFY } from "../lib/fiscal";
import type { SortField, SortOrder } from "../lib/filters";
import type { SearchScope } from "../lib/search";
import type { Grant } from "../lib/types";
import { Highlight } from "./Highlight";
import { FOCUS_RING } from "./ui";

const COLUMNS: ReadonlyArray<{ field: SortField; label: string; align?: "right" }> = [
  { field: "recipient", label: "Recipient" },
  { field: "activity_name", label: "Project Title" },
  { field: "award_amount", label: "Amount", align: "right" },
  { field: "award_date", label: "Date" },
  { field: "main_discipline", label: "Discipline" },
  { field: "ace_area", label: "Area" },
  { field: "funding_year", label: "Year" }
];

const SORT_CHOICES: ReadonlyArray<{ value: string; label: string }> = COLUMNS.flatMap(({ field, label }) => [
  { value: `${field}:desc`, label: `${label} (${field === "award_amount" ? "highest" : field === "award_date" || field === "funding_year" ? "newest" : "Z–A"} first)` },
  { value: `${field}:asc`, label: `${label} (${field === "award_amount" ? "lowest" : field === "award_date" || field === "funding_year" ? "oldest" : "A–Z"} first)` }
]);

const PAGE_BUTTON = `px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:pointer-events-none text-xs font-mono text-white/80 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`;

export interface GrantsTableProps {
  rows: readonly Grant[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onSetSort: (field: SortField, order: SortOrder) => void;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onOpen: (uid: string) => void;
  query: string;
  searchIn: SearchScope;
}

export const GrantsTable = ({
  rows,
  sortField,
  sortOrder,
  onSort,
  onSetSort,
  page,
  totalPages,
  onPage,
  onOpen,
  query,
  searchIn
}: GrantsTableProps) => {
  const sortId = useId();
  const recipientQuery = searchIn === "activity" ? "" : query;
  const activityQuery = searchIn === "recipient" ? "" : query;

  return (
    <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
      {/* Small screens: cards */}
      <div className="md:hidden">
        <div className="p-3.5 border-b border-white/10 bg-white/[0.03]">
          <label htmlFor={sortId} className="block text-[11px] uppercase font-mono tracking-wider text-white/50 mb-1.5">
            Sort by
          </label>
          <select
            id={sortId}
            value={`${sortField}:${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split(":") as [SortField, SortOrder];
              onSetSort(field, order);
            }}
            className={`w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white [color-scheme:dark] ${FOCUS_RING}`}
          >
            {SORT_CHOICES.map((c) => (
              <option key={c.value} value={c.value} className="bg-black text-white">
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {rows.length === 0 ? (
          <p className="py-16 text-center text-white/65 font-mono text-xs">No grants match the current filters.</p>
        ) : (
          <ul className="divide-y divide-white/10" aria-label="Grants">
            {rows.map((g) => (
              <li key={g.uid}>
                <button
                  type="button"
                  onClick={() => onOpen(g.uid)}
                  className={`w-full text-left p-4 hover:bg-white/5 ${FOCUS_RING} focus-visible:ring-inset focus-visible:ring-offset-0`}
                >
                  <span className="flex justify-between gap-3 items-baseline">
                    <span className="font-medium text-white">
                      <Highlight text={g.recipient} query={recipientQuery} />
                    </span>
                    <span className="font-mono text-white shrink-0">{formatGBP(g.award_amount)}</span>
                  </span>
                  <span className="block text-sm text-white/80 mt-1">
                    <Highlight text={g.activity_name} query={activityQuery} />
                  </span>
                  <span className="block text-xs text-white/65 mt-2 font-mono">
                    {[g.award_date ? formatISODate(g.award_date) : null, g.main_discipline, g.ace_area].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Larger screens: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Grants matching the current filters. Select a recipient to see full details.</caption>
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[11px] uppercase font-semibold tracking-wider text-white/60">
              {COLUMNS.map(({ field, label, align }) => {
                const active = sortField === field;
                return (
                  <th
                    key={field}
                    scope="col"
                    aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    className={`py-2.5 px-3 first:pl-4 ${align === "right" ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(field)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-white rounded cursor-pointer ${FOCUS_RING} ${active ? "text-white" : ""}`}
                    >
                      {label}
                      <span aria-hidden="true">{active ? (sortOrder === "asc" ? "▲" : "▼") : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs font-normal text-white/85">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-20 text-center text-white/65 font-mono text-xs">
                  No grants match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr key={g.uid} onClick={() => onOpen(g.uid)} className="hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <td className="py-2.5 px-3 pl-4 font-medium text-white max-w-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(g.uid);
                      }}
                      className={`text-left truncate max-w-full block hover:underline rounded cursor-pointer ${FOCUS_RING}`}
                      title={g.recipient}
                    >
                      <Highlight text={g.recipient} query={recipientQuery} />
                    </button>
                  </td>
                  <td className="py-2.5 px-3 max-w-sm truncate text-white/80" title={g.activity_name}>
                    <Highlight text={g.activity_name} query={activityQuery} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-white whitespace-nowrap">{formatGBP(g.award_amount)}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-white/60 whitespace-nowrap">{g.award_date || "—"}</td>
                  <td className="py-2.5 px-3 text-white/75">{g.main_discipline || "—"}</td>
                  <td className="py-2.5 px-3 text-white/75">{g.ace_area || "—"}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-white/60 whitespace-nowrap">{formatFY(g.funding_year)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={PAGE_BUTTON}>
            Previous
          </button>
          <span className="text-[11px] text-white/60 font-mono">
            Page <strong className="text-white font-medium">{page}</strong> of {totalPages}
          </span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={PAGE_BUTTON}>
            Next
          </button>
        </nav>
      )}
    </div>
  );
};
