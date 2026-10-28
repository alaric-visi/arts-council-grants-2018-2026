import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { FOCUS_RING } from "./ui";

export interface Option {
  value: string;
  label: string;
}

const FIELD = `w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white text-left font-sans flex items-center justify-between gap-2 hover:bg-white/10 transition-colors ${FOCUS_RING}`;
const LABEL = "block text-[11px] uppercase font-mono tracking-wider text-white/50 mb-1.5";

/**
 * Multi-select as a disclosure: a button that opens a list of checkboxes.
 * Long lists get a type-to-filter box. Escape or a click outside closes it.
 */
export const MultiSelect = ({
  label,
  allLabel,
  options,
  selected,
  onChange,
  searchable = options.length > 12
}: {
  label: string;
  allLabel: string;
  options: readonly Option[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}) => {
  const labelId = useId();
  const buttonId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
  };

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    // data-popover-open lets the surrounding panel lift itself above the sticky filter bar while open.
    <div ref={root} className="relative" onKeyDown={onKeyDown} data-popover-open={open || undefined}>
      <span id={labelId} className={LABEL}>
        {label}
      </span>
      <button
        ref={button}
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${buttonId}`}
        onClick={() => setOpen((o) => !o)}
        className={`${FIELD} ${selected.length > 0 ? "border-emerald-700/80 bg-emerald-950/20 text-emerald-300" : ""}`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute z-40 mt-1 w-full min-w-[16rem] max-w-[90vw] rounded-xl border border-white/10 bg-[#0d0d10] shadow-2xl p-2"
        >
          {searchable && (
            <input
              type="search"
              aria-label={`Filter ${label.toLowerCase()} options`}
              placeholder="Type to filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className={`w-full mb-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none ${FOCUS_RING}`}
            />
          )}
          <fieldset className="max-h-64 overflow-y-auto">
            <legend className="sr-only">{label}</legend>
            {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-white/50">No matches</p>}
            {shown.map((o) => {
              // The wrapping label names the checkbox (values can contain spaces, so no ids).
              return (
                <label key={o.value} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 text-xs text-white/85 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="accent-emerald-400 w-3.5 h-3.5"
                  />
                  {o.label}
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className={`px-2 py-0.5 text-[11px] font-mono text-white/60 hover:text-white disabled:opacity-40 rounded cursor-pointer ${FOCUS_RING}`}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              className={`px-2.5 py-0.5 text-[11px] font-mono bg-white text-black rounded-md font-semibold shadow-sm cursor-pointer ${FOCUS_RING}`}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
