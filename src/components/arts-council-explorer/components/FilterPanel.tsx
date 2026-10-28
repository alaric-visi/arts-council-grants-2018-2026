import { useEffect, useId, useState } from "react";
import { ChevronDown, Download, Filter, RotateCcw, Search } from "lucide-react";
import type { ExplorerDispatch } from "../state/useExplorerState";
import type { CategoryField, ExplorerState, FilterOptions } from "../lib/filters";
import { MultiSelect } from "./MultiSelect";
import { QUINTILE_LABELS } from "../lib/places";
import type { SearchScope } from "../lib/search";
import { formatFY } from "../lib/fiscal";
import { FOCUS_RING } from "./ui";

const FIELD =
  `w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none font-sans ${FOCUS_RING}`;
const LABEL = "block text-[11px] uppercase font-mono tracking-wider text-white/50 mb-1.5";

/** Text input that commits on blur or Enter, so typing doesn't refilter (or add history) per keystroke. */
const useCommittedInput = (value: string, commit: (text: string) => void) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  // After committing, show the committed value. If the text was rejected
  // (not a number, not a known authority) the field reverts instead of
  // showing something that isn't being applied.
  const commitAndSync = () => {
    if (text !== value) commit(text);
    setText(value);
  };
  return {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value),
    onBlur: commitAndSync,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") commitAndSync();
    }
  };
};

const parsePounds = (text: string): number | null => {
  const n = Number(text.replace(/[£,\s]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

const AmountField = ({ label, value, onCommit }: { label: string; value: number | null; onCommit: (n: number | null) => void }) => {
  const id = useId();
  const input = useCommittedInput(value === null ? "" : String(value), (text) => onCommit(parsePounds(text)));
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/60" aria-hidden="true">
          £
        </span>
        <input id={id} type="text" inputMode="numeric" placeholder="Any" {...input} className={`${FIELD} pl-7`} />
      </div>
    </div>
  );
};

const SCOPES: ReadonlyArray<{ value: SearchScope; label: string }> = [
  { value: "all", label: "Names and titles" },
  { value: "recipient", label: "Recipient names" },
  { value: "activity", label: "Project titles" }
];

const RECIPIENT_TYPES = [
  { value: "organisation", label: "Organisations" },
  { value: "individual", label: "Individuals" },
  { value: "unknown", label: "Unclear from name" }
];

const asOptions = (values: readonly string[], format: (v: string) => string = (v) => v) =>
  values.map((value) => ({ value, label: format(value) }));

export const FilterPanel = ({
  state,
  options,
  dispatch,
  onExport,
  exportDisabled,
  groupLabel = (id) => id,
  deprivationEdition = null,
  onClose
}: {
  state: ExplorerState;
  options: FilterOptions;
  dispatch: ExplorerDispatch;
  onExport: () => void;
  exportDisabled: boolean;
  groupLabel?: (id: string) => string;
  deprivationEdition?: string | null;
  onClose?: () => void;
}) => {
  const searchId = useId();
  const scopeId = useId();
  const moreId = useId();
  const secondaryActive =
    state.localAuthorities.length > 0 ||
    state.strands.length > 0 ||
    state.priorities.length > 0 ||
    state.recipientTypes.length > 0 ||
    state.placeGroups.length > 0 ||
    state.deprivation.length > 0 ||
    state.amountOver !== null ||
    state.amountUpTo !== null ||
    state.dateFrom !== null ||
    state.dateTo !== null;
  const [moreOpen, setMoreOpen] = useState(secondaryActive);
  useEffect(() => {
    if (secondaryActive) setMoreOpen(true);
  }, [secondaryActive]);

  const set = (field: CategoryField) => (values: string[]) => dispatch({ type: "setValues", field, values });

  return (
    // The blur gives this panel its own stacking context, so an open dropdown can only rise above
    // the sticky filter bar (z-30) if the whole panel does, which it does only while one is open.
    <section
      aria-label="Search and filters"
      className="relative has-[[data-popover-open]]:z-40 p-5 sm:p-6 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl"
    >
      <div className="flex items-center justify-between mb-5 text-white/60">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-white/50" aria-hidden="true" />
          <h2 className="text-[11px] uppercase font-mono tracking-wider text-white/70">Search & Filter</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-white/50 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
            aria-label="Close filters"
          >
            ✕ Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="md:col-span-3">
          <label htmlFor={searchId} className={LABEL}>
            Search
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                placeholder="Recipient or project…"
                value={state.q}
                onChange={(e) => dispatch({ type: "setSearch", q: e.target.value })}
                className={`${FIELD} pl-9`}
              />
            </div>
            <label htmlFor={scopeId} className="sr-only">
              Search in
            </label>
            <select
              id={scopeId}
              value={state.searchIn}
              onChange={(e) => dispatch({ type: "setSearch", q: state.q, searchIn: e.target.value as SearchScope })}
              className={`${FIELD} sm:w-auto sm:max-w-[12rem]`}
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value} className="bg-black text-white">
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <MultiSelect label="Funding Year" allLabel="All years" options={asOptions(options.years, formatFY)} selected={state.years} onChange={set("years")} />
        <MultiSelect label="ACE Area" allLabel="All areas" options={asOptions(options.areas)} selected={state.areas} onChange={set("areas")} />
        <MultiSelect
          label="Main Discipline"
          allLabel="All disciplines"
          options={asOptions(options.disciplines)}
          selected={state.disciplines}
          onChange={set("disciplines")}
        />
      </div>

      <button
        type="button"
        aria-expanded={moreOpen}
        aria-controls={moreId}
        onClick={() => setMoreOpen((open) => !open)}
        className={`mt-4 inline-flex items-center gap-1.5 text-[11px] font-mono text-white/60 hover:text-white rounded cursor-pointer transition-colors ${FOCUS_RING}`}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform motion-reduce:transition-none ${moreOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        {moreOpen ? "Fewer filters" : "More filters"}
      </button>

      {/* Toggle display with classes: Tailwind's "grid" would override the hidden attribute. */}
      <div id={moreId} className={`${moreOpen ? "grid" : "hidden"} mt-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`}>
        <MultiSelect
          label="Local authority (current boundaries)"
          allLabel="All local authorities"
          options={asOptions(options.localAuthorities)}
          selected={state.localAuthorities}
          onChange={set("localAuthorities")}
          searchable
        />
        <MultiSelect label="Strand" allLabel="All strands" options={asOptions(options.strands)} selected={state.strands} onChange={set("strands")} />
        <MultiSelect
          label="Time-limited priority"
          allLabel="Any (or none)"
          options={asOptions(options.priorities)}
          selected={state.priorities}
          onChange={set("priorities")}
        />
        <MultiSelect
          label="Recipient type (inferred)"
          allLabel="All recipients"
          options={RECIPIENT_TYPES}
          selected={state.recipientTypes}
          onChange={set("recipientTypes")}
        />
        {options.placeGroups.length > 0 && (
          <MultiSelect
            label="Designated places"
            allLabel="All places"
            options={options.placeGroups.map((id) => ({ value: id, label: groupLabel(id) }))}
            selected={state.placeGroups}
            onChange={set("placeGroups")}
          />
        )}
        {options.deprivation.length > 0 && (
          <MultiSelect
            label={`Deprivation${deprivationEdition ? ` (IoD ${deprivationEdition})` : ""}`}
            allLabel="All districts"
            options={options.deprivation.map((q) => ({ value: q, label: QUINTILE_LABELS[q] }))}
            selected={state.deprivation}
            onChange={set("deprivation")}
          />
        )}
        <AmountField label="Award more than" value={state.amountOver} onCommit={(over) => dispatch({ type: "setAmount", over, upTo: state.amountUpTo })} />
        <AmountField label="Award up to" value={state.amountUpTo} onCommit={(upTo) => dispatch({ type: "setAmount", over: state.amountOver, upTo })} />
        <DateField label="Awarded from" value={state.dateFrom} onChange={(from) => dispatch({ type: "setDates", from, to: state.dateTo })} />
        <DateField label="Awarded to" value={state.dateTo} onChange={(to) => dispatch({ type: "setDates", from: state.dateFrom, to })} />
      </div>

      <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-2.5 justify-end">
        <button
          type="button"
          onClick={() => dispatch({ type: "reset" })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono text-white/70 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-white/90 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-mono transition-colors font-semibold cursor-pointer shadow-sm ${FOCUS_RING}`}
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export CSV
        </button>
      </div>
    </section>
  );
};

const DateField = ({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${FIELD} [color-scheme:dark]`}
      />
    </div>
  );
};
