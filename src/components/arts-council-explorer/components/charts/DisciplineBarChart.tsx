import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatGBP } from "../../lib/format";
import type { NamedAmount } from "../../lib/aggregate";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, FilterButton } from "../ui";
import { AXIS, TOOLTIP_STYLE, barFill } from "./chartStyles";

export const DisciplineBarChart = ({
  data,
  selected,
  onSelect,
  animate
}: {
  data: NamedAmount[];
  selected: readonly string[];
  onSelect: (discipline: string) => void;
  animate: boolean;
}) => (
  <ChartCard
    title="Funding by Discipline (Top 10)"
      exportName="funding-by-discipline"
      csv={() => toCsv(data, [{ label: "Discipline", value: (d) => d.name }, { label: "Funding (£)", value: (d) => d.amount }, { label: "Grants", value: (d) => d.count }])}
    description="Funding by main discipline, with your other filters applied. Select disciplines to filter everything else."
    table={
      <ChartTable
        caption="Funding by discipline, top 10"
        columns={[{ label: "Discipline" }, { label: "Funding", align: "right" }, { label: "Grants", align: "right" }, { label: "" }]}
        rows={data.map((d) => ({
          key: d.name,
          selected: selected.includes(d.name),
          cells: [d.name, formatGBP(d.amount), d.count.toLocaleString("en-GB"), <FilterButton selected={selected.includes(d.name)} label={d.name} onClick={() => onSelect(d.name)} />]
        }))}
      />
    }
  >
    <div className="h-80 w-full mt-6" data-testid="discipline-chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
          <XAxis type="number" tickFormatter={(v) => formatAmount(Number(v))} {...AXIS} />
          <YAxis dataKey="name" type="category" width={110} {...AXIS} />
          <Tooltip formatter={(value) => [formatGBP(Number(value)), "Funding"]} contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="amount"
            radius={[0, 4, 4, 0]}
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
