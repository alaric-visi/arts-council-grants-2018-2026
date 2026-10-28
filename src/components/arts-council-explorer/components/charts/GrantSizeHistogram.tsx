import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatGBP } from "../../lib/format";
import type { HistogramBin } from "../../lib/aggregate";
import type { HistogramMetric } from "../../lib/filters";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, FilterButton, SegmentedToggle } from "../ui";
import { AXIS, TOOLTIP_STYLE, barFill } from "./chartStyles";

const METRICS = [
  { value: "count", label: "Grants" },
  { value: "amount", label: "Total awarded" }
] as const;

export const GrantSizeHistogram = ({
  data,
  metric,
  onMetricChange,
  selected,
  onSelect,
  animate
}: {
  data: HistogramBin[];
  metric: HistogramMetric;
  onMetricChange: (metric: HistogramMetric) => void;
  selected: { over: number | null; upTo: number | null };
  onSelect: (over: number | null, upTo: number | null) => void;
  animate: boolean;
}) => {
  const isSelected = (b: HistogramBin) => b.over === selected.over && b.upTo === selected.upTo;
  const anySelected = data.some(isSelected);
  return (
    <ChartCard
      title="Grant Size Distribution"
      exportName="grant-sizes"
      csv={() => toCsv(data, [{ label: "Size", value: (b) => b.name }, { label: "Grants", value: (b) => b.count }, { label: "Total (£)", value: (b) => b.amount }])}
      description="Grants by size, in brackets matching ACE's £15,000 and £30,000 strand thresholds. Select a bracket to filter by amount."
      actions={<SegmentedToggle label="Measure" options={METRICS} value={metric} onChange={onMetricChange} />}
      table={
        <ChartTable
          caption="Grants by size bracket"
          columns={[{ label: "Size" }, { label: "Grants", align: "right" }, { label: "Total", align: "right" }, { label: "" }]}
          rows={data.map((b) => ({
            key: b.name,
            selected: isSelected(b),
            cells: [b.name, b.count.toLocaleString("en-GB"), formatGBP(b.amount), <FilterButton selected={isSelected(b)} label={b.name} onClick={() => onSelect(b.over, b.upTo)} />]
          }))}
        />
      }
    >
      <div className="h-80 w-full mt-6" data-testid="size-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} width={64} tickFormatter={(v) => (metric === "count" ? Number(v).toLocaleString("en-GB") : formatAmount(Number(v)))} />
            <Tooltip
              formatter={(value) => [
                metric === "amount" ? formatGBP(Number(value)) : `${Number(value).toLocaleString("en-GB")} grants`,
                metric === "amount" ? "Total awarded" : "Grants"
              ]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar
              dataKey={metric}
              radius={[4, 4, 0, 0]}
              isAnimationActive={animate}
              onClick={(entry: HistogramBin) => entry && onSelect(entry.over, entry.upTo)}
            >
              {data.map((bin) => (
                <Cell key={bin.name} fill={barFill(isSelected(bin), anySelected)} cursor="pointer" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
