import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { BarChart3, Columns3, Info, LayoutGrid, Map as MapIcon, TableProperties } from "lucide-react";
import type { ViewTab } from "../lib/filters";
import { FOCUS_RING } from "./ui";

export const TABS: ReadonlyArray<{ id: ViewTab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "table", label: "Grants List", icon: TableProperties },
  { id: "charts", label: "Funding Analytics", icon: BarChart3 },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "compare", label: "Compare", icon: Columns3 },
  { id: "about", label: "About the data", icon: Info }
];

export const tabId = (tab: ViewTab) => `ace-tab-${tab}`;
export const panelId = (tab: ViewTab) => `ace-panel-${tab}`;

/** ARIA tabs: arrow keys, Home and End move between tabs. */
export const ViewTabs = ({ tab, onChange }: { tab: ViewTab | null; onChange: (tab: ViewTab) => void }) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Views"
      className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md overflow-x-auto scrollbar-none"
    >
      {TABS.map(({ id, label, icon: Icon }, index) => {
        const active = tab === id;
        return (
          <button
            key={id}
            ref={(el) => (refs.current[index] = el)}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(id)}
            tabIndex={active || (tab === null && index === 0) ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all shrink-0 flex items-center gap-2 cursor-pointer ${FOCUS_RING} ${
              active
                ? "bg-white text-black font-semibold shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${active ? "text-black" : "text-white/60"}`} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
