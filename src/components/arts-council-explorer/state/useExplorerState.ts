import { useCallback, useEffect, useReducer, useRef } from "react";
import { DEFAULT_STATE, explorerReducer } from "../lib/filters";
import type { ExplorerAction, ExplorerState } from "../lib/filters";
import { DEFAULT_BASE_PATH, stateFromLocation, stateToLocation } from "../lib/url-state";

// Discrete choices get their own history entry, so Back undoes them.
// Typing, paging and chart toggles replace the current entry instead of
// flooding history with one entry per keystroke.
const PUSH_ACTIONS = new Set<ExplorerAction["type"]>([
  "setValues",
  "toggleValue",
  "removeValue",
  "toggleCell",
  "setAmount",
  "toggleAmount",
  "setDates",
  "sort",
  "setSort",
  "setTab",
  "setCompare",
  "openGrant",
  "closeGrant",
  "openProfile",
  "closeProfile",
  "exploreOnly",
  "showRecipient",
  "clear",
  "clearFilters",
  "reset"
]);

const hasWindow = () => typeof window !== "undefined";

export interface UseExplorerStateOptions {
  /** Keep the URL in step with the state (default true). */
  syncUrl?: boolean;
  basePath?: string;
}

export const useExplorerState = ({ syncUrl = true, basePath = DEFAULT_BASE_PATH }: UseExplorerStateOptions = {}) => {
  const [state, rawDispatch] = useReducer(explorerReducer, undefined, () =>
    syncUrl && hasWindow()
      ? stateFromLocation(window.location.pathname, window.location.search, basePath)
      : DEFAULT_STATE
  );
  const historyMode = useRef<"push" | "replace">("replace");

  const dispatch = useCallback((action: ExplorerAction) => {
    historyMode.current = PUSH_ACTIONS.has(action.type) ? "push" : "replace";
    rawDispatch(action);
  }, []);

  // State -> URL
  useEffect(() => {
    if (!syncUrl || !hasWindow()) return;
    const { pathname, search } = stateToLocation(state, window.location.search, basePath);
    const nextUrl = `${pathname}${search}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;

    if (historyMode.current === "push") window.history.pushState(window.history.state, "", nextUrl);
    else window.history.replaceState(window.history.state, "", nextUrl);
    historyMode.current = "replace";
  }, [state, syncUrl, basePath]);

  // Keep canonical tag and og:url in sync with the current explorer state route
  useEffect(() => {
    if (!syncUrl || !hasWindow()) return;
    const { pathname } = stateToLocation(state, window.location.search, basePath);
    const canonicalHref = `${window.location.origin}${pathname}`;

    const canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.setAttribute("href", canonicalHref);
    } else {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", canonicalHref);
      document.head.appendChild(link);
    }

    const ogUrlEl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrlEl) {
      ogUrlEl.setAttribute("content", canonicalHref);
    }
  }, [state, syncUrl, basePath]);

  // URL -> state (Back and Forward)
  useEffect(() => {
    if (!syncUrl || !hasWindow()) return;
    const onPopState = () => {
      historyMode.current = "replace";
      rawDispatch({
        type: "hydrate",
        state: stateFromLocation(window.location.pathname, window.location.search, basePath)
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [syncUrl, basePath]);

  return [state, dispatch] as const;
};

export type ExplorerDispatch = ReturnType<typeof useExplorerState>[1];
export type { ExplorerState };

