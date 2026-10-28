// Finds and loads the grants, trying each source in order:
//   1. Supabase, when configured
//   2. each static dataset URL (compact or legacy flat JSON, detected by shape)
//   3. the development sample
// Any fallback comes with a notice saying what loaded and why.

import { decodeCompact, isCompactDataset } from "../lib/compact";
import { buildDatasetMeta } from "../lib/meta";
import { normaliseGrants } from "../lib/normalise";
import type { DataSource, DatasetMeta, Grant } from "../lib/types";
import type { SupabaseClientLike } from "./supabase-client";

export interface LoadResult {
  grants: Grant[];
  meta: DatasetMeta | null;
  source: DataSource | null;
  notice: string | null;
  error: string | null;
}

export interface LoadOptions {
  supabase: SupabaseClientLike | null;
  dataUrls: readonly string[];
  sampleDataUrl: string | null;
  fetchImpl?: typeof fetch;
}

const SUPABASE_TABLE = "arts_council_grants";
const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_CONCURRENCY = 4;

const errorMessage = (err: unknown): string =>
  err instanceof Error
    ? err.message
    : typeof err === "object" && err && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);

/**
 * Fetches every row, page by page. A single select returns at most the
 * project's Max Rows setting (1,000 by default). Ordering by id keeps pages
 * stable. Selects "*" so tables with or without the pipeline's derived
 * columns both work.
 */
export const fetchAllFromSupabase = async (client: SupabaseClientLike): Promise<unknown[]> => {
  const first = await client
    .from(SUPABASE_TABLE)
    .select("*", { count: "exact" })
    .order("id")
    .range(0, SUPABASE_PAGE_SIZE - 1);
  if (first.error) throw first.error;

  const rows: unknown[] = [...(first.data ?? [])];
  const total = first.count ?? rows.length;
  // If the project's Max Rows is below our page size, page by what it returned.
  const pageSize = rows.length > 0 && rows.length < total ? rows.length : SUPABASE_PAGE_SIZE;

  const starts: number[] = [];
  for (let from = rows.length; from < total; from += pageSize) starts.push(from);

  for (let i = 0; i < starts.length; i += SUPABASE_CONCURRENCY) {
    const pages = await Promise.all(
      starts
        .slice(i, i + SUPABASE_CONCURRENCY)
        .map((from) => client.from(SUPABASE_TABLE).select("*").order("id").range(from, from + pageSize - 1))
    );
    for (const page of pages) {
      if (page.error) throw page.error;
      rows.push(...(page.data ?? []));
    }
  }

  if (rows.length !== total) {
    throw new Error(`expected ${total.toLocaleString()} rows but received ${rows.length.toLocaleString()}`);
  }
  return rows;
};

/** Turns parsed JSON into grants, whichever format it's in. */
export const parseDataset = (json: unknown): { grants: Grant[]; meta: DatasetMeta | null } => {
  if (Array.isArray(json)) return { grants: normaliseGrants(json), meta: null };
  if (isCompactDataset(json)) return decodeCompact(json);
  throw new Error("unrecognised dataset format");
};

type FetchOutcome =
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "ok"; grants: Grant[]; meta: DatasetMeta | null };

const fetchDataset = async (url: string, fetchImpl: typeof fetch): Promise<FetchOutcome> => {
  let json: unknown;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return { status: "missing" };
    json = await response.json();
  } catch {
    // Network failure, or a host that answers missing files with an HTML page.
    return { status: "missing" };
  }
  try {
    const parsed = parseDataset(json);
    return parsed.grants.length > 0 ? { status: "ok", ...parsed } : { status: "missing" };
  } catch (err) {
    return { status: "invalid", message: errorMessage(err) };
  }
};

export const loadGrants = async ({
  supabase,
  dataUrls,
  sampleDataUrl,
  fetchImpl = (...args) => fetch(...args)
}: LoadOptions): Promise<LoadResult> => {
  const problems: string[] = [];

  if (supabase) {
    try {
      const grants = normaliseGrants(await fetchAllFromSupabase(supabase));
      if (grants.length > 0) {
        return { grants, meta: buildDatasetMeta(grants), source: "supabase", notice: null, error: null };
      }
      problems.push("the live database returned no rows");
    } catch (err) {
      console.warn("Supabase load failed; falling back to static data.", err);
      problems.push(`the live database couldn't be loaded (${errorMessage(err)})`);
    }
  }

  for (const url of dataUrls) {
    const outcome = await fetchDataset(url, fetchImpl);
    if (outcome.status === "ok") {
      return {
        grants: outcome.grants,
        meta: outcome.meta ?? buildDatasetMeta(outcome.grants),
        source: "static",
        notice: null,
        error: null
      };
    }
    if (outcome.status === "invalid") problems.push(`${url} couldn't be read (${outcome.message})`);
  }

  if (sampleDataUrl) {
    const outcome = await fetchDataset(sampleDataUrl, fetchImpl);
    if (outcome.status === "ok") {
      const count = outcome.grants.length.toLocaleString();
      const reason = problems.length ? ` (${problems.join("; ")})` : "";
      return {
        grants: outcome.grants,
        meta: outcome.meta ?? buildDatasetMeta(outcome.grants),
        source: "sample",
        notice: `The full dataset couldn't be loaded from ${dataUrls.join(" or ")}${reason}, so this view shows a ${count}-grant development sample. Totals and charts don't represent all grants.`,
        error: null
      };
    }
  }

  return {
    grants: [],
    meta: null,
    source: null,
    notice: null,
    error:
      `Grant data couldn't be loaded. Check that ${dataUrls.join(" or ")} exists and returns JSON` +
      (problems.length ? `. Problems found: ${problems.join("; ")}.` : ".")
  };
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
