import { useMemo } from "react";
import { summariseGrants } from "../../lib/aggregate";
import { formatAmount } from "../../lib/format";
import { formatPerPerson, perPerson, QUINTILE_LABELS } from "../../lib/places";
import { listText } from "../../lib/summary";
import type { ProfileContext } from "./context";
import { ActionButton, GrantList, KeyFigures, Panel, ProfileShell, RankedBars, YearColumns } from "./parts";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const PlaceProfile = ({ id, ctx }: { id: string; ctx: ProfileContext }) => {
  const grants = ctx.byPlace.get(id) ?? [];
  const placeName = grants[0]?.local_authority_current ?? id;
  const summary = useMemo(() => summariseGrants(grants, ctx.firstYears), [grants, ctx.firstYears]);
  const { places, placeTotals, dispatch } = ctx;
  const recordedAs = useMemo(
    () => Array.from(new Set(grants.map((g) => g.local_authority).filter((n): n is string => !!n && n !== placeName))).sort(),
    [grants, placeName]
  );
  const population = places.population(placeName);
  const perHead = perPerson(summary.stats.totalAwarded, population);
  const area = places.areaOf(placeName);
  const designated = places.groupsOf(placeName).filter((g) => g !== "outside");
  const deprivation = places.deprivationOf(placeName);
  const code = places.code(placeName);

  const rankByTotal = placeTotals.findIndex((p) => p.name === placeName) + 1;
  const rankByPerHead = useMemo(() => {
    if (perHead === null) return null;
    const ranked = placeTotals
      .map((p) => perPerson(p.amount, places.population(p.name)))
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a);
    return { rank: ranked.findIndex((v) => v <= perHead) + 1, of: ranked.length };
  }, [perHead, placeTotals, places]);

  return (
    <ProfileShell
      onBack={() => dispatch({ type: "closeProfile" })}
      kind="Local authority profile"
      title={placeName}
      subtitle={
        <>
          <p>
            {area ? `In ACE's ${area} area. ` : ""}
            {rankByTotal > 0 && `${ordinal(rankByTotal)} of ${placeTotals.length} local authorities by total funding`}
            {rankByPerHead && `, and ${ordinal(rankByPerHead.rank)} of ${rankByPerHead.of} per resident`}.
          </p>
          {(designated.length > 0 || deprivation) && (
            <div className="flex flex-wrap gap-2 mt-3" data-testid="place-badges">
              {designated.map((g) => (
                <span key={g} className="px-3 py-1 rounded-full border border-amber-300/50 text-amber-200 text-xs">
                  {places.groupLabel(g)}
                </span>
              ))}
              {deprivation && (
                <span className="px-3 py-1 rounded-full border border-white/25 text-white/85 text-xs">
                  {QUINTILE_LABELS[String(deprivation.quintile)]} for deprivation: ranked {deprivation.rank} of {places.deprivation!.districts}
                  {places.deprivation!.edition ? ` (IoD ${places.deprivation!.edition})` : ""}
                </span>
              )}
            </div>
          )}
          {recordedAs.length > 0 && (
            <p className="text-sm text-white/70 mt-1">Includes grants recorded under {listText(recordedAs)}, now part of {id}.</p>
          )}
        </>
      }
      actions={<ActionButton onClick={() => dispatch({ type: "exploreOnly", field: "localAuthorities", value: id })}>Show these grants in the explorer</ActionButton>}
    >
      <KeyFigures
        items={[
          { label: "Total awarded", value: formatAmount(summary.stats.totalAwarded) },
          { label: "Grants", value: summary.stats.count.toLocaleString("en-GB"), note: `${summary.stats.recipientCount.toLocaleString("en-GB")} recipients` },
          { label: "Median award", value: formatAmount(summary.stats.medianAward) },
          perHead !== null
            ? {
                label: "Per resident",
                value: formatPerPerson(perHead),
                note: `Population ${population!.toLocaleString("en-GB")}${places.populationYear ? ` (ONS, ${places.populationYear})` : ""}`
              }
            : { label: "Per resident", value: "—", note: places.hasPopulations ? "No population figure matched" : "Needs population data" }
        ]}
      />
      {code && <p className="text-[11px] font-mono text-white/65 -mt-4">ONS code {code}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Funding by year" className="lg:col-span-2">
          <YearColumns data={summary.byYear} years={ctx.years} />
        </Panel>
        <Panel title="Disciplines">
          <RankedBars items={summary.byDiscipline} onSelect={(d) => dispatch({ type: "openProfile", kind: "discipline", id: d })} />
        </Panel>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Top recipients">
          <RankedBars
            items={summary.recipients.map((r) => ({ name: r.recipient, amount: r.totalAmount, count: r.count }))}
            onSelect={(name) => {
              const r = summary.recipients.find((x) => x.recipient === name);
              if (r) dispatch({ type: "openProfile", kind: "recipient", id: r.key });
            }}
          />
        </Panel>
        <Panel title="Grants, newest first" className="lg:col-span-2">
          <GrantList grants={[...grants].sort((a, b) => b.award_date.localeCompare(a.award_date))} onOpen={(uid) => dispatch({ type: "openGrant", uid })} />
        </Panel>
      </div>
    </ProfileShell>
  );
};
