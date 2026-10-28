import { formatAmount, formatGBP } from "../../lib/format";
import type { Heatmap } from "../../lib/aggregate";
import type { HeatmapMode } from "../../lib/filters";
import { toCsv } from "../../lib/csv";
import { ChartCard, FOCUS_RING, SegmentedToggle } from "../ui";

const MODES = [
  { value: "amount", label: "Amount" },
  { value: "row", label: "% of discipline" },
  { value: "column", label: "% of area" }
] as const;

const DESCRIPTION: Record<HeatmapMode, string> = {
  amount: "Funding for each discipline in each area, with your other filters applied. Percentages are each cell’s share of all funding shown here. Select a cell to filter by both.",
  row: "How each discipline’s funding is split across areas: each row adds up to 100%. Select a cell to filter by both.",
  column: "How each area’s funding is split across disciplines, as a share of the area’s total. Select a cell to filter by both."
};

// Cell colour: teal at the given opacity over the card background. Text is
// white or black, whichever contrasts more with the blended colour; the worst
// case (where the two are equal) is about 4.58:1, so it always passes 4.5:1.
const TEAL = [45, 212, 191];
const CARD_BG = [6, 6, 7];
const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const cellColours = (alpha: number) => {
  const rgb = TEAL.map((t, i) => Math.round(t * alpha + CARD_BG[i] * (1 - alpha)));
  const luminance = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  return { background: `rgb(${rgb.join(", ")})`, text: onWhite >= onBlack ? "#ffffff" : "#000000" };
};

const pct = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

export const DisciplineAreaHeatmap = ({
  heatmap,
  mode,
  onModeChange,
  selectedAreas,
  selectedDisciplines,
  onSelectCell
}: {
  heatmap: Heatmap;
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
  selectedAreas: readonly string[];
  selectedDisciplines: readonly string[];
  onSelectCell: (area: string, discipline: string) => void;
}) => {
  const grandTotal = Object.values(heatmap.areaTotals).reduce((s, v) => s + v, 0);
  const share = (area: string, discipline: string): number => {
    const amount = heatmap.matrix[area]?.[discipline] ?? 0;
    const base =
      mode === "row" ? heatmap.disciplineTotals[discipline] ?? 0 : mode === "column" ? heatmap.areaTotals[area] ?? 0 : grandTotal;
    return base > 0 ? amount / base : 0;
  };
  // Shading is relative to the strongest cell in the current mode.
  let strongest = 0;
  for (const area of heatmap.areas) {
    for (const d of heatmap.disciplines) {
      const v = mode === "amount" ? heatmap.matrix[area][d] : share(area, d);
      if (v > strongest) strongest = v;
    }
  }

  return (
    <ChartCard
      className="lg:col-span-2 overflow-hidden"
      title="Discipline vs. Region Heatmap"
    exportName="discipline-area-heatmap"
    imageExport={false}
    csv={() =>
      toCsv(heatmap.disciplines, [
        { label: "Discipline", value: (d: string) => d },
        ...heatmap.areas.map((a) => ({ label: `${a} (£)`, value: (d: string) => heatmap.matrix[a]?.[d] ?? 0 }))
      ])
    }
      description={DESCRIPTION[mode]}
      actions={<SegmentedToggle label="Shade by" options={MODES} value={mode} onChange={onModeChange} />}
    >
      <div className="overflow-x-auto mt-6">
        <table className="min-w-[600px] w-full border-separate border-spacing-2">
          <caption className="sr-only">Funding by discipline and area. Each cell is a button that filters by both.</caption>
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left text-[11px] font-mono text-white/65 font-bold uppercase align-bottom">
                Discipline
              </th>
              {heatmap.areas.map((area) => (
                <th
                  key={area}
                  scope="col"
                  className={`p-1 text-center text-[11px] font-mono font-bold uppercase truncate ${selectedAreas.includes(area) ? "text-teal-300" : "text-white/75"}`}
                  title={area}
                >
                  {area}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.disciplines.map((discipline) => (
              <tr key={discipline}>
                <th
                  scope="row"
                  className={`p-1 text-left text-xs font-mono font-medium truncate max-w-[9rem] ${selectedDisciplines.includes(discipline) ? "text-teal-300" : "text-white/85"}`}
                  title={discipline}
                >
                  {discipline}
                </th>
                {heatmap.areas.map((area) => {
                  const amount = heatmap.matrix[area]?.[discipline] ?? 0;
                  const s = share(area, discipline);
                  const value = mode === "amount" ? amount : s;
                  const intensity = strongest > 0 ? value / strongest : 0;
                  const isSelected =
                    selectedAreas.length === 1 && selectedAreas[0] === area && selectedDisciplines.length === 1 && selectedDisciplines[0] === discipline;
                  const colours = cellColours(Math.max(0.04, intensity * 0.7));
                  const shareText =
                    mode === "amount"
                      ? `${pct(s)} of all funding shown`
                      : mode === "row"
                        ? `${pct(s)} of ${discipline} funding`
                        : `${pct(s)} of funding in ${area}`;
                  return (
                    <td key={area} className="p-0">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${discipline} in ${area}: ${formatGBP(amount)}, ${shareText}`}
                        title={`${discipline} in ${area}: ${formatGBP(amount)} (${shareText})`}
                        onClick={() => onSelectCell(area, discipline)}
                        className={`w-full p-3 h-16 rounded-xl flex flex-col justify-between cursor-pointer border transition-transform motion-reduce:transition-none hover:scale-[1.03] ${FOCUS_RING} ${
                          isSelected ? "border-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]" : "border-white/10 hover:border-white/30"
                        }`}
                        style={amount > 0 ? { backgroundColor: colours.background, color: colours.text } : { backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                      >
                        <span className="text-[11px] font-mono self-end">{amount > 0 ? pct(s) : ""}</span>
                        <span className={`text-xs font-mono self-start ${amount > 0 ? "font-semibold" : "text-white/60"}`}>
                          {amount > 0 ? formatAmount(amount) : "—"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
};
