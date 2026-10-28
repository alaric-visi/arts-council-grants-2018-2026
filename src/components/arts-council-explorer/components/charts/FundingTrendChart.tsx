import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatFY } from "../../lib/fiscal";
import { formatAmount, formatGBP, formatISODate } from "../../lib/format";
import type { YearTrendPoint } from "../../lib/aggregate";
import type { TrendView } from "../../lib/filters";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, FilterButton, SegmentedToggle } from "../ui";
import { AXIS, TOOLTIP_STYLE } from "./chartStyles";

const VIEWS = [
  { value: "absolute", label: "Funding" },
  { value: "yoy", label: "Year-on-year" }
] as const;

const changeText = (yoy: number | null) => (yoy === null ? "n/a" : `${yoy > 0 ? "+" : ""}${yoy}%`);

export const FundingTrendChart = ({
  data,
  view,
  onViewChange,
  selectedYears,
  onSelectYear,
  animate
}: {
  data: YearTrendPoint[];
  view: TrendView;
  onViewChange: (view: TrendView) => void;
  selectedYears: readonly string[];
  onSelectYear: (year: string) => void;
  animate: boolean;
}) => {
  const inProgress = data.find((point) => point.partial) ?? null;

  // Marker: teal for the selected year; hollow and dashed for a year still in progress.
  const TrendDot = (props: { cx?: number; cy?: number; index?: number; payload?: YearTrendPoint }) => {
    const { cx, cy, index, payload } = props;
    if (typeof cx !== "number" || typeof cy !== "number") return <g key={`trend-dot-${index}`} />;
    const partial = Boolean(payload?.partial);
    const selected = payload !== undefined && selectedYears.includes(payload.name);
    return (
      <circle
        key={`trend-dot-${index}`}
        cx={cx}
        cy={cy}
        r={selected ? 6 : 4}
        fill={selected ? "#2dd4bf" : partial ? "transparent" : "#000"}
        stroke={selected ? "#2dd4bf" : "#fff"}
        strokeWidth={2}
        strokeDasharray={partial && !selected ? "2 2" : undefined}
        cursor="pointer"
      />
    );
  };

  return (
    <ChartCard
      title="Funding Trends over Time"
      exportName="funding-by-year"
      csv={() => toCsv(data, [{ label: "Funding year", value: (p) => p.name }, { label: "Funding (£)", value: (p) => p.amount }, { label: "Grants", value: (p) => p.count }, { label: "Change on previous year (%)", value: (p) => p.yoy }, { label: "In progress", value: (p) => (p.partial ? "yes" : "no") }])}
      description="Funding per financial year, with your other filters applied. Select years to filter everything else."
      actions={<SegmentedToggle label="Measure" options={VIEWS} value={view} onChange={onViewChange} />}
      table={
        <ChartTable
          caption="Funding per financial year"
          columns={[
            { label: "Year" },
            { label: "Funding", align: "right" },
            { label: "Grants", align: "right" },
            { label: "Change", align: "right" },
            { label: "" }
          ]}
          rows={data.map((p) => ({
            key: p.name,
            selected: selectedYears.includes(p.name),
            cells: [
              p.label,
              formatGBP(p.amount),
              p.count.toLocaleString("en-GB"),
              changeText(p.yoy),
              <FilterButton selected={selectedYears.includes(p.name)} label={formatFY(p.name)} onClick={() => onSelectYear(p.name)} />
            ]
          }))}
        />
      }
    >
      <div className="h-80 w-full mt-6" data-testid="trend-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
            onClick={(state: { activePayload?: Array<{ payload?: YearTrendPoint }> } | null) => {
              const year = state?.activePayload?.[0]?.payload?.name;
              if (year) onSelectYear(year);
            }}
          >
            <XAxis dataKey="label" {...AXIS} />
            <YAxis tickFormatter={(v) => (view === "yoy" ? `${v}%` : formatAmount(Number(v)))} {...AXIS} width={64} />
            <Tooltip
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload as YearTrendPoint | undefined;
                return point?.partial && point.cutoff ? `${label}, data to ${formatISODate(point.cutoff)}` : String(label);
              }}
              formatter={(value, _name, item) => {
                const point = item?.payload as YearTrendPoint | undefined;
                if (view === "yoy") {
                  return [
                    value === null || value === undefined ? "n/a" : changeText(Number(value)),
                    point?.partial ? "Change vs same period last year" : "Change vs previous year"
                  ];
                }
                return [formatGBP(Number(value)), point?.partial ? "Funding to date" : "Total funding"];
              }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line
              type="monotone"
              dataKey={view === "yoy" ? "yoy" : "amount"}
              stroke="#ffffff"
              strokeWidth={2}
              dot={TrendDot}
              activeDot={{ r: 6 }}
              isAnimationActive={animate}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {view === "yoy" && data.every((point) => point.yoy === null) && (
        <p className="text-xs text-white/70 mt-4">Year-on-year change needs at least two consecutive funding years in view.</p>
      )}
      {inProgress && (
        <p className="text-xs text-white/70 mt-4">
          {formatFY(inProgress.name)} is still in progress
          {inProgress.cutoff ? ` (data to ${formatISODate(inProgress.cutoff)})` : ""}, shown with a hollow marker. Its
          year-on-year figure compares the same period in each year.
        </p>
      )}
    </ChartCard>
  );
};
