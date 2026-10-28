import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatGBP } from "../../lib/format";
import type { NamedAmount } from "../../lib/aggregate";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, FilterButton } from "../ui";
import { AXIS, TOOLTIP_STYLE, barFill } from "./chartStyles";

export const AreaBarChart = ({
  data,
  selected,
  onSelect,
  animate
}: {
  data: NamedAmount[];
  selected: readonly string[];
  onSelect: (area: string) => void;
  animate: boolean;
}) => (
  <ChartCard
    title="Regional Distribution (ACE Area)"
      exportName="regional-distribution"
      csv={() => toCsv(data, [{ label: "ACE area", value: (d) => d.name }, { label: "Funding (£)", value: (d) => d.amount }, { label: "Grants", value: (d) => d.count }])}
    description="Funding by ACE area, with your other filters applied. Select areas to filter everything else."
    table={
      <ChartTable
        caption="Funding by ACE area"
        columns={[{ label: "Area" }, { label: "Funding", align: "right" }, { label: "Grants", align: "right" }, { label: "" }]}
        rows={data.map((d) => ({
          key: d.name,
          selected: selected.includes(d.name),
          cells: [d.name, formatGBP(d.amount), d.count.toLocaleString("en-GB"), <FilterButton selected={selected.includes(d.name)} label={d.name} onClick={() => onSelect(d.name)} />]
        }))}
      />
    }
  >
    <div className="h-80 w-full mt-6" data-testid="area-chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
          <XAxis dataKey="name" {...AXIS} />
          <YAxis tickFormatter={(v) => formatAmount(Number(v))} {...AXIS} width={64} />
          <Tooltip formatter={(value) => [formatGBP(Number(value)), "Funding"]} contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="amount"
            radius={[4, 4, 0, 0]}
            isAnimationActive={animate}
            onClick={(entry: { name?: string }) => entry?.name && onSelect(entry.name)}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={barFill(selected.includes(entry.name), selected.length > 0)} cursor="pointer" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>
);
