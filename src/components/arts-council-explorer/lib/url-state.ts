// Explorer state <-> URL query string, so any view can be bookmarked or shared.
//
// Only values that differ from the defaults are written, parameter order is
// fixed, and query parameters that belong to the host page are preserved.
//
//   ?q=theatre&year=2024-2025&area=North&area=London&over=30000&view=analytics&grant=0ab12cd34ef
//
// Category filters repeat their parameter for each value (area=North&area=London).

import { DEFAULT_STATE } from "./filters";
import type { CompareDimension, ExplorerState, HeatmapMode, MapMetric, ProfileKind, SortField, SortOrder, ViewTab } from "./filters";
import type { SearchScope } from "./search";
import type { RecipientType } from "./types";

const SORT_TO_PARAM: Record<SortField, string> = {
  recipient: "recipient",
  activity_name: "project",
  award_amount: "amount",
  award_date: "date",
  main_discipline: "discipline",
  ace_area: "area",
  funding_year: "year"
};
const SORT_FROM_PARAM: Record<string, SortField> = Object.fromEntries(
  Object.entries(SORT_TO_PARAM).map(([field, param]) => [param, field as SortField])
);

const SCOPE_TO_PARAM: Record<SearchScope, string | null> = { all: null, recipient: "recipient", activity: "project" };

/** Every query parameter the explorer owns, in the order they're written. */
export const OWN_PARAMS = [
  "q",
  "in",
  "year",
  "area",
  "la",
  "discipline",
  "strand",
  "priority",
  "type",
  "group",
  "dep",
  "over",
  "upto",
  "from",
  "to",
  "sort",
  "order",
  "view",
  "size",
  "trend",
  "heat",
  "metric",
  "outline",
  "by",
  "c",
  "profile",
  "grant",
  "page"
] as const;

// The overview is the landing view (no parameter). Links from before it
// existed have no "view" but do have filters; those still open the grants list.
const TAB_TO_PARAM: Record<ViewTab, string | null> = {
  overview: null,
  table: "grants",
  charts: "analytics",
  map: "map",
  compare: "compare",
  about: "about"
};
const TAB_FROM_PARAM: Record<string, ViewTab> = {
  grants: "table",
  analytics: "charts",
  map: "map",
  compare: "compare",
  about: "about"
};

const DIMENSION_TO_PARAM: Record<CompareDimension, string> = {
  areas: "area",
  disciplines: "discipline",
  years: "year",
  localAuthorities: "la",
  recipientTypes: "type",
  deprivation: "dep"
};
const DIMENSION_FROM_PARAM: Record<string, CompareDimension> = Object.fromEntries(
  Object.entries(DIMENSION_TO_PARAM).map(([d, p]) => [p, d as CompareDimension])
);

const PROFILE_KINDS: readonly ProfileKind[] = ["recipient", "place", "discipline"];

/** Phase 1 parameters, still read so old links work; never written. */
const LEGACY_PARAMS = ["recipient", "activity"] as const;

const MAX_TEXT = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RECIPIENT_TYPES: readonly RecipientType[] = ["organisation", "individual", "unknown"];

const MAX_VALUES = 50;
const many = (params: URLSearchParams, name: string): string[] =>
  Array.from(
    new Set(
      params
        .getAll(name)
        .map((v) => v.trim().slice(0, MAX_TEXT))
        .filter(Boolean)
    )
  ).slice(0, MAX_VALUES);

const optional = (params: URLSearchParams, name: string): string | null => {
  const value = params.get(name)?.trim();
  return value ? value.slice(0, MAX_TEXT) : null;
};
const amount = (params: URLSearchParams, name: string): number | null => {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) && value >= 0 ? value : null;
};
const isoDate = (params: URLSearchParams, name: string): string | null => {
  const value = params.get(name);
  return value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
};
const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export const DEFAULT_BASE_PATH = "";

const TAB_TO_PATH: Record<ViewTab, string | null> = {
  overview: null,
  table: "grants",
  charts: "analytics",
  map: "map",
  compare: "compare",
  about: "about"
};

const PATH_TO_TAB: Record<string, ViewTab> = {
  grants: "table",
  analytics: "charts",
  map: "map",
  compare: "compare",
  about: "about"
};

const KIND_TO_PATH: Record<ProfileKind, string> = {
  recipient: "recipients",
  place: "places",
  discipline: "disciplines"
};

const PATH_TO_KIND: Record<string, ProfileKind> = {
  recipients: "recipient",
  recipient: "recipient",
  places: "place",
  place: "place",
  disciplines: "discipline",
  discipline: "discipline"
};

/** Converts any string into a clean, lowercased, SEO-friendly kebab-case URL slug. */
export const toSlug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Reads state from a pathname and query string. Unknown or invalid values fall back to defaults. */
export const stateFromLocation = (
  pathname = "",
  search = "",
  basePath = DEFAULT_BASE_PATH
): ExplorerState => {
  const base = basePath.replace(/\/+$/, "");
  let subpath = pathname;
  if (subpath.startsWith(base)) {
    subpath = subpath.slice(base.length);
  }
  subpath = subpath.replace(/^\/+/, "").replace(/\/+$/, "");

  const rawSegments = subpath ? subpath.split("/").filter(Boolean) : [];
  const segments = rawSegments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });

  let pathTab: ViewTab | null = null;
  let pathProfile: { kind: ProfileKind; id: string } | null = null;
  let pathGrant: string | null = null;

  if (segments.length > 0) {
    const first = segments[0].toLowerCase();
    if (first === "grants") {
      pathTab = "table";
      if (segments.length >= 2) {
        pathGrant = segments.slice(1).join("/");
      }
    } else if (PATH_TO_TAB[first]) {
      pathTab = PATH_TO_TAB[first];
    } else if (PATH_TO_KIND[first]) {
      const kind = PATH_TO_KIND[first];
      const id = segments[1] ? segments[1].slice(0, MAX_TEXT) : "";
      if (id) {
        pathProfile = { kind, id };
        if (segments.length >= 4 && segments[2].toLowerCase() === "grants") {
          pathGrant = segments.slice(3).join("/");
        }
      }
    }
  }

  const params = new URLSearchParams(search);
  const sortField = SORT_FROM_PARAM[params.get("sort") ?? ""] ?? DEFAULT_STATE.sortField;
  const order = params.get("order");
  const sortOrder: SortOrder = order === "asc" || order === "desc" ? order : DEFAULT_STATE.sortOrder;
  const page = Number.parseInt(params.get("page") ?? "", 10);

  let q = (params.get("q") ?? "").slice(0, MAX_TEXT);
  let searchIn: SearchScope =
    params.get("in") === "recipient" ? "recipient" : params.get("in") === "project" ? "activity" : "all";
  if (!q && params.get("recipient")) {
    q = params.get("recipient")!.slice(0, MAX_TEXT);
    searchIn = "recipient";
  } else if (!q && params.get("activity")) {
    q = params.get("activity")!.slice(0, MAX_TEXT);
    searchIn = "activity";
  }

  // Fallback for profile from query string (?profile=kind:id) if not found in path
  let profile = pathProfile;
  if (!profile) {
    const profileParam = params.get("profile");
    const profileMatch = profileParam ? /^(recipient|place|discipline):(.+)$/.exec(profileParam) : null;
    if (profileMatch && PROFILE_KINDS.includes(profileMatch[1] as ProfileKind)) {
      profile = { kind: profileMatch[1] as ProfileKind, id: profileMatch[2].slice(0, MAX_TEXT) };
    }
  }

  // Fallback for grant from query string (?grant=...) if not found in path
  const grant = pathGrant || optional(params, "grant");

  // Determine tab: path takes precedence; then query param 'view'; then if filters present -> 'table'; else 'overview'
  let tab: ViewTab;
  if (pathTab) {
    tab = pathTab;
  } else if (params.get("view") && TAB_FROM_PARAM[params.get("view")!]) {
    tab = TAB_FROM_PARAM[params.get("view")!];
  } else {
    const hasFilterParams = [...OWN_PARAMS, ...LEGACY_PARAMS].some(
      (name) => name !== "view" && name !== "profile" && name !== "grant" && params.has(name)
    );
    tab = hasFilterParams ? "table" : "overview";
  }

  return {
    q,
    searchIn,
    years: many(params, "year"),
    areas: many(params, "area"),
    localAuthorities: many(params, "la"),
    disciplines: many(params, "discipline"),
    strands: many(params, "strand"),
    priorities: many(params, "priority"),
    recipientTypes: many(params, "type").filter((t): t is RecipientType => RECIPIENT_TYPES.includes(t as RecipientType)),
    placeGroups: many(params, "group"),
    deprivation: many(params, "dep").filter((d) => /^[1-5]$/.test(d)),
    amountOver: amount(params, "over"),
    amountUpTo: amount(params, "upto"),
    dateFrom: isoDate(params, "from"),
    dateTo: isoDate(params, "to"),
    sortField,
    sortOrder,
    page: Number.isFinite(page) && page > 1 ? page : 1,
    tab,
    histogramMetric: params.get("size") === "amount" ? "amount" : "count",
    trendView: params.get("trend") === "yoy" ? "yoy" : "absolute",
    heatmapMode: oneOf<HeatmapMode>(params.get("heat"), ["amount", "row", "column"], "amount"),
    mapMetric: oneOf<MapMetric>(params.get("metric"), ["total", "count", "perCapita"], "total"),
    mapOutline: optional(params, "outline"),
    compareBy: DIMENSION_FROM_PARAM[params.get("by") ?? ""] ?? "areas",
    compareValues: many(params, "c").slice(0, 4),
    grant,
    profile
  };
};

/** Reads state from a query string. Unknown or invalid values fall back to defaults. */
export const stateFromSearch = (search: string): ExplorerState => {
  return stateFromLocation("", search);
};

export interface StateToSearchOptions {
  /** If true, omits view, profile and grant from search query (since they are in the pathname). */
  omitPathState?: boolean;
}

/**
 * Writes state into a query string, keeping any parameters the explorer
 * doesn't own. Returns "" when nothing needs to be in the URL.
 */
export const stateToSearch = (
  state: ExplorerState,
  currentSearch = "",
  options?: StateToSearchOptions
): string => {
  const params = new URLSearchParams(currentSearch);
  for (const name of [...OWN_PARAMS, ...LEGACY_PARAMS]) params.delete(name);

  const omitPath = options?.omitPathState ?? false;
  const isDefaultSort = state.sortField === DEFAULT_STATE.sortField && state.sortOrder === DEFAULT_STATE.sortOrder;
  const q = state.q.trim();
  const num = (n: number | null) => (n === null ? null : String(n));
  const own: Array<[string, string | readonly string[] | null]> = [
    ["q", q || null],
    ["in", q ? SCOPE_TO_PARAM[state.searchIn] : null],
    ["year", state.years],
    ["area", state.areas],
    ["la", state.localAuthorities],
    ["discipline", state.disciplines],
    ["strand", state.strands],
    ["priority", state.priorities],
    ["type", state.recipientTypes],
    ["group", state.placeGroups],
    ["dep", state.deprivation],
    ["over", num(state.amountOver)],
    ["upto", num(state.amountUpTo)],
    ["from", state.dateFrom],
    ["to", state.dateTo],
    ["sort", isDefaultSort ? null : SORT_TO_PARAM[state.sortField]],
    ["order", isDefaultSort ? null : state.sortOrder],
    ["view", omitPath ? null : TAB_TO_PARAM[state.tab]],
    ["size", state.histogramMetric === "amount" ? "amount" : null],
    ["trend", state.trendView === "yoy" ? "yoy" : null],
    ["heat", state.heatmapMode === "amount" ? null : state.heatmapMode],
    ["metric", state.mapMetric === "total" ? null : state.mapMetric],
    ["outline", state.mapOutline],
    ["by", state.compareBy === "areas" ? null : DIMENSION_TO_PARAM[state.compareBy]],
    ["c", state.compareValues],
    ["profile", omitPath || !state.profile ? null : `${state.profile.kind}:${state.profile.id}`],
    ["grant", omitPath ? null : state.grant],
    ["page", state.page > 1 ? String(state.page) : null]
  ];
  for (const [name, value] of own) {
    if (value === null) continue;
    if (typeof value === "string") params.append(name, value);
    else for (const v of value) params.append(name, v);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

/**
 * Returns structured pathname and search string representing current explorer state.
 */
export const stateToLocation = (
  state: ExplorerState,
  currentSearch = "",
  basePath = DEFAULT_BASE_PATH
): { pathname: string; search: string } => {
  const base = basePath.replace(/\/+$/, "");
  let pathname = base || "/";

  if (state.profile) {
    const kindPath = KIND_TO_PATH[state.profile.kind] ?? "recipients";
    const slug = toSlug(state.profile.id);
    pathname = `${base}/${kindPath}/${slug}`;
    if (state.grant) {
      pathname += `/grants/${encodeURIComponent(state.grant)}`;
    }
  } else if (state.grant) {
    pathname = `${base}/grants/${encodeURIComponent(state.grant)}`;
  } else {
    const tabPath = TAB_TO_PATH[state.tab];
    if (tabPath) {
      pathname = `${base}/${tabPath}`;
    } else {
      pathname = base || "/";
    }
  }

  const search = stateToSearch(state, currentSearch, { omitPathState: true });
  return { pathname, search };
};

/**
 * Returns full relative or absolute path + query string for state.
 */
export const stateToUrl = (
  state: ExplorerState,
  currentSearch = "",
  basePath = DEFAULT_BASE_PATH
): string => {
  const { pathname, search } = stateToLocation(state, currentSearch, basePath);
  return `${pathname}${search}`;
};

