// Every figure on the dashboard, computed in a single pass over all grants.
//
// Crossfilter: each chart counts the grants that pass every filter except
// its own. Selecting an area filters everything else but leaves the area
// chart showing all areas (with the selection highlighted), so you can
// still compare and change your mind. Stats, the table and the leaderboard
// use every filter.
//
// Amounts stay in pounds; rounding happens only when formatting for display.

import { DIM, EMPTY_FILTERS, compileFilters } from "./filters";
import type { CompareDimension, FilterState } from "./filters";
import type { PlaceLookup } from "./places";
import { formatFY, isFYInProgress, previousFY, shiftISOYear } from "./fiscal";
import type { Grant } from "./types";

export const UNSPECIFIED = "Unspecified";

export interface NamedAmount {
  name: string;
  amount: number;
  count: number;
}

export interface YearTrendPoint {
  /** Funding year key, e.g. "2026-2027" */
  name: string;
  /** Axis label, e.g. "2026–27 (to date)" */
  label: string;
  amount: number;
  count: number;
  /** Null for the first year shown, or when the previous year has no funding in view. */
  yoy: number | null;
  /** The year is still in progress. */
  partial: boolean;
  /** Latest award date in the dataset for an in-progress year. */
  cutoff: string | null;
}

export interface SizeBracket {
  name: string;
  /** Exclusive lower bound (null: none). Matches ACE's "Above £30,000". */
  over: number | null;
  /** Inclusive upper bound (null: none). Matches ACE's "£30,000 and below". */
  upTo: number | null;
}

export interface HistogramBin extends SizeBracket {
  count: number;
  amount: number;
}

export interface RecipientTotal {
  key: string;
  /** The most common spelling of the recipient's name in view. */
  recipient: string;
  totalAmount: number;
  count: number;
}

export interface Heatmap {
  areas: string[];
  disciplines: string[];
  /** matrix[area][discipline] in pounds */
  matrix: Record<string, Record<string, number>>;
  /** Each discipline's total across all areas. */
  disciplineTotals: Record<string, number>;
  /** Each area's total across all disciplines. */
  areaTotals: Record<string, number>;
}

export interface Stats {
  totalAwarded: number;
  count: number;
  avgAward: number;
  medianAward: number;
  maxAward: number;
  recipientCount: number;
}

export interface Comparison {
  /** e.g. "2023–24" or "the same period of 2025–26" */
  label: string;
  totalAwarded: number;
  count: number;
}

export interface NewVsReturning {
  name: string;
  label: string;
  /** Recipients whose first grant in the dataset was this year. */
  newRecipients: number;
  returningRecipients: number;
  newFunding: number;
  returningFunding: number;
  partial: boolean;
}

export interface Aggregates {
  stats: Stats;
  /** Same filters, previous funding year (like for like if the selected year is in progress). */
  comparison: Comparison | null;
  /** Top 10 disciplines by funding (ignores the discipline filter). */
  byDiscipline: NamedAmount[];
  /** Ignores the area filter. */
  byArea: NamedAmount[];
  /** Ignores the year and date filters. */
  years: YearTrendPoint[];
  /** Ignores the amount filter. */
  histogram: HistogramBin[];
  /** All recipients in view, largest total first. */
  recipients: RecipientTotal[];
  concentration: { top1PctShare: number; top10PctShare: number };
  /** Ignores the area and discipline filters. */
  heatmap: Heatmap;
  /** Funding per local authority (current boundaries); ignores the local authority filter. */
  byLocalAuthority: NamedAmount[];
  /** Ignores the year and date filters. The dataset's first year is left out: everyone is new in it. */
  newVsReturning: NewVsReturning[];
  /** Funding by deprivation fifth of the grant's district (1 = most deprived); ignores the deprivation filter. */
  byDeprivation: Array<{ quintile: number; amount: number; count: number }>;
  /** Funding by designation (a grant can count in several); ignores the designation filter. */
  byPlaceGroup: Array<{ id: string; amount: number; count: number }>;
  /** Funding the designation figures are shares of: every filter except the designation filter. */
  placeGroupTotal: number;
}

export interface AggregateContext {
  /** Areas across the whole dataset, so heatmap columns stay put as filters change. */
  allAreas: readonly string[];
  /** Latest award date per funding year across the whole dataset. */
  fyCutoffs: Readonly<Record<string, string>>;
  /** First funding year of each recipient across the whole dataset. */
  firstYears?: ReadonlyMap<string, string>;
  /** Per-dataset index; built on the fly when not given (pass it to avoid rebuilding per change). */
  index?: DatasetIndex;
  /** Designations and deprivation for places; without it those filters match nothing. */
  places?: PlaceLookup;
  today?: Date;
}

/** First funding year in which each recipient appears. */
export const recipientFirstYears = (rows: readonly Grant[]): Map<string, string> => {
  const first = new Map<string, string>();
  for (const g of rows) {
    const current = first.get(g.recipient_key);
    if (!current || g.funding_year < current) first.set(g.recipient_key, g.funding_year);
  }
  return first;
};

/**
 * Numbers for every category, built once per dataset, so the per-change pass
 * is array arithmetic instead of text-keyed map lookups. Per-row arrays line
 * up with `rows`.
 */
export interface DatasetIndex {
  rows: readonly Grant[];
  recipientKeys: string[];
  /** Most common spelling of each recipient across the whole dataset. */
  recipientNames: string[];
  years: string[];
  /** Index into `years` of each recipient's first funding year. */
  firstYearOf: Int16Array;
  /** Area and discipline names; missing values are "Unspecified". */
  areas: string[];
  disciplines: string[];
  localAuthorities: string[];
  recipientId: Int32Array;
  yearId: Int16Array;
  areaId: Int16Array;
  disciplineId: Int16Array;
  /** -1 when the grant has no local authority. */
  localAuthorityId: Int16Array;
}

const dictionary = () => {
  const ids = new Map<string, number>();
  const names: string[] = [];
  return {
    names,
    id(name: string) {
      let id = ids.get(name);
      if (id === undefined) {
        id = names.length;
        ids.set(name, id);
        names.push(name);
      }
      return id;
    }
  };
};

export const buildDatasetIndex = (rows: readonly Grant[]): DatasetIndex => {
  const recipients = dictionary();
  const areas = dictionary();
  const disciplines = dictionary();
  const las = dictionary();
  const years = Array.from(new Set(rows.map((g) => g.funding_year))).sort();
  const yearIds = new Map(years.map((y, i) => [y, i]));
  const spellings: Array<Map<string, number>> = [];
  const first: number[] = [];
  const recipientId = new Int32Array(rows.length);
  const yearId = new Int16Array(rows.length);
  const areaId = new Int16Array(rows.length);
  const disciplineId = new Int16Array(rows.length);
  const localAuthorityId = new Int16Array(rows.length);

  rows.forEach((g, i) => {
    const rid = recipients.id(g.recipient_key);
    if (rid === spellings.length) {
      spellings.push(new Map());
      first.push(Number.MAX_SAFE_INTEGER);
    }
    spellings[rid].set(g.recipient, (spellings[rid].get(g.recipient) ?? 0) + 1);
    const y = yearIds.get(g.funding_year)!;
    if (y < first[rid]) first[rid] = y;
    recipientId[i] = rid;
    yearId[i] = y;
    areaId[i] = areas.id(g.ace_area || UNSPECIFIED);
    disciplineId[i] = disciplines.id(g.main_discipline || UNSPECIFIED);
    localAuthorityId[i] = g.local_authority_current ? las.id(g.local_authority_current) : -1;
  });

  const recipientNames = spellings.map((names) => {
    let best = "";
    let uses = -1;
    names.forEach((n, spelling) => {
      if (n > uses || (n === uses && spelling < best)) {
        uses = n;
        best = spelling;
      }
    });
    return best;
  });

  return {
    rows,
    recipientKeys: recipients.names,
    recipientNames,
    years,
    firstYearOf: Int16Array.from(first),
    areas: areas.names,
    disciplines: disciplines.names,
    localAuthorities: las.names,
    recipientId,
    yearId,
    areaId,
    disciplineId,
    localAuthorityId
  };
};

/** Aligned with ACE's strand thresholds (£15,000, £30,000) and the £100,000 standard maximum. */
export const SIZE_BRACKETS: readonly SizeBracket[] = [
  { name: "Up to £15k", over: null, upTo: 15000 },
  { name: "£15k–£30k", over: 15000, upTo: 30000 },
  { name: "£30k–£100k", over: 30000, upTo: 100000 },
  { name: "Over £100k", over: 100000, upTo: null }
];

export const inBracket = (amount: number, b: SizeBracket): boolean =>
  (b.over === null || amount > b.over) && (b.upTo === null || amount <= b.upTo);

const HEATMAP_DISCIPLINES = 6;
const FALLBACK_AREAS = ["London", "Midlands", "North", "South East", "South West"];

type Tally = Map<string, { amount: number; count: number }>;

const tally = (map: Tally, key: string, amount: number) => {
  const entry = map.get(key);
  if (entry) {
    entry.amount += amount;
    entry.count += 1;
  } else {
    map.set(key, { amount, count: 1 });
  }
};

const sortedTally = (map: Tally): NamedAmount[] =>
  Array.from(map, ([name, t]) => ({ name, amount: t.amount, count: t.count })).sort((a, b) => b.amount - a.amount);

/** Latest award date per funding year. */
export const fundingYearCutoffs = (rows: readonly Grant[]): Record<string, string> => {
  const cutoffs: Record<string, string> = {};
  for (const row of rows) {
    const current = cutoffs[row.funding_year];
    if (row.award_date && (!current || row.award_date > current)) cutoffs[row.funding_year] = row.award_date;
  }
  return cutoffs;
};

/**
 * Year-on-year change compares with the previous financial year by name, so
 * a gap never produces a two-year comparison. An in-progress year compares
 * like for like: awards up to the dataset's latest date in that year against
 * the same period a year earlier (`comparableBase`).
 */
export const yearTrendFromTotals = (
  totals: Tally,
  comparableBase: ReadonlyMap<string, number>,
  fyCutoffs: Readonly<Record<string, string>>,
  today: Date
): YearTrendPoint[] =>
  Array.from(totals.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((fy) => {
      const { amount, count } = totals.get(fy)!;
      const partial = isFYInProgress(fy, today);
      const cutoff = partial ? fyCutoffs[fy] ?? null : null;
      const prev = previousFY(fy);

      let base: number | null = null;
      if (prev && totals.has(prev)) {
        if (!partial) base = totals.get(prev)!.amount;
        else if (cutoff) base = comparableBase.get(fy) ?? 0;
      }

      return {
        name: fy,
        label: partial ? `${formatFY(fy)} (to date)` : formatFY(fy),
        amount,
        count,
        yoy: base !== null && base > 0 ? Math.round(((amount - base) / base) * 100) : null,
        partial,
        cutoff
      };
    });

const median = (values: Float64Array, n: number): number => {
  if (n === 0) return 0;
  const sorted = values.subarray(0, n).sort();
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const fromArrays = (names: readonly string[], amounts: Float64Array, counts: Uint32Array): NamedAmount[] => {
  const out: NamedAmount[] = [];
  for (let i = 0; i < names.length; i += 1) if (counts[i] > 0) out.push({ name: names[i], amount: amounts[i], count: counts[i] });
  return out.sort((a, b) => b.amount - a.amount);
};

export const crossfilter = (
  all: readonly Grant[],
  filters: FilterState,
  context: AggregateContext
): Aggregates => {
  const today = context.today ?? new Date();
  const maskOf = compileFilters(filters, context.places);
  // The index must describe exactly these rows (same array); otherwise build one.
  const index = context.index && context.index.rows === all ? context.index : buildDatasetIndex(all);
  const { recipientId, yearId, areaId, disciplineId, localAuthorityId, firstYearOf } = index;
  const nYears = index.years.length;
  const nAreas = index.areas.length;
  const nDisciplines = index.disciplines.length;
  const nRecipients = index.recipientKeys.length;
  const nLas = index.localAuthorities.length;

  // For each in-progress year, the previous year's awards up to the same date (trend YoY).
  const windowUntil: Array<string | null> = new Array(nYears).fill(null);
  const windowFor = new Int16Array(nYears).fill(-1);
  for (const [fy, cutoff] of Object.entries(context.fyCutoffs)) {
    const prev = previousFY(fy);
    const y = index.years.indexOf(fy);
    const p = prev ? index.years.indexOf(prev) : -1;
    if (p >= 0 && y >= 0 && isFYInProgress(fy, today)) {
      windowUntil[p] = shiftISOYear(cutoff, -1);
      windowFor[p] = y;
    }
  }

  // Stat comparison: same filters, previous year (only when exactly one year is selected).
  const selectedYear = filters.years.length === 1 ? filters.years[0] : null;
  const compareYear = selectedYear ? previousFY(selectedYear) : null;
  const compareYearId = compareYear ? index.years.indexOf(compareYear) : -1;
  const selectedPartial = selectedYear ? isFYInProgress(selectedYear, today) : false;
  const compareUntil =
    selectedPartial && selectedYear && context.fyCutoffs[selectedYear] ? shiftISOYear(context.fyCutoffs[selectedYear], -1) : null;

  const heatAreas = context.allAreas.length > 0 ? [...context.allAreas] : FALLBACK_AREAS;
  const inHeatmap = new Uint8Array(nAreas);
  heatAreas.forEach((a) => {
    const id = index.areas.indexOf(a);
    if (id >= 0) inHeatmap[id] = 1;
  });

  // Accumulators
  let totalAwarded = 0;
  let maxAward = 0;
  let count = 0;
  const amounts = new Float64Array(all.length);
  let compareTotal = 0;
  let compareCount = 0;
  const disciplineAmount = new Float64Array(nDisciplines);
  const disciplineCount = new Uint32Array(nDisciplines);
  const areaAmount = new Float64Array(nAreas);
  const areaCount = new Uint32Array(nAreas);
  const yearAmount = new Float64Array(nYears);
  const yearCount = new Uint32Array(nYears);
  const comparableBase = new Float64Array(nYears);
  const laAmount = new Float64Array(nLas);
  const laCount = new Uint32Array(nLas);
  const cellAmount = new Float64Array(nDisciplines * nAreas);
  const heatDisciplineAmount = new Float64Array(nDisciplines);
  const heatAreaAmount = new Float64Array(nAreas);
  const bins = SIZE_BRACKETS.map((b) => ({ ...b, count: 0, amount: 0 }));
  const recipientTotal = new Float64Array(nRecipients);
  const recipientCount = new Uint32Array(nRecipients);
  const recipientsInView: number[] = [];
  // New vs returning: one byte per (recipient, year) marks "already counted".
  const seenInYear = new Uint8Array(nRecipients * nYears);
  const newRecipients = new Uint32Array(nYears);
  const returningRecipients = new Uint32Array(nYears);
  const newFunding = new Float64Array(nYears);
  const returningFunding = new Float64Array(nYears);

  const NOT_DISCIPLINE = ~DIM.disciplines;
  const NOT_AREA = ~DIM.areas;
  const NOT_TIME = ~(DIM.years | DIM.dates);
  const NOT_AMOUNT = ~DIM.amount;
  const NOT_CELL = ~(DIM.areas | DIM.disciplines);
  const NOT_YEAR = ~DIM.years;
  const NOT_LA = ~DIM.localAuthorities;
  const NOT_DEPRIVATION = ~DIM.deprivation;
  const NOT_GROUPS = ~DIM.placeGroups;

  // Each district's deprivation fifth and designations, once per pass (index -1 = no district).
  const quintileOfLa = new Int8Array(nLas + 1);
  const groupIds = new Map<string, number>();
  const groupsOfLa: number[][] = [];
  for (let la = -1; la < nLas; la += 1) {
    const name = la >= 0 ? index.localAuthorities[la] : null;
    quintileOfLa[la + 1] = context.places?.quintileOf(name) ?? 0;
    groupsOfLa[la + 1] = (context.places?.groupsOf(name) ?? []).map((id) => {
      if (!groupIds.has(id)) groupIds.set(id, groupIds.size);
      return groupIds.get(id)!;
    });
  }
  const quintileAmount = new Float64Array(6);
  const quintileCount = new Uint32Array(6);
  const groupAmount = new Float64Array(groupIds.size);
  let placeGroupTotal = 0;
  const groupCount = new Uint32Array(groupIds.size);

  for (let i = 0; i < all.length; i += 1) {
    const row = all[i];
    const mask = maskOf(row);
    const amount = row.award_amount;
    const rid = recipientId[i];
    const y = yearId[i];
    const a = areaId[i];
    const d = disciplineId[i];

    if (mask === 0) {
      totalAwarded += amount;
      if (amount > maxAward) maxAward = amount;
      amounts[count] = amount;
      count += 1;
      if (recipientCount[rid] === 0) recipientsInView.push(rid);
      recipientTotal[rid] += amount;
      recipientCount[rid] += 1;
    }

    if ((mask & NOT_DISCIPLINE) === 0) {
      disciplineAmount[d] += amount;
      disciplineCount[d] += 1;
    }
    if ((mask & NOT_AREA) === 0) {
      areaAmount[a] += amount;
      areaCount[a] += 1;
    }
    if ((mask & NOT_LA) === 0) {
      const la = localAuthorityId[i];
      if (la >= 0) {
        laAmount[la] += amount;
        laCount[la] += 1;
      }
    }
    if ((mask & NOT_DEPRIVATION) === 0) {
      const q = quintileOfLa[localAuthorityId[i] + 1];
      if (q > 0) {
        quintileAmount[q] += amount;
        quintileCount[q] += 1;
      }
    }
    if ((mask & NOT_GROUPS) === 0) {
      placeGroupTotal += amount;
      for (const gid of groupsOfLa[localAuthorityId[i] + 1]) {
        groupAmount[gid] += amount;
        groupCount[gid] += 1;
      }
    }

    if ((mask & NOT_TIME) === 0) {
      yearAmount[y] += amount;
      yearCount[y] += 1;
      if (windowFor[y] >= 0 && row.award_date <= windowUntil[y]!) comparableBase[windowFor[y]] += amount;
      const isNew = firstYearOf[rid] === y;
      if (isNew) newFunding[y] += amount;
      else returningFunding[y] += amount;
      const bit = rid * nYears + y;
      if (seenInYear[bit] === 0) {
        seenInYear[bit] = 1;
        if (isNew) newRecipients[y] += 1;
        else returningRecipients[y] += 1;
      }
    }

    if ((mask & NOT_AMOUNT) === 0) {
      for (const bin of bins) {
        if (inBracket(amount, bin)) {
          bin.count += 1;
          bin.amount += amount;
          break;
        }
      }
    }

    if ((mask & NOT_CELL) === 0 && inHeatmap[a]) {
      cellAmount[d * nAreas + a] += amount;
      heatDisciplineAmount[d] += amount;
      heatAreaAmount[a] += amount;
    }

    if (y === compareYearId && (mask & NOT_YEAR) === 0 && (compareUntil === null || row.award_date <= compareUntil)) {
      compareTotal += amount;
      compareCount += 1;
    }
  }

  const recipients: RecipientTotal[] = recipientsInView
    .map((r) => ({ key: index.recipientKeys[r], recipient: index.recipientNames[r], totalAmount: recipientTotal[r], count: recipientCount[r] }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const shareOfTop = (fraction: number): number => {
    if (recipients.length === 0 || totalAwarded <= 0) return 0;
    const n = Math.max(1, Math.round(recipients.length * fraction));
    const sum = recipients.slice(0, n).reduce((s, r) => s + r.totalAmount, 0);
    return Math.round((sum / totalAwarded) * 100);
  };

  // Heatmap rows: the six disciplines with most funding in the heatmap's own view.
  const heatmapDisciplineIds = Array.from({ length: nDisciplines }, (_, id) => id)
    .filter((id) => heatDisciplineAmount[id] > 0)
    .sort((x, z) => heatDisciplineAmount[z] - heatDisciplineAmount[x])
    .slice(0, HEATMAP_DISCIPLINES);
  const matrix: Heatmap["matrix"] = {};
  for (const area of heatAreas) {
    const aid = index.areas.indexOf(area);
    matrix[area] = {};
    for (const did of heatmapDisciplineIds) matrix[area][index.disciplines[did]] = aid >= 0 ? cellAmount[did * nAreas + aid] : 0;
  }

  const yearTotals: Tally = new Map();
  index.years.forEach((fy, yid) => {
    if (yearCount[yid] > 0) yearTotals.set(fy, { amount: yearAmount[yid], count: yearCount[yid] });
  });
  const comparableByYear = new Map<string, number>();
  index.years.forEach((fy, yid) => {
    if (comparableBase[yid] > 0) comparableByYear.set(fy, comparableBase[yid]);
  });

  const datasetFirstYear = Object.keys(context.fyCutoffs).sort()[0] ?? null;

  return {
    stats: {
      totalAwarded,
      count,
      avgAward: count > 0 ? Math.round(totalAwarded / count) : 0,
      medianAward: median(amounts, count),
      maxAward,
      recipientCount: recipientsInView.length
    },
    comparison:
      compareYear !== null && compareYear in context.fyCutoffs
        ? {
            label: compareUntil ? `the same period of ${formatFY(compareYear)}` : formatFY(compareYear),
            totalAwarded: compareTotal,
            count: compareCount
          }
        : null,
    byDiscipline: fromArrays(index.disciplines, disciplineAmount, disciplineCount).slice(0, 10),
    byArea: fromArrays(index.areas, areaAmount, areaCount),
    years: yearTrendFromTotals(yearTotals, comparableByYear, context.fyCutoffs, today),
    histogram: bins,
    recipients,
    concentration: { top1PctShare: shareOfTop(0.01), top10PctShare: shareOfTop(0.1) },
    heatmap: {
      areas: heatAreas,
      disciplines: heatmapDisciplineIds.map((id) => index.disciplines[id]),
      matrix,
      disciplineTotals: Object.fromEntries(
        Array.from({ length: nDisciplines }, (_, id) => id)
          .filter((id) => heatDisciplineAmount[id] > 0)
          .map((id) => [index.disciplines[id], heatDisciplineAmount[id]])
      ),
      areaTotals: Object.fromEntries(heatAreas.map((area) => [area, index.areas.includes(area) ? heatAreaAmount[index.areas.indexOf(area)] : 0]))
    },
    byLocalAuthority: fromArrays(index.localAuthorities, laAmount, laCount),
    byDeprivation: context.places && quintileOfLa.some((q) => q > 0)
      ? [1, 2, 3, 4, 5].map((q) => ({ quintile: q, amount: quintileAmount[q], count: quintileCount[q] }))
      : [],
    byPlaceGroup: Array.from(groupIds, ([id, gid]) => ({ id, amount: groupAmount[gid], count: groupCount[gid] })),
    placeGroupTotal,
    newVsReturning: index.years
      .map((fy, yid) => ({ fy, yid }))
      .filter(({ fy, yid }) => fy !== datasetFirstYear && yearCount[yid] > 0)
      .map(({ fy, yid }) => {
        const partial = isFYInProgress(fy, today);
        return {
          name: fy,
          label: partial ? `${formatFY(fy)} (to date)` : formatFY(fy),
          newRecipients: newRecipients[yid],
          returningRecipients: returningRecipients[yid],
          newFunding: newFunding[yid],
          returningFunding: returningFunding[yid],
          partial
        };
      })
  };
};

// ---------------------------------------------------------------------------
// Summaries of any set of grants (profiles, comparison segments)
// ---------------------------------------------------------------------------

export interface GrantSummary {
  stats: Stats;
  firstYear: string | null;
  lastYear: string | null;
  /** Funding per financial year, oldest first. */
  byYear: NamedAmount[];
  byDiscipline: NamedAmount[];
  byArea: NamedAmount[];
  byLocalAuthority: NamedAmount[];
  byStrand: NamedAmount[];
  recipients: RecipientTotal[];
  /** Recipients whose first grant in the whole dataset falls in this set. */
  newRecipients: number;
}

export const summariseGrants = (rows: readonly Grant[], firstYears?: ReadonlyMap<string, string>): GrantSummary => {
  const amounts = new Float64Array(rows.length);
  let total = 0;
  let max = 0;
  const years: Tally = new Map();
  const disciplines: Tally = new Map();
  const areas: Tally = new Map();
  const las: Tally = new Map();
  const strands: Tally = new Map();
  const recipients = new Map<string, { total: number; count: number; names: Map<string, number>; isNew: boolean }>();

  rows.forEach((g, i) => {
    amounts[i] = g.award_amount;
    total += g.award_amount;
    if (g.award_amount > max) max = g.award_amount;
    tally(years, g.funding_year, g.award_amount);
    tally(disciplines, g.main_discipline || UNSPECIFIED, g.award_amount);
    tally(areas, g.ace_area || UNSPECIFIED, g.award_amount);
    if (g.local_authority_current) tally(las, g.local_authority_current, g.award_amount);
    tally(strands, g.strand || UNSPECIFIED, g.award_amount);
    let r = recipients.get(g.recipient_key);
    if (!r) {
      r = { total: 0, count: 0, names: new Map(), isNew: false };
      recipients.set(g.recipient_key, r);
    }
    r.total += g.award_amount;
    r.count += 1;
    r.names.set(g.recipient, (r.names.get(g.recipient) ?? 0) + 1);
    if (firstYears?.get(g.recipient_key) === g.funding_year) r.isNew = true;
  });

  const yearNames = Array.from(years.keys()).sort();
  let newRecipients = 0;
  recipients.forEach((r) => {
    if (r.isNew) newRecipients += 1;
  });

  return {
    stats: {
      totalAwarded: total,
      count: rows.length,
      avgAward: rows.length ? Math.round(total / rows.length) : 0,
      medianAward: median(amounts, rows.length),
      maxAward: max,
      recipientCount: recipients.size
    },
    firstYear: yearNames[0] ?? null,
    lastYear: yearNames[yearNames.length - 1] ?? null,
    byYear: yearNames.map((name) => ({ name, amount: years.get(name)!.amount, count: years.get(name)!.count })),
    byDiscipline: sortedTally(disciplines),
    byArea: sortedTally(areas),
    byLocalAuthority: sortedTally(las),
    byStrand: sortedTally(strands),
    recipients: Array.from(recipients, ([key, r]) => ({
      key,
      recipient: Array.from(r.names).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      totalAmount: r.total,
      count: r.count
    })).sort((a, b) => b.totalAmount - a.totalAmount),
    newRecipients
  };
};

const DIMENSION_VALUE: Record<CompareDimension, (g: Grant, places?: PlaceLookup) => string | null> = {
  areas: (g) => g.ace_area,
  disciplines: (g) => g.main_discipline,
  years: (g) => g.funding_year,
  localAuthorities: (g) => g.local_authority_current,
  recipientTypes: (g) => g.recipient_type,
  deprivation: (g, places) => {
    const q = places?.quintileOf(g.local_authority_current) ?? null;
    return q === null ? null : String(q);
  }
};

const DIMENSION_BIT: Record<CompareDimension, number> = {
  areas: DIM.areas,
  disciplines: DIM.disciplines,
  years: DIM.years,
  localAuthorities: DIM.localAuthorities,
  recipientTypes: DIM.recipientTypes,
  deprivation: DIM.deprivation
};

export interface CompareSegment {
  value: string;
  summary: GrantSummary;
}

/**
 * Side-by-side segments: grants passing every filter except the compared
 * dimension's own, split by that dimension's values.
 */
export const compareSegments = (
  all: readonly Grant[],
  filters: FilterState,
  by: CompareDimension,
  values: readonly string[],
  firstYears?: ReadonlyMap<string, string>,
  places?: PlaceLookup
): CompareSegment[] => {
  const maskOf = compileFilters(filters, places);
  const ignore = ~DIMENSION_BIT[by];
  const valueOf = DIMENSION_VALUE[by];
  const groups = new Map<string, Grant[]>(values.map((v) => [v, []]));
  for (const g of all) {
    const v = valueOf(g, places);
    if (v !== null && groups.has(v) && (maskOf(g) & ignore) === 0) groups.get(v)!.push(g);
  }
  return values.map((value) => ({ value, summary: summariseGrants(groups.get(value)!, firstYears) }));
};

/** The largest values of a dimension among grants in view (ignoring that dimension's filter). */
export const topValues = (
  all: readonly Grant[],
  filters: FilterState,
  by: CompareDimension,
  n: number,
  places?: PlaceLookup
): string[] => {
  const maskOf = compileFilters(filters, places);
  const ignore = ~DIMENSION_BIT[by];
  const valueOf = DIMENSION_VALUE[by];
  const totals = new Map<string, number>();
  for (const g of all) {
    const v = valueOf(g, places);
    if (v !== null && (maskOf(g) & ignore) === 0) totals.set(v, (totals.get(v) ?? 0) + g.award_amount);
  }
  return Array.from(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
};

/** Aggregates with no filters applied (every chart sees every grant given). */
export const aggregateGrants = (rows: readonly Grant[], context: AggregateContext): Aggregates =>
  crossfilter(rows, EMPTY_FILTERS, context);

/** Year trend on its own (convenience wrapper). */
export const buildYearTrend = (
  rows: readonly Grant[],
  fyCutoffs: Readonly<Record<string, string>>,
  today: Date = new Date()
): YearTrendPoint[] => aggregateGrants(rows, { allAreas: [], fyCutoffs, today }).years;
