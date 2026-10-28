// One source of truth for everything the user can change. Chart clicks and
// form controls write to the same fields, so there's no hidden second filter.

import { compareValues } from "./sort";
import { matchesSearch, type SearchScope } from "./search";
import type { PlaceLookup } from "./places";
import { foldText } from "./text";
import type { Grant, RecipientType } from "./types";

export type SortField =
  | "recipient"
  | "activity_name"
  | "award_amount"
  | "award_date"
  | "main_discipline"
  | "ace_area"
  | "funding_year";
export type SortOrder = "asc" | "desc";
export type HistogramMetric = "count" | "amount";
export type TrendView = "absolute" | "yoy";
export type HeatmapMode = "amount" | "row" | "column";

export interface FilterState {
  q: string;
  searchIn: SearchScope;
  /** Each category filter matches any of its values; empty means no filter. */
  years: string[];
  areas: string[];
  /** Local authorities on current boundaries. */
  localAuthorities: string[];
  disciplines: string[];
  strands: string[];
  priorities: string[];
  recipientTypes: RecipientType[];
  /** Designation ids (or "outside"), from the dataset's designated-place lists. */
  placeGroups: string[];
  /** Deprivation fifths of districts, "1" (most deprived) to "5". */
  deprivation: string[];
  /** Exclusive lower bound, matching ACE's "Above £30,000". */
  amountOver: number | null;
  /** Inclusive upper bound, matching ACE's "£30,000 and below". */
  amountUpTo: number | null;
  /** Inclusive ISO dates. */
  dateFrom: string | null;
  dateTo: string | null;
}

export type CompareDimension = "areas" | "disciplines" | "years" | "localAuthorities" | "recipientTypes" | "deprivation";
export type ProfileKind = "recipient" | "place" | "discipline";
export type ViewTab = "overview" | "table" | "charts" | "map" | "compare" | "about";
export type MapMetric = "total" | "count" | "perCapita";

export interface ExplorerState extends FilterState {
  sortField: SortField;
  sortOrder: SortOrder;
  page: number;
  tab: ViewTab;
  histogramMetric: HistogramMetric;
  trendView: TrendView;
  heatmapMode: HeatmapMode;
  mapMetric: MapMetric;
  /** Designation outlined on the map, or null. */
  mapOutline: string | null;
  compareBy: CompareDimension;
  /** Values being compared; empty means "the largest few in view". */
  compareValues: string[];
  /** uid of the grant open in the detail panel. */
  grant: string | null;
  /** Profile page being shown instead of the tabs. */
  profile: { kind: ProfileKind; id: string } | null;
}

export const EMPTY_FILTERS: FilterState = {
  q: "",
  searchIn: "all",
  years: [],
  areas: [],
  localAuthorities: [],
  disciplines: [],
  strands: [],
  priorities: [],
  recipientTypes: [],
  placeGroups: [],
  deprivation: [],
  amountOver: null,
  amountUpTo: null,
  dateFrom: null,
  dateTo: null
};

export const DEFAULT_STATE: ExplorerState = {
  ...EMPTY_FILTERS,
  sortField: "award_amount",
  sortOrder: "desc",
  page: 1,
  tab: "overview",
  histogramMetric: "count",
  trendView: "absolute",
  heatmapMode: "amount",
  mapMetric: "total",
  mapOutline: null,
  compareBy: "areas",
  compareValues: [],
  grant: null,
  profile: null
};

/** Filters that hold a list of category values. */
export type CategoryField =
  | "years"
  | "areas"
  | "localAuthorities"
  | "disciplines"
  | "strands"
  | "priorities"
  | "recipientTypes"
  | "placeGroups"
  | "deprivation";
export const CATEGORY_FIELDS: readonly CategoryField[] = [
  "years",
  "areas",
  "localAuthorities",
  "disciplines",
  "strands",
  "priorities",
  "recipientTypes",
  "placeGroups",
  "deprivation"
];

export type ExplorerAction =
  | { type: "setSearch"; q: string; searchIn?: SearchScope }
  /** Replace a category filter's values (from a multi-select). */
  | { type: "setValues"; field: CategoryField; values: string[] }
  /** Chart clicks: add the value, or remove it if already selected. */
  | { type: "toggleValue"; field: CategoryField; value: string }
  /** Remove one value (from its chip). */
  | { type: "removeValue"; field: CategoryField; value: string }
  /** Heatmap clicks: exactly this area and discipline, or clear both if already exactly that. */
  | { type: "toggleCell"; area: string; discipline: string }
  | { type: "setAmount"; over: number | null; upTo: number | null }
  /** Histogram clicks: selecting the active bracket again clears it. */
  | { type: "toggleAmount"; over: number | null; upTo: number | null }
  | { type: "setDates"; from: string | null; to: string | null }
  | { type: "sort"; field: SortField }
  | { type: "setSort"; field: SortField; order: SortOrder }
  | { type: "setPage"; page: number }
  | { type: "setTab"; tab: ViewTab }
  | { type: "setHistogramMetric"; metric: HistogramMetric }
  | { type: "setTrendView"; view: TrendView }
  | { type: "setHeatmapMode"; mode: HeatmapMode }
  | { type: "setMapMetric"; metric: MapMetric }
  | { type: "setMapOutline"; designation: string | null }
  | { type: "setCompare"; by: CompareDimension; values: string[] }
  | { type: "openGrant"; uid: string }
  | { type: "closeGrant" }
  | { type: "openProfile"; kind: ProfileKind; id: string }
  | { type: "closeProfile" }
  /** Apply one value as the only filter and show the grants list (from a profile). */
  | { type: "exploreOnly"; field: CategoryField; value: string }
  /** Every grant to one recipient, in the table: clears other filters. */
  | { type: "showRecipient"; name: string }
  /** Clear a non-category filter (from its chip). */
  | { type: "clear"; filter: "search" | "amount" | "dates" }
  | { type: "clearFilters" }
  | { type: "reset" }
  /** Replace state wholesale, e.g. from the URL on back/forward. */
  | { type: "hydrate"; state: ExplorerState };

/** Defaults to descending for amounts and dates, ascending for text. */
const defaultOrder = (field: SortField): SortOrder =>
  field === "award_amount" || field === "award_date" || field === "funding_year" ? "desc" : "asc";

const withFilters = (state: ExplorerState, changes: Partial<FilterState>): ExplorerState => ({
  ...state,
  ...changes,
  page: 1
});

const toggled = (values: readonly string[], value: string): string[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

const sameValues = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v) => b.includes(v));

export const explorerReducer = (state: ExplorerState, action: ExplorerAction): ExplorerState => {
  switch (action.type) {
    case "setSearch":
      return withFilters(state, { q: action.q, searchIn: action.searchIn ?? state.searchIn });
    case "setValues":
      return sameValues(state[action.field], action.values)
        ? state
        : withFilters(state, { [action.field]: Array.from(new Set(action.values)) });
    case "toggleValue":
      return withFilters(state, { [action.field]: toggled(state[action.field], action.value) });
    case "removeValue":
      return withFilters(state, { [action.field]: state[action.field].filter((v) => v !== action.value) });
    case "toggleCell": {
      const selected =
        sameValues(state.areas, [action.area]) && sameValues(state.disciplines, [action.discipline]);
      return withFilters(state, {
        areas: selected ? [] : [action.area],
        disciplines: selected ? [] : [action.discipline]
      });
    }
    case "setAmount":
      return withFilters(state, { amountOver: action.over, amountUpTo: action.upTo });
    case "toggleAmount": {
      const selected = state.amountOver === action.over && state.amountUpTo === action.upTo;
      return withFilters(state, {
        amountOver: selected ? null : action.over,
        amountUpTo: selected ? null : action.upTo
      });
    }
    case "setDates":
      return withFilters(state, { dateFrom: action.from, dateTo: action.to });
    case "sort":
      return state.sortField === action.field
        ? { ...state, sortOrder: state.sortOrder === "asc" ? "desc" : "asc", page: 1 }
        : { ...state, sortField: action.field, sortOrder: defaultOrder(action.field), page: 1 };
    case "setSort":
      return { ...state, sortField: action.field, sortOrder: action.order, page: 1 };
    case "setPage":
      return { ...state, page: Math.max(1, Math.floor(action.page)) };
    case "setTab":
      return { ...state, tab: action.tab, profile: null, grant: null, page: 1 };
    case "setHistogramMetric":
      return { ...state, histogramMetric: action.metric };
    case "setTrendView":
      return { ...state, trendView: action.view };
    case "setHeatmapMode":
      return { ...state, heatmapMode: action.mode };
    case "setMapMetric":
      return { ...state, mapMetric: action.metric };
    case "setMapOutline":
      return { ...state, mapOutline: action.designation };
    case "setCompare":
      return { ...state, compareBy: action.by, compareValues: Array.from(new Set(action.values)).slice(0, MAX_COMPARE), profile: null };
    case "openGrant":
      return { ...state, grant: action.uid };
    case "closeGrant":
      return { ...state, grant: null };
    case "openProfile":
      return { ...state, profile: { kind: action.kind, id: action.id }, grant: null };
    case "closeProfile":
      return { ...state, profile: null, grant: null };
    case "exploreOnly":
      return { ...state, ...EMPTY_FILTERS, [action.field]: [action.value], tab: "table", profile: null, grant: null, page: 1 };
    case "showRecipient":
      return { ...state, ...EMPTY_FILTERS, q: action.name, searchIn: "recipient", tab: "table", grant: null, profile: null, page: 1 };
    case "clear":
      return withFilters(state, CLEAR[action.filter]);
    case "clearFilters":
      return withFilters(state, EMPTY_FILTERS);
    case "reset":
      // Keeps the current view and chart settings: those aren't filters.
      return {
        ...DEFAULT_STATE,
        tab: state.tab,
        histogramMetric: state.histogramMetric,
        trendView: state.trendView,
        heatmapMode: state.heatmapMode,
        mapMetric: state.mapMetric,
        mapOutline: state.mapOutline,
        compareBy: state.compareBy,
        compareValues: state.compareValues
      };
    case "hydrate":
      return action.state;
  }
};

/** At most this many values can be compared side by side. */
export const MAX_COMPARE = 4;

// ---------------------------------------------------------------------------
// Active filters (for chips)
// ---------------------------------------------------------------------------

const CLEAR: Record<"search" | "amount" | "dates", Partial<FilterState>> = {
  search: { q: "", searchIn: "all" },
  amount: { amountOver: null, amountUpTo: null },
  dates: { dateFrom: null, dateTo: null }
};

/** One chip per active value. */
export type ActiveFilter =
  | { kind: "search" }
  | { kind: "amount" }
  | { kind: "dates" }
  | { kind: "value"; field: CategoryField; value: string };

export const activeFilters = (f: FilterState): ActiveFilter[] => {
  const list: ActiveFilter[] = [];
  if (f.q.trim()) list.push({ kind: "search" });
  for (const field of CATEGORY_FIELDS) for (const value of f[field]) list.push({ kind: "value", field, value });
  if (f.amountOver !== null || f.amountUpTo !== null) list.push({ kind: "amount" });
  if (f.dateFrom !== null || f.dateTo !== null) list.push({ kind: "dates" });
  return list;
};

// ---------------------------------------------------------------------------
// Filtering
//
// Each filter is a bit. filterMask() returns the bits of the filters a grant
// fails, so a chart can include grants that fail only its own filter
// (crossfilter): the area chart ignores the area filter, and so on.
// ---------------------------------------------------------------------------

export const DIM = {
  search: 1 << 0,
  years: 1 << 1,
  areas: 1 << 2,
  localAuthorities: 1 << 3,
  disciplines: 1 << 4,
  strands: 1 << 5,
  priorities: 1 << 6,
  recipientTypes: 1 << 7,
  amount: 1 << 8,
  dates: 1 << 9,
  placeGroups: 1 << 10,
  deprivation: 1 << 11
} as const;

export type FilterMask = (grant: Grant) => number;

const setOrNull = (values: readonly string[]) => (values.length > 0 ? new Set(values) : null);

/**
 * Place filters (designations, deprivation) need `places`; without it, any
 * grant fails them.
 */
export const compileFilters = (f: FilterState, places?: PlaceLookup): FilterMask => {
  const q = foldText(f.q.trim());
  const { searchIn, amountOver, amountUpTo, dateFrom, dateTo } = f;
  const years = setOrNull(f.years);
  const areas = setOrNull(f.areas);
  const las = setOrNull(f.localAuthorities);
  const disciplines = setOrNull(f.disciplines);
  const strands = setOrNull(f.strands);
  const priorities = setOrNull(f.priorities);
  const types = setOrNull(f.recipientTypes);
  const groups = setOrNull(f.placeGroups);
  const fifths = setOrNull(f.deprivation);
  return (g) => {
    let mask = 0;
    if (q && !matchesSearch(g, q, searchIn)) mask |= DIM.search;
    if (years && !years.has(g.funding_year)) mask |= DIM.years;
    if (areas && !areas.has(g.ace_area ?? "")) mask |= DIM.areas;
    if (las && !las.has(g.local_authority_current ?? "")) mask |= DIM.localAuthorities;
    if (disciplines && !disciplines.has(g.main_discipline ?? "")) mask |= DIM.disciplines;
    if (strands && !strands.has(g.strand ?? "")) mask |= DIM.strands;
    if (priorities && !priorities.has(g.time_limited_priority ?? "")) mask |= DIM.priorities;
    if (types && !types.has(g.recipient_type)) mask |= DIM.recipientTypes;
    if (groups && !(places?.groupsOf(g.local_authority_current) ?? []).some((id) => groups.has(id))) mask |= DIM.placeGroups;
    if (fifths) {
      const q = places?.quintileOf(g.local_authority_current) ?? null;
      if (q === null || !fifths.has(String(q))) mask |= DIM.deprivation;
    }
    if ((amountOver !== null && !(g.award_amount > amountOver)) || (amountUpTo !== null && !(g.award_amount <= amountUpTo))) {
      mask |= DIM.amount;
    }
    if ((dateFrom !== null && !(g.award_date >= dateFrom)) || (dateTo !== null && !(g.award_date <= dateTo))) {
      mask |= DIM.dates;
    }
    return mask;
  };
};

/** Grants that pass every filter, in their existing order. */
export const filterGrants = (rows: readonly Grant[], filters: FilterState, places?: PlaceLookup): Grant[] => {
  if (activeFilters(filters).length === 0) return rows.slice();
  const mask = compileFilters(filters, places);
  return rows.filter((row) => mask(row) === 0);
};

/** Sorts in place and returns the same array. Missing values always go last. */
export const sortGrants = (rows: Grant[], field: SortField, order: SortOrder): Grant[] =>
  rows.sort((a, b) => compareValues(a[field], b[field], order));

// ---------------------------------------------------------------------------
// Options and sanitising
// ---------------------------------------------------------------------------

export interface FilterOptions {
  years: readonly string[];
  areas: readonly string[];
  localAuthorities: readonly string[];
  disciplines: readonly string[];
  strands: readonly string[];
  priorities: readonly string[];
  /** Designation ids plus "outside", when the dataset has designations. */
  placeGroups: readonly string[];
  /** "1"–"5", when the dataset has deprivation ranks. */
  deprivation: readonly string[];
}

const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

export const filterOptions = (
  rows: readonly Grant[],
  places?: { designations: ReadonlyArray<{ id: string }>; deprivation: unknown }
): FilterOptions => {
  const sets = {
    years: new Set<string>(),
    areas: new Set<string>(),
    localAuthorities: new Set<string>(),
    disciplines: new Set<string>(),
    strands: new Set<string>(),
    priorities: new Set<string>()
  };
  for (const row of rows) {
    if (row.funding_year) sets.years.add(row.funding_year);
    if (row.ace_area) sets.areas.add(row.ace_area);
    if (row.local_authority_current) sets.localAuthorities.add(row.local_authority_current);
    if (row.main_discipline) sets.disciplines.add(row.main_discipline);
    if (row.strand) sets.strands.add(row.strand);
    if (row.time_limited_priority) sets.priorities.add(row.time_limited_priority);
  }
  const sorted = (s: Set<string>) => Array.from(s).sort(collator.compare);
  return {
    years: Array.from(sets.years).sort(),
    areas: sorted(sets.areas),
    localAuthorities: sorted(sets.localAuthorities),
    disciplines: sorted(sets.disciplines),
    strands: sorted(sets.strands),
    priorities: sorted(sets.priorities),
    placeGroups: places && places.designations.length > 0 ? [...places.designations.map((d) => d.id), "outside"] : [],
    deprivation: places?.deprivation ? ["1", "2", "3", "4", "5"] : []
  };
};

const RECIPIENT_TYPES: readonly string[] = ["organisation", "individual", "unknown"];
const DIMENSIONS: readonly CompareDimension[] = ["areas", "disciplines", "years", "localAuthorities", "recipientTypes", "deprivation"];

const allowedFor = (field: CategoryField, options: FilterOptions): readonly string[] =>
  field === "recipientTypes" ? RECIPIENT_TYPES : options[field];

/**
 * Drops values the dataset doesn't contain (for example from an old shared
 * link), so the UI never shows an empty result for an invisible reason.
 * Returns the same object when nothing changes.
 */
export const sanitizeState = (
  state: ExplorerState,
  options: FilterOptions,
  exists: {
    grant?: (uid: string) => boolean;
    recipient?: (key: string) => boolean;
    resolveProfile?: (kind: ProfileKind, id: string) => string | null;
  } = {}
): ExplorerState => {
  const next: ExplorerState = { ...state };
  let filtersChanged = false;
  for (const field of CATEGORY_FIELDS) {
    const allowed = allowedFor(field, options);
    const kept = state[field].filter((v) => allowed.includes(v));
    if (kept.length !== state[field].length) {
      (next as Record<CategoryField, string[]>)[field] = kept;
      filtersChanged = true;
    }
  }
  if (state.grant !== null && exists.grant && !exists.grant(state.grant)) next.grant = null;
  if (state.mapOutline !== null && !options.placeGroups.includes(state.mapOutline)) next.mapOutline = null;

  if (!DIMENSIONS.includes(state.compareBy) || (state.compareBy === "deprivation" && options.deprivation.length === 0)) next.compareBy = "areas";
  const compareAllowed = allowedFor(next.compareBy, options);
  const compareKept = state.compareValues.filter((v) => compareAllowed.includes(v));
  if (compareKept.length !== state.compareValues.length) next.compareValues = compareKept;

  if (state.profile) {
    const { kind, id } = state.profile;
    if (exists.resolveProfile) {
      const canonicalId = exists.resolveProfile(kind, id);
      if (canonicalId) {
        if (canonicalId !== id) {
          next.profile = { kind, id: canonicalId };
        }
      } else {
        next.profile = null;
      }
    } else {
      const ok =
        kind === "recipient" ? (exists.recipient ? exists.recipient(id) : true)
        : kind === "place" ? options.localAuthorities.includes(id)
        : options.disciplines.includes(id);
      if (!ok) next.profile = null;
    }
  }

  const isProfileEqual = (a: ExplorerState["profile"], b: ExplorerState["profile"]): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.kind === b.kind && a.id === b.id;
  };

  const changed = (Object.keys(next) as Array<keyof ExplorerState>).some((k) => {
    if (k === "profile") return !isProfileEqual(next.profile, state.profile);
    return next[k] !== state[k];
  });
  if (!changed) return state;
  return filtersChanged ? { ...next, page: 1 } : next;
};
