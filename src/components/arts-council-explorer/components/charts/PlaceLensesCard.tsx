import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Aggregates } from "../../lib/aggregate";
import { formatAmount, formatGBP } from "../../lib/format";
import { formatPerPerson, formatPerPersonTick, perPerson, QUINTILE_LABELS } from "../../lib/places";
import type { PlaceIndex } from "../../lib/places";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, FilterButton } from "../ui";
import { AXIS, TOOLTIP_STYLE, barFill } from "./chartStyles";

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

/**
 * Funding by deprivation fifth (per resident when populations are known) and
 * by designated-place list, each with its share of funding against its share
 * of population.
 */
export const PlaceLensesCard = ({
  aggregates,
  places,
  selectedFifths,
  selectedGroups,
  onToggleFifth,
  onToggleGroup,
  animate
}: {
  aggregates: Aggregates;
  places: PlaceIndex;
  selectedFifths: readonly string[];
  selectedGroups: readonly string[];
  onToggleFifth: (q: string) => void;
  onToggleGroup: (id: string) => void;
  animate: boolean;
}) => {
  const hasDeprivation = aggregates.byDeprivation.length > 0;
  const hasGroups = aggregates.byPlaceGroup.length > 0;
  if (!hasDeprivation && !hasGroups) return null;

  const usePerPerson = places.hasPopulations;
  // Fifths partition the ranked districts, so their sums are the denominators for fifth shares.
  const fifthPopulation = usePerPerson ? [1, 2, 3, 4, 5].reduce((s, q) => s + (places.quintilePopulation(q) ?? 0), 0) : 0;
  const totalFunding = aggregates.byDeprivation.reduce((s, d) => s + d.amount, 0);
  const fifths = aggregates.byDeprivation.map((d) => ({
    key: String(d.quintile),
    name: QUINTILE_LABELS[String(d.quintile)].replace(" fifth", ""),
    amount: d.amount,
    count: d.count,
    population: places.quintilePopulation(d.quintile),
    value: usePerPerson ? perPerson(d.amount, places.quintilePopulation(d.quintile)) ?? 0 : d.amount
  }));
  // Designations overlap, so their shares are of funding ignoring the designation filter, and of England's population.
  const allFunding = aggregates.placeGroupTotal;
  const totalPopulation = places.totalPopulation ?? 0;
  const groups = aggregates.byPlaceGroup
    .map((g) => ({ ...g, population: places.groupPopulation(g.id), label: places.groupLabel(g.id) }))
    .sort((a, b) => (a.id === "outside" ? 1 : b.id === "outside" ? -1 : a.label.localeCompare(b.label)));

  return (
    <ChartCard
      className="lg:col-span-3"
      title="Place Lenses"
      exportName="place-lenses"
      imageExport={hasDeprivation}
      csv={() =>
        [
          hasDeprivation
            ? toCsv(fifths, [
                { label: "Deprivation fifth", value: (f) => QUINTILE_LABELS[f.key] },
                { label: "Funding (£)", value: (f) => f.amount },
                { label: "Grants", value: (f) => f.count },
                { label: "Population", value: (f) => f.population },
                { label: "Per resident (£)", value: (f) => perPerson(f.amount, f.population) }
              ])
            : "",
          hasGroups
            ? toCsv(groups, [
                { label: "Places", value: (g) => g.label },
                { label: "Funding (£)", value: (g) => g.amount },
                { label: "Grants", value: (g) => g.count },
                { label: "Population", value: (g) => g.population },
                { label: "Per resident (£)", value: (g) => perPerson(g.amount, g.population) }
              ], { bom: !hasDeprivation })
            : ""
        ]
          .filter(Boolean)
          .join("\r\n\r\n")
      }
      description={
        <>
          {hasDeprivation &&
            `Districts are grouped into fifths by the English Indices of Deprivation${places.deprivation?.edition ? ` ${places.deprivation.edition}` : ""} (rank of average score).`}{" "}
          {usePerPerson ? "Bars show funding per resident. " : ""}Your other filters apply; the deprivation and designated-place filters don’t
          apply to their own figures. Select a row to filter.
        </>
      }
      table={
        <div className="space-y-6">
          {hasDeprivation && (
            <ChartTable
              caption="Funding by deprivation fifth of district"
              columns={[
                { label: "Deprivation fifth" },
                { label: "Funding", align: "right" },
                { label: "Grants", align: "right" },
                ...(usePerPerson ? [{ label: "Per resident", align: "right" as const }, { label: "Share of funding / population", align: "right" as const }] : []),
                { label: "" }
              ]}
              rows={fifths.map((f) => ({
                key: f.key,
                selected: selectedFifths.includes(f.key),
                cells: [
                  QUINTILE_LABELS[f.key],
                  formatGBP(f.amount),
                  f.count.toLocaleString("en-GB"),
                  ...(usePerPerson
                    ? [formatPerPerson(perPerson(f.amount, f.population)), `${pct(f.amount, totalFunding)} / ${pct(f.population ?? 0, fifthPopulation)}`]
                    : []),
                  <FilterButton selected={selectedFifths.includes(f.key)} label={QUINTILE_LABELS[f.key]} onClick={() => onToggleFifth(f.key)} />
                ]
              }))}
            />
          )}
          {hasGroups && (
            <ChartTable
              caption="Funding by designated-place list"
              columns={[
                { label: "Places" },
                { label: "Funding", align: "right" },
                { label: "Share of funding", align: "right" },
                ...(usePerPerson ? [{ label: "Share of population", align: "right" as const }, { label: "Per resident", align: "right" as const }] : []),
                { label: "" }
              ]}
              rows={groups.map((g) => ({
                key: g.id,
                selected: selectedGroups.includes(g.id),
                cells: [
                  g.label,
                  formatGBP(g.amount),
                  pct(g.amount, allFunding),
                  ...(usePerPerson ? [pct(g.population ?? 0, totalPopulation), formatPerPerson(perPerson(g.amount, g.population))] : []),
                  <FilterButton selected={selectedGroups.includes(g.id)} label={g.label} onClick={() => onToggleGroup(g.id)} />
                ]
              }))}
            />
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {hasDeprivation && (
          <div>
            <h4 className="text-[11px] uppercase font-mono font-bold tracking-wider text-white/70 mb-2">
              {usePerPerson ? "Funding per resident" : "Funding"}, most to least deprived
            </h4>
            <div className="h-64" aria-hidden="true" data-testid="deprivation-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fifths} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <XAxis dataKey="name" {...AXIS} interval={0} tickFormatter={(v: string) => v.replace("Second most deprived", "2nd most").replace("Second least deprived", "2nd least")} />
                  <YAxis {...AXIS} width={64} tickFormatter={(v) => (usePerPerson ? formatPerPersonTick(Number(v)) : formatAmount(Number(v)))} />
                  <Tooltip
                    formatter={(value) => [usePerPerson ? `${formatPerPerson(Number(value))} per resident` : formatGBP(Number(value)), "Funding"]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={animate} onClick={(entry: { key?: string }) => entry?.key && onToggleFifth(entry.key)}>
                    {fifths.map((f) => (
                      <Cell key={f.key} fill={barFill(selectedFifths.includes(f.key), selectedFifths.length > 0)} cursor="pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {hasGroups && (
          <div>
            <h4 className="text-[11px] uppercase font-mono font-bold tracking-wider text-white/70 mb-3">
              Designated places: share of funding{usePerPerson ? " against share of population" : ""}
            </h4>
            <ul className="space-y-4" data-testid="designation-shares">
              {groups.map((g) => {
                const fundingShare = allFunding > 0 ? g.amount / allFunding : 0;
                const populationShare = usePerPerson && totalPopulation > 0 ? (g.population ?? 0) / totalPopulation : null;
                return (
                  <li key={g.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => onToggleGroup(g.id)}
                        aria-pressed={selectedGroups.includes(g.id)}
                        className="text-left text-white underline decoration-white/30 underline-offset-2 hover:decoration-white rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                      >
                        {g.label}
                      </button>
                      <span className="font-mono text-white shrink-0">{formatAmount(g.amount)}</span>
                    </div>
                    <div className="mt-1.5 space-y-1" aria-hidden="true">
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-teal-400" style={{ width: `${fundingShare * 100}%` }} />
                      </div>
                      {populationShare !== null && (
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-white/50" style={{ width: `${populationShare * 100}%` }} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-white/70 mt-1">
                      {pct(g.amount, allFunding)} of funding{populationShare !== null ? `, ${Math.round(populationShare * 100)}% of residents` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-white/65 mt-3">A place can be on more than one list, so shares can add up to more than 100%.</p>
          </div>
        )}
      </div>
    </ChartCard>
  );
};
