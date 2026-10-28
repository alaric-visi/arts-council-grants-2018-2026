import { useMemo } from "react";
import { summariseGrants } from "../../lib/aggregate";
import { formatAmount } from "../../lib/format";
import { formatPerPerson, perPerson } from "../../lib/places";
import type { ProfileContext } from "./context";
import { ActionButton, KeyFigures, Panel, ProfileShell, RankedBars, YearColumns } from "./parts";

export const DisciplineProfile = ({ id, ctx }: { id: string; ctx: ProfileContext }) => {
  const grants = ctx.byDiscipline.get(id) ?? [];
  const disciplineName = grants[0]?.main_discipline ?? id;
  const summary = useMemo(() => summariseGrants(grants, ctx.firstYears), [grants, ctx.firstYears]);
  const { overall, places, dispatch } = ctx;
  const share = overall.totalAwarded > 0 ? Math.round((summary.stats.totalAwarded / overall.totalAwarded) * 100) : 0;
  const medianVsAll = summary.stats.medianAward - overall.medianAward;

  return (
    <ProfileShell
      onBack={() => dispatch({ type: "closeProfile" })}
      kind="Discipline profile"
      title={disciplineName}
      subtitle={
        <p>
          {share}% of all funding in the dataset. The median {disciplineName.toLowerCase()} award is {formatAmount(summary.stats.medianAward)},{" "}
          {medianVsAll === 0 ? "the same as" : `${formatAmount(Math.abs(medianVsAll))} ${medianVsAll > 0 ? "above" : "below"}`} the median across all
          disciplines.
        </p>
      }
      actions={<ActionButton onClick={() => dispatch({ type: "exploreOnly", field: "disciplines", value: disciplineName })}>Show these grants in the explorer</ActionButton>}
    >
      <KeyFigures
        items={[
          { label: "Total awarded", value: formatAmount(summary.stats.totalAwarded), note: `${share}% of all funding` },
          { label: "Grants", value: summary.stats.count.toLocaleString("en-GB") },
          { label: "Median award", value: formatAmount(summary.stats.medianAward), note: `All disciplines: ${formatAmount(overall.medianAward)}` },
          { label: "Recipients", value: summary.stats.recipientCount.toLocaleString("en-GB"), note: "Distinct recipients" }
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Funding by year" className="lg:col-span-2">
          <YearColumns data={summary.byYear} years={ctx.years} />
        </Panel>
        <Panel title="By ACE area">
          <RankedBars
            items={summary.byArea}
            note={(item) => (places.hasPopulations ? `${formatPerPerson(perPerson(item.amount, places.areaPopulation(item.name)))} per resident` : null)}
          />
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Top local authorities">
          <RankedBars items={summary.byLocalAuthority} onSelect={(la) => dispatch({ type: "openProfile", kind: "place", id: la })} />
        </Panel>
        <Panel title="Top recipients">
          <RankedBars
            items={summary.recipients.map((r) => ({ name: r.recipient, amount: r.totalAmount, count: r.count }))}
            onSelect={(name) => {
              const r = summary.recipients.find((x) => x.recipient === name);
              if (r) dispatch({ type: "openProfile", kind: "recipient", id: r.key });
            }}
          />
        </Panel>
        <Panel title="Strands">
          <RankedBars items={summary.byStrand} />
        </Panel>
      </div>
    </ProfileShell>
  );
};
