import { useId, useMemo } from "react";
import { Bar, BarChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compareSegments, topValues } from "../lib/aggregate";
import type { CompareSegment } from "../lib/aggregate";
import { MAX_COMPARE } from "../lib/filters";
import type { CompareDimension, ExplorerState, FilterOptions, FilterState } from "../lib/filters";
import { formatFY } from "../lib/fiscal";
import { formatAmount, formatGBP } from "../lib/format";
import { formatPerPerson, perPerson, QUINTILE_LABELS } from "../lib/places";
import type { PlaceIndex } from "../lib/places";
import type { Grant } from "../lib/types";
import type { ExplorerDispatch } from "../state/useExplorerState";
import { AXIS, TOOLTIP_STYLE } from "./charts/chartStyles";
import { MultiSelect } from "./MultiSelect";
import { toCsv } from "../lib/csv";
import { ChartCard, ChartTable, FOCUS_RING } from "./ui";

const DIMENSIONS: ReadonlyArray<{ value: CompareDimension; label: string; noun: string }> = [
  { value: "areas", label: "ACE areas", noun: "area" },
  { value: "disciplines", label: "Disciplines", noun: "discipline" },
  { value: "years", label: "Funding years", noun: "year" },
  { value: "localAuthorities", label: "Local authorities", noun: "local authority" },
  { value: "recipientTypes", label: "Recipient types (inferred)", noun: "recipient type" },
  { value: "deprivation", label: "Deprivation fifths", noun: "deprivation fifth" }
];

/** Colour plus a line pattern, so segments differ by more than colour. */
export const SEGMENT_STYLES = [
  { colour: "#2dd4bf", dash: undefined },
  { colour: "#fbbf24", dash: "6 4" },
  { colour: "#c4b5fd", dash: "2 4" },
  { colour: "#fb7185", dash: "10 4 2 4" }
] as const;

const TYPE_LABEL: Record<string, string> = { organisation: "Organisations", individual: "Individuals", unknown: "Unclear from name" };

const valueLabel = (by: CompareDimension, value: string) =>
  by === "years"
    ? formatFY(value)
    : by === "recipientTypes"
      ? TYPE_LABEL[value] ?? value
      : by === "deprivation"
        ? QUINTILE_LABELS[value] ?? value
        : value;

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export const CompareView = ({
  grants,
  filters,
  state,
  options,
  dispatch,
  firstYears,
  places,
  animate
}: {
  grants: readonly Grant[];
  filters: FilterState;
  state: ExplorerState;
  options: FilterOptions;
  dispatch: ExplorerDispatch;
  firstYears: ReadonlyMap<string, string>;
  places: PlaceIndex;
  animate: boolean;
}) => {
  const byId = useId();
  const by = state.compareBy;
  const dimensions = DIMENSIONS.filter((d) => d.value !== "deprivation" || options.deprivation.length > 0);
  const dimension = dimensions.find((d) => d.value === by) ?? DIMENSIONS[0];
  const chosen = state.compareValues;
  const values = useMemo(
    () => (chosen.length > 0 ? chosen : by === "deprivation" ? ["1", "3", "5"] : topValues(grants, filters, by, 3, places)),
    [chosen, grants, filters, by, places]
  );
  const segments = useMemo(
    () => compareSegments(grants, filters, by, values, firstYears, places),
    [grants, filters, by, values, firstYears, places]
  );

  const allValues =
    by === "recipientTypes" ? ["organisation", "individual", "unknown"] : by === "deprivation" ? options.deprivation : options[by];
  const perPersonFor = (s: CompareSegment): number | null =>
    by === "localAuthorities"
      ? perPerson(s.summary.stats.totalAwarded, places.population(s.value))
      : by === "areas"
        ? perPerson(s.summary.stats.totalAwarded, places.areaPopulation(s.value))
        : by === "deprivation"
          ? perPerson(s.summary.stats.totalAwarded, places.quintilePopulation(Number(s.value)))
          : null;
  const showPerPerson = places.hasPopulations && (by === "localAuthorities" || by === "areas" || by === "deprivation");

  const header = (s: CompareSegment, i: number) => {
    const label = valueLabel(by, s.value);
    const swatch = (
      <span aria-hidden="true" className="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style={{ background: SEGMENT_STYLES[i].colour }} />
    );
    const profile = by === "localAuthorities" ? "place" : by === "disciplines" ? "discipline" : null;
    return profile ? (
      <button
        type="button"
        onClick={() => dispatch({ type: "openProfile", kind: profile, id: s.value })}
        className={`underline decoration-white/30 underline-offset-2 hover:decoration-white rounded cursor-pointer ${FOCUS_RING}`}
      >
        {swatch}
        {label}
      </button>
    ) : (
      <span>
        {swatch}
        {label}
      </span>
    );
  };

  const rows: Array<{ key: string; label: string; cell: (s: CompareSegment) => string }> = [
    { key: "total", label: "Total awarded", cell: (s) => formatGBP(s.summary.stats.totalAwarded) },
    { key: "count", label: "Grants", cell: (s) => s.summary.stats.count.toLocaleString("en-GB") },
    { key: "median", label: "Median award", cell: (s) => formatGBP(s.summary.stats.medianAward) },
    { key: "mean", label: "Mean award", cell: (s) => formatGBP(s.summary.stats.avgAward) },
    { key: "max", label: "Largest award", cell: (s) => formatGBP(s.summary.stats.maxAward) },
    { key: "recipients", label: "Recipients", cell: (s) => s.summary.stats.recipientCount.toLocaleString("en-GB") },
    // "New" only means something per year: across all years almost every recipient's first grant is included.
    ...(by === "years"
      ? [
          {
            key: "new",
            label: "New recipients that year",
            cell: (s: CompareSegment) =>
              `${s.summary.newRecipients.toLocaleString("en-GB")} (${pct(s.summary.newRecipients, s.summary.stats.recipientCount)})`
          }
        ]
      : []),
    ...(showPerPerson
      ? [{ key: "perPerson", label: `Per resident${places.populationYear ? ` (${places.populationYear} population)` : ""}`, cell: (s: CompareSegment) => formatPerPerson(perPersonFor(s)) }]
      : []),
    {
      key: "top",
      label: by === "disciplines" ? "Largest area" : "Largest discipline",
      cell: (s) => {
        const top = (by === "disciplines" ? s.summary.byArea : s.summary.byDiscipline)[0];
        return top ? `${top.name} (${pct(top.amount, s.summary.stats.totalAwarded)})` : "—";
      }
    }
  ];

  // Trend: one series per segment. Keys s0…s3 avoid Recharts reading dots in names as paths.
  const years = Array.from(new Set(segments.flatMap((s) => s.summary.byYear.map((y) => y.name)))).sort();
  const trend = years.map((fy) => {
    const point: Record<string, string | number> = { name: fy, label: formatFY(fy) };
    segments.forEach((s, i) => (point[`s${i}`] = s.summary.byYear.find((y) => y.name === fy)?.amount ?? 0));
    return point;
  });

  // Mix: share of each segment's funding by discipline (or by area when comparing disciplines).
  const mixOf = (s: CompareSegment) => (by === "disciplines" ? s.summary.byArea : s.summary.byDiscipline);
  const mixTotals = new Map<string, number>();
  for (const s of segments) for (const m of mixOf(s)) mixTotals.set(m.name, (mixTotals.get(m.name) ?? 0) + m.amount);
  const categories = Array.from(mixTotals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  const mix = categories.map((name) => {
    const row: Record<string, string | number> = { name };
    segments.forEach((s, i) => {
      const amount = mixOf(s).find((m) => m.name === name)?.amount ?? 0;
      row[`s${i}`] = s.summary.stats.totalAwarded > 0 ? Math.round((amount / s.summary.stats.totalAwarded) * 1000) / 10 : 0;
    });
    return row;
  });
  const seriesName = (i: number) => valueLabel(by, segments[i].value);

  return (
    <div className="space-y-8">
      <section aria-label="Comparison settings" className="relative has-[[data-popover-open]]:z-40 p-5 sm:p-6 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor={byId} className="block text-[11px] uppercase font-mono tracking-wider text-white/50 mb-1.5">
            Compare
          </label>
          <select
            id={byId}
            value={by}
            onChange={(e) => dispatch({ type: "setCompare", by: e.target.value as CompareDimension, values: [] })}
            className={`w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white [color-scheme:dark] ${FOCUS_RING}`}
          >
            {dimensions.map((d) => (
              <option key={d.value} value={d.value} className="bg-black text-white">
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <MultiSelect
            label={`Which ${dimension.label.toLowerCase()} (up to ${MAX_COMPARE})`}
            allLabel={by === "deprivation" ? "Most, middle and least deprived" : "The largest three in view"}
            options={allValues.map((v) => ({ value: v, label: valueLabel(by, v) }))}
            selected={chosen}
            onChange={(next) => dispatch({ type: "setCompare", by, values: next.slice(0, MAX_COMPARE) })}
            searchable={allValues.length > 12}
          />
        </div>
        <p className="md:col-span-3 text-xs text-white/50 font-light">
          Your other filters apply to every column. Any {dimension.noun} filter is ignored here, so each column shows one {dimension.noun}.
          {chosen.length >= MAX_COMPARE && ` You can compare at most ${MAX_COMPARE} at once.`}
        </p>
      </section>

      {segments.length === 0 ? (
        <p className="text-white/70">Nothing to compare: no grants match your filters.</p>
      ) : (
        <>
          <section aria-label="Figures side by side" className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="compare-table">
              <caption className="sr-only">Figures for each compared {dimension.noun}</caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase font-mono text-white/60">
                  <th scope="col" className="py-2.5 px-3">
                    Figure
                  </th>
                  {segments.map((s, i) => (
                    <th key={s.value} scope="col" className="py-2.5 px-3 normal-case text-xs font-medium text-white">
                      {header(s, i)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="py-3 px-4 text-[11px] uppercase font-mono text-white/70 font-semibold">
                      {row.label}
                    </th>
                    {segments.map((s) => (
                      <td key={s.value} className="py-3 px-4 font-mono text-white">
                        {row.cell(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartCard
              title="Funding over time"
              exportName="comparison-over-time"
              csv={() =>
                toCsv(trend, [
                  { label: "Funding year", value: (p) => p.name },
                  ...segments.map((_, i) => ({ label: `${seriesName(i)} (£)`, value: (p: Record<string, string | number>) => p[`s${i}`] }))
                ])
              }
              description={`Funding per financial year for each ${dimension.noun}. Lines differ in pattern as well as colour.`}
              table={
                <ChartTable
                  caption="Funding per year for each compared value"
                  columns={[{ label: "Year" }, ...segments.map((_, i) => ({ label: seriesName(i), align: "right" as const }))]}
                  rows={trend.map((p) => ({ key: String(p.name), cells: [String(p.label), ...segments.map((_, i) => formatGBP(Number(p[`s${i}`])))] }))}
                />
              }
            >
              <div className="h-72 w-full mt-6" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <XAxis dataKey="label" {...AXIS} />
                    <YAxis tickFormatter={(v) => formatAmount(Number(v))} {...AXIS} width={64} />
                    <Tooltip formatter={(value, name) => [formatGBP(Number(value)), name]} contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#d4d4d8" }} />
                    {segments.map((_, i) => (
                      <Line
                        key={i}
                        type="monotone"
                        dataKey={`s${i}`}
                        name={seriesName(i)}
                        stroke={SEGMENT_STYLES[i].colour}
                        strokeDasharray={SEGMENT_STYLES[i].dash}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        isAnimationActive={animate}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title={by === "disciplines" ? "Where the money goes" : "What the money funds"}
              exportName="comparison-mix"
              csv={() =>
                toCsv(mix, [
                  { label: by === "disciplines" ? "ACE area" : "Discipline", value: (m) => m.name },
                  ...segments.map((_, i) => ({ label: `${seriesName(i)} (% of its funding)`, value: (m: Record<string, string | number>) => m[`s${i}`] }))
                ])
              }
              description={`Share of each ${dimension.noun}'s funding by ${by === "disciplines" ? "ACE area" : "discipline"}, for the six largest overall.`}
              table={
                <ChartTable
                  caption="Share of funding by category for each compared value"
                  columns={[{ label: by === "disciplines" ? "Area" : "Discipline" }, ...segments.map((_, i) => ({ label: seriesName(i), align: "right" as const }))]}
                  rows={mix.map((m) => ({ key: String(m.name), cells: [String(m.name), ...segments.map((_, i) => `${m[`s${i}`]}%`)] }))}
                />
              }
            >
              <div className="h-72 w-full mt-6" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mix} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} {...AXIS} />
                    <YAxis dataKey="name" type="category" width={110} {...AXIS} />
                    <Tooltip formatter={(value, name) => [`${value}%`, name]} contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#d4d4d8" }} />
                    {segments.map((_, i) => (
                      <Bar key={i} dataKey={`s${i}`} name={seriesName(i)} fill={SEGMENT_STYLES[i].colour} isAnimationActive={animate} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};
