import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Database, Download, Filter } from "lucide-react";
import { buildDatasetIndex, crossfilter, fundingYearCutoffs, recipientFirstYears, summariseGrants } from "./lib/aggregate";
import { buildPlaceIndex } from "./lib/places";
import { buildGrantsCsv } from "./lib/csv";
import { EMPTY_FILTERS, activeFilters, filterGrants, filterOptions, sanitizeState, sortGrants } from "./lib/filters";
import type { FilterState } from "./lib/filters";
import { describeView } from "./lib/summary";
import { DEFAULT_BASE_PATH, stateToUrl, toSlug } from "./lib/url-state";
import type { Grant, GrantRecord } from "./lib/types";
import { useGrantsData } from "./data/useGrantsData";
import { useMapData } from "./data/useMapData";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useExplorerState } from "./state/useExplorerState";
import { ActiveFilterBar } from "./components/ActiveFilterBar";
import { AnalyticsView } from "./components/AnalyticsView";
import { BackLink } from "./components/BackLink";
import { FilterPanel } from "./components/FilterPanel";
import { GooLoader } from "./components/GooLoader";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { GrantDrawer } from "./components/GrantDrawer";
import { GrantsTable } from "./components/GrantsTable";
import { StatCards } from "./components/StatCards";
import { ViewTabs, panelId, tabId } from "./components/ViewTabs";
import { AboutView } from "./components/AboutView";
import { CompareView } from "./components/CompareView";
import { OverviewView } from "./components/OverviewView";
import { ExportContext } from "./components/ExportMenu";
import { formatAmount, formatISODate } from "./lib/format";
import { ProfileView } from "./components/profile/ProfileView";
import type { ProfileContext } from "./components/profile/context";

// The map pulls in d3-geo and topojson-client, so it loads only when opened.
const MapView = lazy(() => import("./components/MapView"));

const ITEMS_PER_PAGE = 15;

/** Compact pipeline output first, then the legacy flat file. */
export const DEFAULT_DATA_URLS = ["/data/arts-council-grants.v1.json", "/data/arts-council-grants.json"];
export const DEFAULT_MAP_URL = "/data/la-map.v1.json";
export const DEFAULT_META_URL = "/data/metadata.json";

export interface ArtsCouncilExplorerProps {
  /** Grants to show instead of loading any. */
  initialData?: GrantRecord[];
  backHref?: string;
  backLabel?: string;
  /** Base path for URL routing (defaults to DEFAULT_BASE_PATH). */
  basePath?: string;
  /** Static dataset URL(s), tried in order. Either format (compact or flat JSON) works. */
  dataUrl?: string | string[];
  /** Small development sample, used only if no full dataset loads. Null disables it. */
  sampleDataUrl?: string | null;
  /** Keep filters in the page URL so views can be shared (default true). */
  syncUrl?: boolean;
  /** Map boundaries built by the pipeline. Null hides the map (the table view still works). */
  mapUrl?: string | null;
  /** Name used in the citation on the methodology page and on downloaded charts. */
  citationName?: string;
  /** Small metadata file shown while the data loads. Null skips it. */
  metaUrl?: string | null;
  /** "skeleton" (default): placeholder shapes; "goo": the animated loader. */
  loadingStyle?: "skeleton" | "goo";
  /** Whether to attempt loading from Supabase (default false; static files are recommended). */
  useSupabase?: boolean;
}

const downloadText = (text: string, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release the blob once the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const pickFilters = (s: FilterState): FilterState => {
  const f = {} as Record<keyof FilterState, unknown>;
  for (const key of Object.keys(EMPTY_FILTERS) as Array<keyof FilterState>) f[key] = s[key];
  return f as unknown as FilterState;
};

export const ArtsCouncilExplorer = ({
  initialData,
  backHref = "/tools",
  backLabel = "Back to Tools",
  basePath = DEFAULT_BASE_PATH,
  dataUrl = DEFAULT_DATA_URLS,
  sampleDataUrl = "/data/sample-grants.json",
  syncUrl = true,
  mapUrl = DEFAULT_MAP_URL,
  citationName = "Arts Council Funding Explorer",
  metaUrl = DEFAULT_META_URL,
  loadingStyle = "skeleton",
  useSupabase = false
}: ArtsCouncilExplorerProps) => {
  const dataUrls = Array.isArray(dataUrl) ? dataUrl : [dataUrl];
  const { grants, meta, source, loading, notice, error } = useGrantsData({ initialData, dataUrls, sampleDataUrl, metaUrl, useSupabase });
  const [state, dispatch] = useExplorerState({ syncUrl, basePath });
  const reducedMotion = usePrefersReducedMotion();

  const places = useMemo(
    () => buildPlaceIndex(grants, meta?.populations, meta?.deprivation, meta?.designations ?? []),
    [grants, meta]
  );
  const options = useMemo(() => filterOptions(grants, places), [grants, places]);
  const fyCutoffs = useMemo(() => fundingYearCutoffs(grants), [grants]);
  const byUid = useMemo(() => new Map(grants.map((g) => [g.uid, g])), [grants]);
  const groupBy = (key: (g: Grant) => string | null) => {
    const map = new Map<string, Grant[]>();
    for (const g of grants) {
      const k = key(g);
      if (!k) continue;
      const list = map.get(k);
      if (list) list.push(g);
      else map.set(k, [g]);
    }
    for (const list of map.values()) list.sort((a, b) => b.award_date.localeCompare(a.award_date));
    // Index by slug alias as well so direct slug lookups (e.g. from deep links) resolve immediately
    for (const [k, list] of Array.from(map.entries())) {
      const slug = toSlug(k);
      if (slug && !map.has(slug)) {
        map.set(slug, list);
      }
    }
    return map;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byRecipient = useMemo(() => groupBy((g) => g.recipient_key), [grants]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byPlace = useMemo(() => groupBy((g) => g.local_authority_current), [grants]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byDiscipline = useMemo(() => groupBy((g) => g.main_discipline), [grants]);
  const firstYears = useMemo(() => recipientFirstYears(grants), [grants]);
  const index = useMemo(() => buildDatasetIndex(grants), [grants]);
  const overall = useMemo(() => summariseGrants(grants), [grants]);
  const firstYear = useMemo(() => Object.keys(fyCutoffs).sort()[0] ?? null, [fyCutoffs]);

  // Slug-to-canonical ID maps for resolving slugs from direct URL visits:
  const recipientSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants) {
      if (g.recipient_key) {
        map.set(toSlug(g.recipient_key), g.recipient_key);
        if (g.recipient) map.set(toSlug(g.recipient), g.recipient_key);
      }
    }
    return map;
  }, [grants]);

  const placeSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const la of options.localAuthorities) {
      map.set(toSlug(la), la);
    }
    return map;
  }, [options.localAuthorities]);

  const disciplineSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of options.disciplines) {
      map.set(toSlug(d), d);
    }
    return map;
  }, [options.disciplines]);

  // Drop values the data doesn't contain (e.g. from an old shared link) and resolve slugs to canonical IDs.
  useEffect(() => {
    if (loading || grants.length === 0) return;
    const clean = sanitizeState(state, options, {
      grant: (uid) => byUid.has(uid),
      recipient: (key) => byRecipient.has(key) || recipientSlugMap.has(key),
      resolveProfile: (kind, id) => {
        if (kind === "recipient") return recipientSlugMap.get(id) ?? (byRecipient.has(id) ? id : null);
        if (kind === "place") return placeSlugMap.get(id) ?? (options.localAuthorities.includes(id) ? id : null);
        if (kind === "discipline") return disciplineSlugMap.get(id) ?? (options.disciplines.includes(id) ? id : null);
        return null;
      }
    });
    if (clean !== state) dispatch({ type: "hydrate", state: clean });
  }, [loading, grants.length, options, byUid, byRecipient, recipientSlugMap, placeSlugMap, disciplineSlugMap, state, dispatch]);

  // Inputs stay responsive: recalculation waits for React to be idle.
  // Same object until a filter value actually changes (not on sort, page or tab changes).
  const filterKey = JSON.stringify(pickFilters(state));
  const filters = useMemo(() => JSON.parse(filterKey) as FilterState, [filterKey]);
  const deferredFilters = useDeferredValue(filters);
  const pending = deferredFilters !== filters;

  const aggregates = useMemo(
    () => crossfilter(grants, deferredFilters, { allAreas: options.areas, fyCutoffs, index, places }),
    [grants, deferredFilters, options.areas, fyCutoffs, index, places]
  );
  const mapData = useMapData(mapUrl, state.tab === "map");
  const profileContext: ProfileContext = {
    byRecipient,
    byPlace,
    byDiscipline,
    firstYears,
    places,
    years: options.years,
    overall: overall.stats,
    placeTotals: overall.byLocalAuthority,
    dispatch
  };

  // The table sorts the whole dataset once per sort choice and filters that.
  // Filtering keeps order, so changing a filter never re-sorts.
  const sortedAll = useMemo(
    () => sortGrants(grants.slice(), state.sortField, state.sortOrder),
    [grants, state.sortField, state.sortOrder]
  );
  const tableRows = useMemo(() => filterGrants(sortedAll, deferredFilters, places), [sortedAll, deferredFilters, places]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
  const page = Math.min(state.page, totalPages);
  const pageRows = useMemo(() => tableRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [tableRows, page]);

  // Keep the URL honest if a shared link asks for a page that no longer exists.
  useEffect(() => {
    if (!loading && state.page > totalPages) dispatch({ type: "setPage", page: totalPages });
  }, [loading, state.page, totalPages, dispatch]);

  const openGrant = state.grant ? byUid.get(state.grant) ?? null : null;
  const summary = describeView(deferredFilters, aggregates.stats, places.groupLabel);
  const exportLabels = useMemo(
    () => ({
      subtitle: summary,
      credit: `${citationName}. Data: Arts Council England${meta ? `, built ${formatISODate(meta.generated_at.slice(0, 10))}` : ""}.`
    }),
    [summary, citationName, meta]
  );
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${stateToUrl(state, syncUrl ? window.location.search : "", basePath)}`;

  const profileGrants = useMemo(() => {
    if (!state.profile) return [];
    if (state.profile.kind === "recipient") return byRecipient.get(state.profile.id) ?? [];
    if (state.profile.kind === "place") return byPlace.get(state.profile.id) ?? [];
    if (state.profile.kind === "discipline") return byDiscipline.get(state.profile.id) ?? [];
    return [];
  }, [state.profile, byRecipient, byPlace, byDiscipline]);

  const profileTitle = useMemo(() => {
    if (!state.profile) return null;
    if (state.profile.kind === "recipient") {
      const list = byRecipient.get(state.profile.id);
      return list?.[0]?.recipient ?? state.profile.id;
    }
    return state.profile.id;
  }, [state.profile, byRecipient]);

  // Sync document.title with the active view or profile
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (profileTitle) {
      document.title = `${profileTitle} — Arts Council Funding Grants - Mike Higgins`;
    } else if (openGrant) {
      document.title = `${openGrant.activity_name || "Grant Details"} — Arts Council Funding Grants - Mike Higgins`;
    } else if (state.tab && state.tab !== "overview") {
      const tabTitles: Record<string, string> = {
        table: "Grants Directory",
        charts: "Funding Analytics",
        map: "Funding Map",
        compare: "Compare Funding",
        about: "About & Methodology"
      };
      const titlePrefix = tabTitles[state.tab] || "Arts Council Funding Grants";
      document.title = `${titlePrefix} — Arts Council Funding Grants - Mike Higgins`;
    } else {
      document.title = "Arts Council Funding Grants 2018–2026 - Mike Higgins";
    }
  }, [profileTitle, openGrant, state.tab]);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const activeFiltersList = useMemo(() => activeFilters(filters), [filters]);
  const activeFilterCount = activeFiltersList.length;

  const exportRowCount = state.profile ? profileGrants.length : tableRows.length;

  const exportCsv = () => {
    if (state.profile) {
      const filenameSlug = toSlug(profileTitle || state.profile.id) || "profile";
      downloadText(
        buildGrantsCsv(profileGrants),
        `arts_council_grants_${filenameSlug}_${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv;charset=utf-8;"
      );
    } else {
      downloadText(
        buildGrantsCsv(tableRows),
        `arts_council_grants_${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv;charset=utf-8;"
      );
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full text-white font-sans selection:bg-white selection:text-black relative bg-black">
      {/* Fixed background image & atmospheric gradient matching json-grid-view */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{ backgroundImage: 'url(/hero-bg.png)' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black -z-10" />

      {/* FULL SCREEN APPLICATION STUDIO CARD */}
      <div className="flex flex-1 w-full min-h-dvh lg:h-dvh flex-col overflow-hidden relative p-0 m-0">
        <main className="flex-1 w-full h-full flex flex-col overflow-hidden relative p-0 m-0">
          <div className="w-full flex-1 h-full flex flex-col overflow-hidden bg-white/[0.02] backdrop-blur-md">
            {/* App Header Bar (H1 integrated inside the app) */}
            <header className="border-b border-white/10 bg-white/[0.03] px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2.5 flex-wrap flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {backHref && (
                  <BackLink href={backHref} label={backLabel} />
                )}
                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white m-0 whitespace-nowrap">
                    Arts Council Funding
                  </h1>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono text-white/50 border-l border-white/10 pl-2 whitespace-nowrap">
                    2018–2026 Archive
                  </span>
                  {state.profile && (
                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white max-w-[200px] sm:max-w-[320px] truncate">
                        <span className="text-white/50 capitalize">{state.profile.kind}:</span>
                        <span className="truncate font-medium">{profileTitle}</span>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "closeProfile" })}
                          className="text-white/50 hover:text-white ml-0.5 cursor-pointer leading-none px-0.5 font-bold"
                          title="Exit profile and return to explorer"
                          aria-label="Exit profile and return to explorer"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  {meta && (
                    <span className="hidden md:inline-flex items-center text-[11px] font-mono text-white/40 border-l border-white/10 pl-2 whitespace-nowrap">
                      {meta.row_count.toLocaleString()} grants · {formatAmount(meta.total_awarded)}
                    </span>
                  )}
                  {source && !loading && !error && (
                    <span
                      className={`hidden lg:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${
                        source === "supabase" || source === "static" || source === "props"
                          ? "border-emerald-800/80 bg-emerald-950/60 text-emerald-400"
                          : "border-amber-800/80 bg-amber-950/60 text-amber-400"
                      }`}
                    >
                      <Database className="w-3 h-3" />
                      {source === "supabase" ? "Live DB" : source === "static" ? "Static dataset" : source}
                    </span>
                  )}
                </div>
              </div>

              {/* View Tabs & Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <ViewTabs tab={state.profile ? null : state.tab} onChange={(tab) => dispatch({ type: "setTab", tab })} />

                <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (state.profile) dispatch({ type: "closeProfile" });
                      setFilterPanelOpen((prev) => !prev);
                    }}
                    className={`px-2.5 py-1 text-xs font-mono rounded inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                      filterPanelOpen || activeFilterCount > 0
                        ? "bg-white text-black font-semibold border-white shadow-sm"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                    }`}
                    aria-expanded={filterPanelOpen}
                    title="Toggle search and filters"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          filterPanelOpen ? "bg-black text-white" : "bg-emerald-900/80 text-emerald-300 border border-emerald-700/60"
                        }`}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={exportRowCount === 0}
                    className="px-2.5 py-1 text-xs font-mono rounded inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                    title={state.profile ? "Export this profile's grants as CSV" : "Export filtered grants as CSV"}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>
            </header>

            {/* Error / Notice Banners */}
            {error && (
              <div role="alert" className="border-b border-red-800/60 bg-red-950/50 px-3 sm:px-4 py-2 text-xs font-mono text-red-300 flex items-center justify-between">
                <span>{error}</span>
              </div>
            )}
            {notice && !loading && (
              <div role="status" className="border-b border-amber-800/60 bg-amber-950/40 px-3 sm:px-4 py-1.5 text-xs font-mono text-amber-300 flex items-center justify-between">
                <span>{notice}</span>
              </div>
            )}

            {/* Collapsible Filter Panel */}
            {filterPanelOpen && (
              <div className="border-b border-white/10 bg-[#0c0c10]/95 backdrop-blur-md px-4 sm:px-6 py-4 flex-shrink-0 animate-in fade-in duration-150">
                <FilterPanel
                  state={state}
                  options={options}
                  dispatch={dispatch}
                  onExport={exportCsv}
                  exportDisabled={tableRows.length === 0}
                  groupLabel={places.groupLabel}
                  deprivationEdition={places.deprivation?.edition ?? null}
                  onClose={() => setFilterPanelOpen(false)}
                />
              </div>
            )}

            {/* Active Filter Chips Bar */}
            <ActiveFilterBar
              filters={filters}
              shown={aggregates.stats.count}
              total={grants.length}
              dispatch={dispatch}
              groupLabel={places.groupLabel}
            />

            {/* Workspace Scroll Area */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-white/65">
                {loadingStyle === "goo" ? (
                  <>
                    <GooLoader />
                    <p className="font-mono text-sm tracking-widest uppercase mt-8">Loading grant archives...</p>
                  </>
                ) : (
                  <LoadingSkeleton count={meta?.row_count ?? null} />
                )}
              </div>
            ) : error ? null : (
              <ExportContext.Provider value={exportLabels}>
                <div className={`flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 transition-opacity motion-reduce:transition-none ${pending ? "opacity-60" : ""}`}>
                  {state.profile ? (
                    <ProfileView kind={state.profile.kind} id={state.profile.id} ctx={profileContext} />
                  ) : (
                    <>
                      {state.tab === "overview" && (
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                              <p className="text-sm sm:text-base text-white/80 font-light leading-relaxed max-w-[75ch]" data-testid="summary">
                                {summary}
                              </p>
                              <p className="text-xs text-white/50 mt-1 font-light">
                                National Lottery Project Grants archive awarded by Arts Council England (2018–19 to 2025–26).
                              </p>
                            </div>
                            <div className="text-xs font-mono text-white/50 shrink-0">
                              <strong className="text-white font-medium">{aggregates.stats.count.toLocaleString()}</strong> grants · <strong className="text-white font-medium">{formatAmount(aggregates.stats.totalAwarded)}</strong>
                            </div>
                          </div>

                          <StatCards stats={aggregates.stats} comparison={aggregates.comparison} />

                          <OverviewView aggregates={aggregates} places={places} dispatch={dispatch} />
                        </div>
                      )}

                      {state.tab === "table" && (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                            <p className="text-xs text-white/60 font-mono">
                              {summary}
                            </p>
                            <span className="text-xs font-mono text-white/50">
                              Page {page} of {totalPages} ({aggregates.stats.count.toLocaleString()} grants)
                            </span>
                          </div>
                          <GrantsTable
                            rows={pageRows}
                            sortField={state.sortField}
                            sortOrder={state.sortOrder}
                            onSort={(field) => dispatch({ type: "sort", field })}
                            onSetSort={(field, order) => dispatch({ type: "setSort", field, order })}
                            page={page}
                            totalPages={totalPages}
                            onPage={(next) => dispatch({ type: "setPage", page: next })}
                            onOpen={(uid) => dispatch({ type: "openGrant", uid })}
                            query={deferredFilters.q}
                            searchIn={deferredFilters.searchIn}
                          />
                        </div>
                      )}

                      {state.tab === "charts" && (
                        <AnalyticsView
                          aggregates={aggregates}
                          state={state}
                          dispatch={dispatch}
                          animate={!reducedMotion}
                          firstYear={firstYear}
                          places={places}
                        />
                      )}

                      {state.tab === "map" && (
                        <Suspense fallback={<p className="text-sm text-white/70" role="status">Loading the map…</p>}>
                          <MapView
                            status={mapUrl ? mapData.status : "missing"}
                            map={mapData.map}
                            byLocalAuthority={aggregates.byLocalAuthority}
                            places={places}
                            metric={state.mapMetric}
                            onMetricChange={(metric) => dispatch({ type: "setMapMetric", metric })}
                            selected={state.localAuthorities}
                            onToggle={(value) => dispatch({ type: "toggleValue", field: "localAuthorities", value })}
                            onOpenProfile={(id) => dispatch({ type: "openProfile", kind: "place", id })}
                            outline={state.mapOutline}
                            onOutlineChange={(designation) => dispatch({ type: "setMapOutline", designation })}
                          />
                        </Suspense>
                      )}

                      {state.tab === "compare" && (
                        <CompareView
                          grants={grants}
                          filters={deferredFilters}
                          state={state}
                          options={options}
                          dispatch={dispatch}
                          firstYears={firstYears}
                          places={places}
                          animate={!reducedMotion}
                        />
                      )}

                      {state.tab === "about" && <AboutView meta={meta} citationName={citationName} />}
                    </>
                  )}
                </div>
              </ExportContext.Provider>
            )}
          </div>
        </main>
      </div>

      {openGrant && (
        <GrantDrawer
          grant={openGrant}
          history={byRecipient.get(openGrant.recipient_key) ?? [openGrant]}
          shareUrl={shareUrl}
          onClose={() => dispatch({ type: "closeGrant" })}
          onOpen={(uid) => dispatch({ type: "openGrant", uid })}
          onShowRecipient={(name) => dispatch({ type: "showRecipient", name })}
          onOpenProfile={(kind, id) => dispatch({ type: "openProfile", kind, id })}
        />
      )}
    </div>
  );
};

export default ArtsCouncilExplorer;
