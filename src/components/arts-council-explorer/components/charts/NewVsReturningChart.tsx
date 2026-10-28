import { useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatGBP } from "../../lib/format";
import { formatFY } from "../../lib/fiscal";
import type { NewVsReturning } from "../../lib/aggregate";
import { toCsv } from "../../lib/csv";
import { ChartCard, ChartTable, SegmentedToggle } from "../ui";
import { AXIS, TOOLTIP_STYLE } from "./chartStyles";

const MEASURES = [
  { value: "recipients", label: "Recipients" },
  { value: "funding", label: "Funding" }
] as const;

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export const NewVsReturningChart = ({
  data,
  firstYear,
  animate
}: {
  data: NewVsReturning[];
  /** The dataset's first funding year, which is left out. */
  firstYear: string | null;
  animate: boolean;
}) => {
  const [measure, setMeasure] = useState<"recipients" | "funding">("recipients");
  const newKey = measure === "recipients" ? "newRecipients" : "newFunding";
  const returningKey = measure === "recipients" ? "returningRecipients" : "returningFunding";
  const format = (v: number) => (measure === "recipients" ? v.toLocaleString("en-GB") : formatGBP(v));

  return (
    <ChartCard
      className="lg:col-span-2"
      title="New vs Returning Recipients"
      exportName="new-and-returning-recipients"
      csv={() => toCsv(data, [{ label: "Funding year", value: (d) => d.name }, { label: "New recipients", value: (d) => d.newRecipients }, { label: "Returning recipients", value: (d) => d.returningRecipients }, { label: "Funding to new (£)", value: (d) => d.newFunding }, { label: "Funding to returning (£)", value: (d) => d.returningFunding }])}
      description={
        <>
          “New” means the recipient’s first grant anywhere in this dataset.
          {firstYear && ` ${formatFY(firstYear)} is left out: the data starts there, so every recipient would look new.`} Your
          other filters apply; year and date filters don’t.
        </>
      }
      actions={<SegmentedToggle label="Measure" options={MEASURES} value={measure} onChange={setMeasure} />}
      table={
        <ChartTable
          caption="New and returning recipients per financial year"
          columns={[
            { label: "Year" },
            { label: "New", align: "right" },
            { label: "Returning", align: "right" },
            { label: "New share", align: "right" },
            { label: "Funding to new", align: "right" }
          ]}
          rows={data.map((d) => ({
            key: d.name,
            cells: [
              d.label,
              d.newRecipients.toLocaleString("en-GB"),
              d.returningRecipients.toLocaleString("en-GB"),
              pct(d.newRecipients, d.newRecipients + d.returningRecipients),
              `${formatGBP(d.newFunding)} (${pct(d.newFunding, d.newFunding + d.returningFunding)})`
            ]
          }))}
        />
      }
    >
      <div className="h-72 w-full mt-6" aria-hidden="true" data-testid="new-returning-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <XAxis dataKey="label" {...AXIS} />
            <YAxis
              {...AXIS}
              width={64}
              tickFormatter={(v) => (measure === "recipients" ? Number(v).toLocaleString("en-GB") : formatAmount(Number(v)))}
            />
            <Tooltip formatter={(value, name) => [format(Number(value)), name]} contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#d4d4d8" }} />
            <Bar dataKey={newKey} name="New" stackId="r" fill="#2dd4bf" isAnimationActive={animate} />
            <Bar dataKey={returningKey} name="Returning" stackId="r" fill="rgba(255,255,255,0.7)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
