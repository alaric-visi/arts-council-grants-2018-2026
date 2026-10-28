import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { Aggregates } from "../lib/aggregate";
import { UNSPECIFIED } from "../lib/aggregate";
import { formatFY } from "../lib/fiscal";
import { formatAmount } from "../lib/format";
import { formatPerPerson, OUTSIDE_DESIGNATIONS, perPerson } from "../lib/places";
import type { PlaceIndex } from "../lib/places";
import type { ExplorerDispatch } from "../state/useExplorerState";
import { FOCUS_RING } from "./focus";

interface Insight {
  id: string;
  value: string;
  text: ReactNode;
  action: { label: string; run: () => void };
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Findings from the current view, each linking to where it can be explored. Uses only figures already computed. */
export const buildInsights = (aggregates: Aggregates, places: PlaceIndex, dispatch: ExplorerDispatch): Insight[] => {
  const insights: Insight[] = [];
  const { stats } = aggregates;
  if (stats.count === 0) return insights;

  const complete = aggregates.years.filter((y) => !y.partial);
  if (complete.length >= 2) {
    const peak = complete.reduce((a, b) => (b.amount > a.amount ? b : a));
    insights.push({
      id: "peak-year",
      value: formatAmount(peak.amount),
      text: <>was awarded in {formatFY(peak.name)}, the most of any complete year in view.</>,
      action: { label: "See the trend", run: () => dispatch({ type: "setTab", tab: "charts" }) }
    });
  }

  const areas = aggregates.byArea.filter((a) => a.name !== UNSPECIFIED);
  const areaTotal = areas.reduce((s, a) => s + a.amount, 0);
  if (areas.length >= 2) {
    insights.push({
      id: "largest-area",
      value: `${pct(areas[0].amount, areaTotal)}%`,
      text: <>of funding went to {areas[0].name === "London" ? "London" : `the ${areas[0].name}`}, the largest share of any ACE area.</>,
      action: {
        label: "Compare areas",
        run: () => {
          dispatch({ type: "setCompare", by: "areas", values: [] });
          dispatch({ type: "setTab", tab: "compare" });
        }
      }
    });
  }

  if (places.hasPopulations && areas.length >= 2) {
    const perHead = areas
      .map((a) => ({ name: a.name, value: perPerson(a.amount, places.areaPopulation(a.name)) }))
      .filter((a): a is { name: string; value: number } => a.value !== null)
      .sort((a, b) => b.value - a.value);
    if (perHead.length >= 2) {
      const [high, low] = [perHead[0], perHead[perHead.length - 1]];
      insights.push({
        id: "per-resident-areas",
        value: `${formatPerPerson(high.value)} vs ${formatPerPerson(low.value)}`,
        text: (
          <>
            per resident in {high.name === "London" ? "London" : `the ${high.name}`} and {low.name === "London" ? "London" : `the ${low.name}`}, the
            highest and lowest of the ACE areas.
          </>
        ),
        action: {
          label: "See the map",
          run: () => {
            dispatch({ type: "setMapMetric", metric: "perCapita" });
            dispatch({ type: "setTab", tab: "map" });
          }
        }
      });
    }
  }

  const disciplines = aggregates.byDiscipline.filter((d) => d.name !== UNSPECIFIED);
  const disciplineTotal = aggregates.byDiscipline.reduce((s, d) => s + d.amount, 0);
  if (disciplines.length >= 2) {
    insights.push({
      id: "largest-discipline",
      value: `${pct(disciplines[0].amount, disciplineTotal)}%`,
      text: <>of funding went to {disciplines[0].name}, the largest discipline in view.</>,
      action: { label: `Open the ${disciplines[0].name} profile`, run: () => dispatch({ type: "openProfile", kind: "discipline", id: disciplines[0].name }) }
    });
  }

  if (aggregates.recipients.length >= 20) {
    insights.push({
      id: "concentration",
      value: `${aggregates.concentration.top10PctShare}%`,
      text: <>of funding went to the top 10% of recipients.</>,
      action: { label: "See the leaderboard", run: () => dispatch({ type: "setTab", tab: "charts" }) }
    });
  }

  const latestComplete = [...aggregates.newVsReturning].reverse().find((y) => !y.partial);
  if (latestComplete) {
    const all = latestComplete.newRecipients + latestComplete.returningRecipients;
    if (all > 0) {
      insights.push({
        id: "new-recipients",
        value: `${pct(latestComplete.newRecipients, all)}%`,
        text: <>of recipients in {formatFY(latestComplete.name)} had no earlier grant in this data.</>,
        action: { label: "See new vs returning", run: () => dispatch({ type: "setTab", tab: "charts" }) }
      });
    }
  }

  if (places.hasPopulations && aggregates.byDeprivation.length === 5) {
    const most = aggregates.byDeprivation[0];
    const least = aggregates.byDeprivation[4];
    const a = perPerson(most.amount, places.quintilePopulation(1));
    const b = perPerson(least.amount, places.quintilePopulation(5));
    if (a !== null && b !== null) {
      insights.push({
        id: "deprivation",
        value: `${formatPerPerson(a)} vs ${formatPerPerson(b)}`,
        text: <>per resident in the most and least deprived fifths of districts.</>,
        action: { label: "See place lenses", run: () => dispatch({ type: "setTab", tab: "charts" }) }
      });
    }
  }

  if (places.hasPopulations && places.totalPopulation) {
    for (const group of aggregates.byPlaceGroup.filter((g) => g.id !== OUTSIDE_DESIGNATIONS)) {
      const population = places.groupPopulation(group.id);
      if (population === null || aggregates.placeGroupTotal <= 0) continue;
      insights.push({
        id: `designation-${group.id}`,
        value: `${pct(group.amount, aggregates.placeGroupTotal)}%`,
        text: (
          <>
            of funding went to {places.groupLabel(group.id)}, home to {pct(population, places.totalPopulation)}% of residents.
          </>
        ),
        action: {
          label: "Show these grants",
          run: () => {
            dispatch({ type: "setValues", field: "placeGroups", values: [group.id] });
            dispatch({ type: "setTab", tab: "table" });
          }
        }
      });
    }
  }

  return insights;
};

export const OverviewView = ({
  aggregates,
  places,
  dispatch
}: {
  aggregates: Aggregates;
  places: PlaceIndex;
  dispatch: ExplorerDispatch;
}) => {
  const insights = buildInsights(aggregates, places, dispatch);
  return (
    <section aria-labelledby="ace-overview-title" data-testid="overview">
      <h2 id="ace-overview-title" className="text-sm font-semibold tracking-wide uppercase text-white/85 font-mono mb-4">
        At a glance
      </h2>
      {insights.length === 0 ? (
        <p className="text-white/75">No grants match these filters. Try removing one.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((insight) => (
            <li key={insight.id} className="p-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col justify-between gap-4">
              <p>
                <span className="block text-3xl font-light tracking-tight text-white">{insight.value}</span>
                <span className="block text-white/80 mt-2 leading-relaxed">{insight.text}</span>
              </p>
              <button
                type="button"
                onClick={insight.action.run}
                className={`self-start inline-flex items-center gap-1.5 text-xs font-mono text-teal-300 hover:text-teal-200 rounded cursor-pointer ${FOCUS_RING}`}
              >
                {insight.action.label}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
