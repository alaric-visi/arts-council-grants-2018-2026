// Populations and per-person figures for places.
//
// Districts are joined to ONS population estimates by code (from the
// pipeline's lookup), falling back to a name match. ACE areas aren't an ONS
// geography, so an area's population is the sum of the districts whose
// grants are mostly recorded in that area.

import { localAuthorityKey } from "./local-authorities";
import type { DeprivationData, DesignationData, Grant, PopulationData } from "./types";

/** Filter value for local authorities in none of the designations. */
export const OUTSIDE_DESIGNATIONS = "outside";

export const QUINTILE_LABELS: Record<string, string> = {
  "1": "Most deprived fifth",
  "2": "Second most deprived fifth",
  "3": "Middle fifth",
  "4": "Second least deprived fifth",
  "5": "Least deprived fifth"
};

/** What the filters need to know about places. */
export interface PlaceLookup {
  /** Designation ids of a local authority, or ["outside"] when in none. Empty when there are no designations. */
  groupsOf: (localAuthority: string | null) => readonly string[];
  /** 1 (most deprived fifth) to 5, or null. */
  quintileOf: (localAuthority: string | null) => number | null;
}

export interface PlaceIndex extends PlaceLookup {
  /** False when the dataset was built without population estimates. */
  hasPopulations: boolean;
  populationYear: string | null;
  /** Population of a local authority (current boundaries), or null. */
  population: (localAuthority: string) => number | null;
  /** ONS code of a local authority, or null. */
  code: (localAuthority: string) => string | null;
  /** The ACE area most of a local authority's grants are recorded in. */
  areaOf: (localAuthority: string) => string | null;
  /** Summed population of the districts assigned to an ACE area, or null. */
  areaPopulation: (area: string) => number | null;
  deprivation: DeprivationData | null;
  designations: DesignationData[];
  deprivationOf: (localAuthority: string | null) => { rank: number; quintile: number } | null;
  /** Population of all districts in a deprivation fifth, or null without populations. */
  quintilePopulation: (quintile: number) => number | null;
  /** Population of a designation's districts (or of those outside every designation), or null. */
  groupPopulation: (id: string) => number | null;
  /** "Levelling Up for Culture Places (2022–26)" */
  groupLabel: (id: string) => string;
  /** Population of every district with a figure, or null. */
  totalPopulation: number | null;
}

export const buildPlaceIndex = (
  grants: readonly Grant[],
  populations?: PopulationData,
  deprivation?: DeprivationData,
  designations: readonly DesignationData[] = []
): PlaceIndex => {
  const codes = new Map<string, string>();
  const areaCounts = new Map<string, Map<string, number>>();
  for (const g of grants) {
    const la = g.local_authority_current;
    if (!la) continue;
    if (g.la_code && !codes.has(la)) codes.set(la, g.la_code);
    if (g.ace_area) {
      const counts = areaCounts.get(la) ?? new Map<string, number>();
      counts.set(g.ace_area, (counts.get(g.ace_area) ?? 0) + 1);
      areaCounts.set(la, counts);
    }
  }

  const byCode = populations?.byCode ?? {};
  const codeByKey = new Map(Object.entries(byCode).map(([code, p]) => [localAuthorityKey(p.name), code]));
  const code = (la: string) => codes.get(la) ?? codeByKey.get(localAuthorityKey(la)) ?? null;
  const population = (la: string) => {
    const c = code(la);
    return c && byCode[c] ? byCode[c].population : null;
  };

  const areaOfPlace = new Map<string, string>();
  for (const [la, counts] of areaCounts) {
    const [area] = Array.from(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    areaOfPlace.set(la, area);
  }
  const areaPop = new Map<string, number>();
  for (const [la, area] of areaOfPlace) {
    const p = population(la);
    if (p !== null) areaPop.set(area, (areaPop.get(area) ?? 0) + p);
  }

  // Designations, matched by ONS code where known and by name otherwise.
  const groupsByCode = new Map<string, string[]>();
  const groupsByKey = new Map<string, string[]>();
  for (const d of designations) {
    for (const c of d.codes) groupsByCode.set(c, [...(groupsByCode.get(c) ?? []), d.id]);
    for (const name of d.places) {
      const key = localAuthorityKey(name);
      groupsByKey.set(key, [...(groupsByKey.get(key) ?? []), d.id]);
    }
  }
  const groupCache = new Map<string, readonly string[]>();
  const groupsOf = (la: string | null): readonly string[] => {
    if (designations.length === 0) return [];
    if (!la) return [OUTSIDE_DESIGNATIONS];
    let groups = groupCache.get(la);
    if (!groups) {
      const c = code(la);
      const found = new Set([...(c ? groupsByCode.get(c) ?? [] : []), ...(groupsByKey.get(localAuthorityKey(la)) ?? [])]);
      groups = found.size > 0 ? Array.from(found) : [OUTSIDE_DESIGNATIONS];
      groupCache.set(la, groups);
    }
    return groups;
  };

  const deprivationOf = (la: string | null) => {
    if (!la || !deprivation) return null;
    const c = code(la);
    return c ? deprivation.byCode[c] ?? null : null;
  };

  const sumPopulation = (codes: Iterable<string>) => {
    let total = 0;
    let any = false;
    for (const c of codes) {
      if (byCode[c]) {
        total += byCode[c].population;
        any = true;
      }
    }
    return any ? total : null;
  };
  const designatedCodes = new Set(designations.flatMap((d) => d.codes));

  return {
    groupsOf,
    quintileOf: (la) => deprivationOf(la)?.quintile ?? null,
    deprivation: deprivation ?? null,
    designations: [...designations],
    deprivationOf,
    quintilePopulation: (q) =>
      deprivation ? sumPopulation(Object.entries(deprivation.byCode).filter(([, d]) => d.quintile === q).map(([c]) => c)) : null,
    groupPopulation: (id) =>
      id === OUTSIDE_DESIGNATIONS
        ? sumPopulation(Object.keys(byCode).filter((c) => !designatedCodes.has(c)))
        : sumPopulation(designations.find((d) => d.id === id)?.codes ?? []),
    groupLabel: (id) => {
      if (id === OUTSIDE_DESIGNATIONS) return "Outside these designations";
      const d = designations.find((x) => x.id === id);
      return d ? `${d.name}${d.period ? ` (${d.period})` : ""}` : id;
    },
    totalPopulation: sumPopulation(Object.keys(byCode)),
    hasPopulations: Object.keys(byCode).length > 0,
    populationYear: populations?.year ?? null,
    population,
    code,
    areaOf: (la) => areaOfPlace.get(la) ?? null,
    areaPopulation: (area) => areaPop.get(area) ?? null
  };
};

/** Pounds per resident, or null without a population. */
export const perPerson = (amount: number, population: number | null): number | null =>
  population && population > 0 ? amount / population : null;

const pence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Axis label for per-resident values: exact enough not to misstate a tick
 * (2.5p is "£0.025", not "£0.03"), without trailing zeros.
 */
export const formatPerPersonTick = (value: number): string =>
  value >= 10 ? `£${Math.round(value)}` : `£${value.toFixed(3).replace(/\.?0+$/, "")}`;

/** "£1.23 per person" style figure. */
export const formatPerPerson = (value: number | null): string => (value === null ? "—" : pence.format(value));
