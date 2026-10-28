import type { Grant } from "../../lib/types";
import type { NamedAmount, Stats } from "../../lib/aggregate";
import type { PlaceIndex } from "../../lib/places";
import type { ExplorerDispatch } from "../../state/useExplorerState";

/** Everything the profile pages need, computed once per dataset. */
export interface ProfileContext {
  byRecipient: ReadonlyMap<string, Grant[]>;
  byPlace: ReadonlyMap<string, Grant[]>;
  byDiscipline: ReadonlyMap<string, Grant[]>;
  firstYears: ReadonlyMap<string, string>;
  places: PlaceIndex;
  /** Whole-dataset figures, for "share of all funding" and comparisons. */
  overall: Stats;
  /** Every funding year in the dataset, oldest first. */
  years: readonly string[];
  /** All-time funding per local authority, largest first. */
  placeTotals: NamedAmount[];
  dispatch: ExplorerDispatch;
}
