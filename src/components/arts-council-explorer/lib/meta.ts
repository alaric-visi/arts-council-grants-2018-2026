import { isFYInProgress } from "./fiscal";
import type { DatasetMeta, Grant } from "./types";

/** Summarises a set of grants. Used by the pipeline and for sources without shipped metadata. */
export const buildDatasetMeta = (
  grants: readonly Grant[],
  { generatedAt = new Date().toISOString(), today = new Date() }: { generatedAt?: string; today?: Date } = {}
): DatasetMeta => {
  const years = new Map<string, { rows: number; total: number; latest: string | null }>();
  const sources = new Map<string, number>();
  let total = 0;
  let latest: string | null = null;

  for (const grant of grants) {
    total += grant.award_amount;
    if (grant.award_date && (!latest || grant.award_date > latest)) latest = grant.award_date;
    const year = years.get(grant.funding_year) ?? { rows: 0, total: 0, latest: null };
    year.rows += 1;
    year.total += grant.award_amount;
    if (grant.award_date && (!year.latest || grant.award_date > year.latest)) year.latest = grant.award_date;
    years.set(grant.funding_year, year);
    if (grant.source_file) sources.set(grant.source_file, (sources.get(grant.source_file) ?? 0) + 1);
  }

  return {
    generated_at: generatedAt,
    row_count: grants.length,
    total_awarded: total,
    latest_award_date: latest,
    funding_years: Array.from(years, ([funding_year, y]) => ({
      funding_year,
      rows: y.rows,
      total: y.total,
      latest_award_date: y.latest,
      in_progress: isFYInProgress(funding_year, today)
    })).sort((a, b) => a.funding_year.localeCompare(b.funding_year)),
    source_files: Array.from(sources, ([name, rows]) => ({ name, rows })).sort((a, b) => a.name.localeCompare(b.name))
  };
};
