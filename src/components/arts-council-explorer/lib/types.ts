/** One grant as published by Arts Council England (the source schema). */
export interface GrantRecord {
  id?: string;
  recipient: string;
  activity_name: string;
  award_amount: number;
  award_date: string;
  decision_month: string | null;
  decision_quarter: string | null;
  ace_area: string | null;
  local_authority: string | null;
  main_discipline: string | null;
  strand: string | null;
  time_limited_priority: string | null;
  funding_year: string;
  source_file?: string;
}

/** Inferred from the recipient's name; never authoritative. */
export type RecipientType = "organisation" | "individual" | "unknown";

/** A cleaned grant with derived fields used for grouping and mapping. */
export interface Grant extends GrantRecord {
  /** Stable id derived from the grant's content, used in links (?grant=…). */
  uid: string;
  /** Groups spelling variants of the same recipient. */
  recipient_key: string;
  /** Inferred from the name, so it can be wrong. Label it as inferred wherever it's shown. */
  recipient_type: RecipientType;
  /** Local authority on current boundaries (e.g. "Harrogate" becomes "North Yorkshire"). */
  local_authority_current: string | null;
  /** ONS local authority district code, when the pipeline was given an ONS lookup. */
  la_code: string | null;
}

export type DataSource = "supabase" | "static" | "sample" | "props";

export interface FundingYearSummary {
  funding_year: string;
  rows: number;
  total: number;
  latest_award_date: string | null;
  /** True if the year hadn't ended when the dataset was built. */
  in_progress: boolean;
}

/** ONS mid-year population estimates by local authority district, if the build was given them. */
export interface PopulationData {
  /** e.g. "2023" */
  year: string | null;
  /** File the figures came from. */
  source: string;
  byCode: Record<string, { name: string; population: number }>;
}

/** English Indices of Deprivation, district summaries. Rank 1 is the most deprived district. */
export interface DeprivationData {
  /** e.g. "2025" */
  edition: string | null;
  source: string;
  /** The column used, e.g. "IMD - Rank of average score". */
  measure: string;
  /** Number of districts ranked. */
  districts: number;
  byCode: Record<string, { rank: number; /** 1 = most deprived fifth … 5 = least deprived fifth */ quintile: number }>;
}

/** A published list of places, such as ACE's Priority Places 2021–24. */
export interface DesignationData {
  id: string;
  name: string;
  /** e.g. "2021–24" */
  period: string | null;
  source: string | null;
  /** Local authorities on current boundaries. */
  places: string[];
  /** ONS codes of those authorities, where known. */
  codes: string[];
}

/** Facts about a dataset build, shipped inside the compact file and as metadata.json. */
export interface DatasetMeta {
  generated_at: string;
  row_count: number;
  total_awarded: number;
  latest_award_date: string | null;
  funding_years: FundingYearSummary[];
  source_files: Array<{ name: string; rows: number }>;
  populations?: PopulationData;
  deprivation?: DeprivationData;
  designations?: DesignationData[];
}
