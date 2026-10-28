import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { Download } from "lucide-react";
import { downloadBlob, exportFileName, standaloneSvg, svgToPng } from "../lib/export";
import { FOCUS_RING } from "./focus";

/** What every export says about the current view, provided once by the explorer. */
export const ExportContext = createContext<{ subtitle: string; credit: string }>({
  subtitle: "",
  credit: "Data: Arts Council England"
});

const ITEM = `w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${FOCUS_RING}`;

/**
 * Download menu for a chart: PNG and SVG of the chart as shown (with title,
 * view description and credit), and the chart's data as CSV.
 */
export const ExportMenu = ({
  title,
  name,
  chartRoot,
  csv,
  images = true,
  imageAvailable
}: {
  title: string;
  /** Short file-name part, e.g. "regional-distribution". */
  name: string;
  chartRoot: RefObject<HTMLElement>;
  csv?: () => string;
  /** False for visuals with no SVG (data download only). */
  images?: boolean;
  /** False while the table view is showing. */
  imageAvailable: boolean;
}) => {
  const { subtitle, credit } = useContext(ExportContext);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuId = useId();
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

  const chartSvg = () => chartRoot.current?.querySelector<SVGSVGElement>("svg[data-export-svg], svg.recharts-surface") ?? null;

  const exportImage = async (kind: "png" | "svg") => {
    setError(null);
    const svg = chartSvg();
    if (!svg) return setError("Switch to the chart view to download an image.");
    const { markup, width, height } = standaloneSvg(svg, { title, subtitle, credit });
    try {
      if (kind === "svg") downloadBlob(new Blob([markup], { type: "image/svg+xml" }), exportFileName(name, "svg"));
      else downloadBlob(await svgToPng(markup, width, height), exportFileName(name, "png"));
      setOpen(false);
      button.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div
      ref={root}
      className="relative"
      data-popover-open={open || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Download ${title.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-white/80 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Download
      </button>
      {open && (
        <div id={menuId} className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-white/10 bg-[#0d0d10] shadow-2xl p-1.5">
          <ul className="space-y-0.5">
            {images && (
              <>
                <li>
                  <button type="button" className={ITEM} disabled={!imageAvailable} onClick={() => exportImage("png")}>
                    PNG image
                  </button>
                </li>
                <li>
                  <button type="button" className={ITEM} disabled={!imageAvailable} onClick={() => exportImage("svg")}>
                    SVG image
                  </button>
                </li>
              </>
            )}
            {csv && (
              <li>
                <button
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    downloadBlob(new Blob([csv()], { type: "text/csv;charset=utf-8" }), exportFileName(name, "csv"));
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  Data (CSV)
                </button>
              </li>
            )}
          </ul>
          {images && !imageAvailable && <p className="px-3 pt-1 text-[11px] text-white/65">Images are available in the chart view.</p>}
          {error && (
            <p role="alert" className="px-3 pt-1 text-[11px] text-red-300">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
