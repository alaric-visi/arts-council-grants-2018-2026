// Compact dataset format (version 1).
//
// Columnar JSON: repeated text (areas, disciplines, local authorities,
// recipients, years, source files) is stored once in a dictionary and rows
// refer to it by index (-1 for empty). Dates are stored as day offsets.
// decision_month and decision_quarter are dropped because they follow from
// the award date; the pipeline checks that they do before encoding.
//
// The encoder (used by the pipeline) and decoder (used in the browser) live
// together so a round-trip test covers both.

import { dayToISO, fyQuarterOfISODate, isoToDay, monthOfISODate } from "./fiscal";
import { assignGrantIds } from "./ids";
import type { DatasetMeta, Grant, RecipientType } from "./types";

export const COMPACT_FORMAT = "ace-grants-compact";
export const COMPACT_VERSION = 1;

type Column = number[];

export interface CompactDataset {
  format: typeof COMPACT_FORMAT;
  version: number;
  meta: DatasetMeta;
  dicts: {
    /** Distinct recipient spellings. */
    recipient: string[];
    /** For each spelling, the index of its recipient group. */
    recipient_group: Column;
    group_key: string[];
    /** One character per group: o(rganisation), i(ndividual), u(nknown). */
    group_type: string;
    ace_area: string[];
    local_authority: string[];
    /** For each local_authority entry, the index of its current authority in la_current. */
    local_authority_current: Column;
    la_current: string[];
    /** ONS code for each la_current entry, or null. */
    la_code: Array<string | null>;
    main_discipline: string[];
    strand: string[];
    time_limited_priority: string[];
    funding_year: string[];
    source_file: string[];
  };
  columns: {
    recipient: Column;
    activity_name: string[];
    award_amount: Column;
    /** First value is days since 1970-01-01; each later value is the difference from the previous row. */
    award_day_delta: Column;
    ace_area: Column;
    local_authority: Column;
    main_discipline: Column;
    strand: Column;
    time_limited_priority: Column;
    funding_year: Column;
    source_file: Column;
  };
}

const TYPE_CODE: Record<RecipientType, string> = { organisation: "o", individual: "i", unknown: "u" };
const TYPE_FROM_CODE: Record<string, RecipientType> = { o: "organisation", i: "individual", u: "unknown" };

class Dictionary {
  readonly values: string[] = [];
  private readonly index = new Map<string, number>();

  add(value: string | null | undefined): number {
    if (value === null || value === undefined || value === "") return -1;
    let i = this.index.get(value);
    if (i === undefined) {
      i = this.values.length;
      this.values.push(value);
      this.index.set(value, i);
    }
    return i;
  }
}

/** Encodes cleaned grants. Row order is preserved, so sort before encoding for stable output. */
export const encodeCompact = (grants: readonly Grant[], meta: DatasetMeta): CompactDataset => {
  const recipients = new Dictionary();
  const groups = new Dictionary();
  const recipientGroup: number[] = [];
  const groupType: string[] = [];
  const areas = new Dictionary();
  const localAuthorities = new Dictionary();
  const laCurrentIndex: number[] = [];
  const laCurrent = new Dictionary();
  const laCode: Array<string | null> = [];
  const disciplines = new Dictionary();
  const strands = new Dictionary();
  const priorities = new Dictionary();
  const years = new Dictionary();
  const sources = new Dictionary();

  const columns: CompactDataset["columns"] = {
    recipient: [],
    activity_name: [],
    award_amount: [],
    award_day_delta: [],
    ace_area: [],
    local_authority: [],
    main_discipline: [],
    strand: [],
    time_limited_priority: [],
    funding_year: [],
    source_file: []
  };

  let previousDay = 0;
  grants.forEach((grant, row) => {
    const r = recipients.add(grant.recipient);
    if (r === recipientGroup.length) {
      const g = groups.add(grant.recipient_key);
      recipientGroup.push(g);
      if (g === groupType.length) groupType.push(TYPE_CODE[grant.recipient_type]);
    }

    const la = localAuthorities.add(grant.local_authority);
    if (la !== -1 && la === laCurrentIndex.length) {
      const current = laCurrent.add(grant.local_authority_current ?? grant.local_authority);
      laCurrentIndex.push(current);
      if (current === laCode.length) laCode.push(grant.la_code ?? null);
    }

    const day = isoToDay(grant.award_date);
    if (!Number.isFinite(day)) throw new Error(`Row ${row}: invalid award_date "${grant.award_date}"`);

    columns.recipient.push(r);
    columns.activity_name.push(grant.activity_name);
    columns.award_amount.push(grant.award_amount);
    columns.award_day_delta.push(row === 0 ? day : day - previousDay);
    columns.ace_area.push(areas.add(grant.ace_area));
    columns.local_authority.push(la);
    columns.main_discipline.push(disciplines.add(grant.main_discipline));
    columns.strand.push(strands.add(grant.strand));
    columns.time_limited_priority.push(priorities.add(grant.time_limited_priority));
    columns.funding_year.push(years.add(grant.funding_year));
    columns.source_file.push(sources.add(grant.source_file));
    previousDay = day;
  });

  return {
    format: COMPACT_FORMAT,
    version: COMPACT_VERSION,
    meta,
    dicts: {
      recipient: recipients.values,
      recipient_group: recipientGroup,
      group_key: groups.values,
      group_type: groupType.join(""),
      ace_area: areas.values,
      local_authority: localAuthorities.values,
      local_authority_current: laCurrentIndex,
      la_current: laCurrent.values,
      la_code: laCode,
      main_discipline: disciplines.values,
      strand: strands.values,
      time_limited_priority: priorities.values,
      funding_year: years.values,
      source_file: sources.values
    },
    columns
  };
};

export const isCompactDataset = (value: unknown): value is CompactDataset =>
  Boolean(value) && typeof value === "object" && (value as { format?: unknown }).format === COMPACT_FORMAT;

const pick = (dict: readonly string[], index: number): string | null => (index >= 0 ? dict[index] ?? null : null);

/** Decodes a compact dataset into grants. Throws a descriptive error if the file is malformed. */
export const decodeCompact = (data: CompactDataset): { grants: Grant[]; meta: DatasetMeta } => {
  if (data.version !== COMPACT_VERSION) {
    throw new Error(
      `Dataset format version ${data.version} isn't supported by this build (expected ${COMPACT_VERSION}). Rebuild the dataset or update the explorer.`
    );
  }
  const { dicts, columns } = data;
  const rows = columns.recipient.length;
  for (const [name, column] of Object.entries(columns)) {
    if (column.length !== rows) {
      throw new Error(`Dataset column "${name}" has ${column.length} rows; expected ${rows}.`);
    }
  }

  const grants: Grant[] = new Array(rows);
  let day = 0;
  for (let i = 0; i < rows; i += 1) {
    day = i === 0 ? columns.award_day_delta[0] : day + columns.award_day_delta[i];
    const awardDate = dayToISO(day);
    const r = columns.recipient[i];
    const group = dicts.recipient_group[r];
    const la = columns.local_authority[i];
    const current = la >= 0 ? dicts.local_authority_current[la] : -1;
    const sourceFile = pick(dicts.source_file, columns.source_file[i]);

    grants[i] = {
      uid: "",
      recipient: dicts.recipient[r],
      recipient_key: dicts.group_key[group],
      recipient_type: TYPE_FROM_CODE[dicts.group_type[group]] ?? "unknown",
      activity_name: columns.activity_name[i],
      award_amount: columns.award_amount[i],
      award_date: awardDate,
      decision_month: monthOfISODate(awardDate),
      decision_quarter: fyQuarterOfISODate(awardDate),
      ace_area: pick(dicts.ace_area, columns.ace_area[i]),
      local_authority: pick(dicts.local_authority, la),
      local_authority_current: pick(dicts.la_current, current),
      la_code: current >= 0 ? dicts.la_code[current] ?? null : null,
      main_discipline: pick(dicts.main_discipline, columns.main_discipline[i]),
      strand: pick(dicts.strand, columns.strand[i]),
      time_limited_priority: pick(dicts.time_limited_priority, columns.time_limited_priority[i]),
      funding_year: pick(dicts.funding_year, columns.funding_year[i]) ?? "",
      source_file: sourceFile ?? undefined
    };
  }
  return { grants: assignGrantIds(grants), meta: data.meta };
};
