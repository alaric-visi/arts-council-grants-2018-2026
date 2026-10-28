import { useMemo } from "react";
import { summariseGrants } from "../../lib/aggregate";
import { formatFY } from "../../lib/fiscal";
import { formatAmount } from "../../lib/format";
import { listText } from "../../lib/summary";
import type { ProfileContext } from "./context";
import { ActionButton, GrantList, KeyFigures, Panel, ProfileShell, RankedBars, YearColumns } from "./parts";

const TYPE_TEXT = { organisation: "Organisation", individual: "Individual", unknown: "Recipient" };

export const RecipientProfile = ({ id, ctx }: { id: string; ctx: ProfileContext }) => {
  const grants = ctx.byRecipient.get(id) ?? [];
  const summary = useMemo(() => summariseGrants(grants, ctx.firstYears), [grants, ctx.firstYears]);
  const spellings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grants) counts.set(g.recipient, (counts.get(g.recipient) ?? 0) + 1);
    return Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [grants]);
  const name = spellings[0]?.[0] ?? id;
  const type = grants[0]?.recipient_type ?? "unknown";
  const yearsFunded = summary.byYear.length;
  const { dispatch } = ctx;

  return (
    <ProfileShell
      onBack={() => dispatch({ type: "closeProfile" })}
      kind={`${TYPE_TEXT[type]} profile${type === "unknown" ? "" : " (type inferred from the name)"}`}
      title={name}
      subtitle={
        <>
          {summary.firstYear && (
            <p>
              Funded in {yearsFunded} of the years covered, first in {formatFY(summary.firstYear)}
              {summary.lastYear && summary.lastYear !== summary.firstYear ? ` and most recently in ${formatFY(summary.lastYear)}` : ""}.
            </p>
          )}
          {spellings.length > 1 && (
            <p className="text-sm text-white/70 mt-1">
              Also recorded as {listText(spellings.slice(1).map(([s]) => `“${s}”`))}.
            </p>
          )}
        </>
      }
      actions={<ActionButton onClick={() => dispatch({ type: "showRecipient", name })}>Search the grants list for this name</ActionButton>}
    >
      <KeyFigures
        items={[
          { label: "Total awarded", value: formatAmount(summary.stats.totalAwarded) },
          { label: "Grants", value: summary.stats.count.toLocaleString("en-GB") },
          { label: "Median award", value: formatAmount(summary.stats.medianAward), note: `Largest ${formatAmount(summary.stats.maxAward)}` },
          { label: "Years funded", value: String(yearsFunded) }
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Funding by year" className="lg:col-span-2">
          <YearColumns data={summary.byYear} years={ctx.years} />
        </Panel>
        <Panel title="Where">
          <RankedBars
            items={summary.byLocalAuthority}
            onSelect={(la) => dispatch({ type: "openProfile", kind: "place", id: la })}
          />
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Disciplines">
          <RankedBars items={summary.byDiscipline} onSelect={(d) => dispatch({ type: "openProfile", kind: "discipline", id: d })} />
        </Panel>
        <Panel title="Grants, newest first" className="lg:col-span-2">
          <GrantList
            grants={[...grants].sort((a, b) => b.award_date.localeCompare(a.award_date))}
            onOpen={(uid) => dispatch({ type: "openGrant", uid })}
          />
        </Panel>
      </div>
    </ProfileShell>
  );
};
