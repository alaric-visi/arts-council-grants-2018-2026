import { useEffect, useRef, useState } from "react";
import { isMapFile } from "../lib/map-format";
import type { MapFile } from "../lib/map-format";

export type MapStatus = "idle" | "loading" | "ready" | "missing";

/**
 * Loads the map file the first time it's needed and keeps it. "missing"
 * covers absent and unreadable files alike.
 */
export const useMapData = (url: string | null, enabled: boolean): { status: MapStatus; map: MapFile | null } => {
  const [state, setState] = useState<{ status: MapStatus; map: MapFile | null }>({ status: "idle", map: null });
  // The URL whose load has finished. Deliberately not state: the status isn't a dependency, because
  // changing it to "loading" would re-run the effect and its cleanup would cancel the request.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !url || loadedFor.current === url) return;
    let cancelled = false;
    setState({ status: "loading", map: null });
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((json) => {
        if (cancelled) return;
        loadedFor.current = url;
        setState(isMapFile(json) ? { status: "ready", map: json } : { status: "missing", map: null });
      });
    // Leaving the tab mid-load (or React's development double-run) cancels; the next visit starts again.
    return () => {
      cancelled = true;
    };
  }, [enabled, url]);

  return state;
};
