import { useEffect, useState } from "react";
import { normaliseGrants } from "../lib/normalise";
import { buildDatasetMeta } from "../lib/meta";
import type { DataSource, DatasetMeta, Grant, GrantRecord } from "../lib/types";
import { loadGrants } from "./load";
import { loadSupabaseClient } from "./supabase-client";

export interface GrantsData {
  grants: Grant[];
  meta: DatasetMeta | null;
  source: DataSource | null;
  loading: boolean;
  notice: string | null;
  error: string | null;
}

export interface UseGrantsDataOptions {
  initialData?: GrantRecord[];
  dataUrls: readonly string[];
  sampleDataUrl: string | null;
  /** Small metadata file, fetched alongside the data so headline figures show while it loads. */
  metaUrl?: string | null;
  /** Whether to attempt loading from Supabase (default false; static file is recommended). */
  useSupabase?: boolean;
}

const looksLikeMeta = (value: unknown): value is DatasetMeta =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as DatasetMeta).row_count === "number" &&
  Array.isArray((value as DatasetMeta).funding_years);

const fromInitialData = (initialData: GrantRecord[]): GrantsData => {
  const grants = normaliseGrants(initialData);
  return { grants, meta: buildDatasetMeta(grants), source: "props", loading: false, notice: null, error: null };
};

const EMPTY: GrantsData = { grants: [], meta: null, source: null, loading: true, notice: null, error: null };

export const useGrantsData = ({ initialData, dataUrls, sampleDataUrl, metaUrl = null, useSupabase = false }: UseGrantsDataOptions): GrantsData => {
  const hasInitialData = Boolean(initialData && initialData.length > 0);
  const [state, setState] = useState<GrantsData>(() =>
    hasInitialData ? fromInitialData(initialData!) : EMPTY
  );
  // Join so callers can pass a fresh array literal each render without refetching.
  const urlsKey = dataUrls.join("\n");

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setState(fromInitialData(initialData));
      return;
    }
    let cancelled = false;
    setState(EMPTY);
    if (metaUrl) {
      fetch(metaUrl)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((json) => {
          // Only while still loading; the dataset's own metadata wins once it arrives.
          if (!cancelled && looksLikeMeta(json)) setState((s) => (s.loading ? { ...s, meta: json } : s));
        });
    }

    const getSupabase = useSupabase
      ? loadSupabaseClient().catch((err) => {
          console.warn("Supabase client failed to load; using static data.", err);
          return null;
        })
      : Promise.resolve(null);

    getSupabase
      .then((supabase) => loadGrants({ supabase, dataUrls: urlsKey.split("\n"), sampleDataUrl }))
      .then((result) => {
        if (!cancelled) setState({ ...result, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, urlsKey, sampleDataUrl, metaUrl, useSupabase]);

  return state;
};
