import type { Aggregates } from "../lib/aggregate";
import type { ExplorerState } from "../lib/filters";
import type { ExplorerDispatch } from "../state/useExplorerState";
import { AreaBarChart } from "./charts/AreaBarChart";
import { ConcentrationPanel } from "./charts/ConcentrationPanel";
import { DisciplineAreaHeatmap } from "./charts/DisciplineAreaHeatmap";
import { DisciplineBarChart } from "./charts/DisciplineBarChart";
import { FundingTrendChart } from "./charts/FundingTrendChart";
import { GrantSizeHistogram } from "./charts/GrantSizeHistogram";
import { NewVsReturningChart } from "./charts/NewVsReturningChart";
import { PlaceLensesCard } from "./charts/PlaceLensesCard";
import type { PlaceIndex } from "../lib/places";

export const AnalyticsView = ({
  aggregates,
  state,
  dispatch,
  animate,
  firstYear,
  places
}: {
  aggregates: Aggregates;
  state: ExplorerState;
  dispatch: ExplorerDispatch;
  animate: boolean;
  firstYear: string | null;
  places: PlaceIndex;
}) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <AreaBarChart
        data={aggregates.byArea}
        selected={state.areas}
        onSelect={(value) => dispatch({ type: "toggleValue", field: "areas", value })}
        animate={animate}
      />
      <DisciplineBarChart
        data={aggregates.byDiscipline}
        selected={state.disciplines}
        onSelect={(value) => dispatch({ type: "toggleValue", field: "disciplines", value })}
        animate={animate}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <GrantSizeHistogram
        data={aggregates.histogram}
        metric={state.histogramMetric}
        onMetricChange={(metric) => dispatch({ type: "setHistogramMetric", metric })}
        selected={{ over: state.amountOver, upTo: state.amountUpTo }}
        onSelect={(over, upTo) => dispatch({ type: "toggleAmount", over, upTo })}
        animate={animate}
      />
      <FundingTrendChart
        data={aggregates.years}
        view={state.trendView}
        onViewChange={(view) => dispatch({ type: "setTrendView", view })}
        selectedYears={state.years}
        onSelectYear={(value) => dispatch({ type: "toggleValue", field: "years", value })}
        animate={animate}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <DisciplineAreaHeatmap
        heatmap={aggregates.heatmap}
        mode={state.heatmapMode}
        onModeChange={(mode) => dispatch({ type: "setHeatmapMode", mode })}
        selectedAreas={state.areas}
        selectedDisciplines={state.disciplines}
        onSelectCell={(area, discipline) => dispatch({ type: "toggleCell", area, discipline })}
      />
      <ConcentrationPanel
        concentration={aggregates.concentration}
        leaderboard={aggregates.recipients.slice(0, 10)}
        onOpenRecipient={(key) => dispatch({ type: "openProfile", kind: "recipient", id: key })}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <NewVsReturningChart data={aggregates.newVsReturning} firstYear={firstYear} animate={animate} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <PlaceLensesCard
        aggregates={aggregates}
        places={places}
        selectedFifths={state.deprivation}
        selectedGroups={state.placeGroups}
        onToggleFifth={(value) => dispatch({ type: "toggleValue", field: "deprivation", value })}
        onToggleGroup={(value) => dispatch({ type: "toggleValue", field: "placeGroups", value })}
        animate={animate}
      />
    </div>
  </div>
);
