import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { geoIdentity, geoMercator, geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { NamedAmount } from "../lib/aggregate";
import type { MapMetric } from "../lib/filters";
import { formatAmount, formatGBP } from "../lib/format";
import { localAuthorityKey } from "../lib/local-authorities";
import type { MapFile } from "../lib/map-format";
import type { MapStatus } from "../data/useMapData";
import { formatPerPerson, perPerson } from "../lib/places";
import type { PlaceIndex } from "../lib/places";
import { toCsv } from "../lib/csv";
import { ChartCard, ChartTable, FilterButton, FOCUS_RING, SegmentedToggle } from "./ui";

type LadFeature = Feature<Geometry, { code: string; name: string }>;

const WIDTH = 600;
const HEIGHT = 760;
/** Light-to-dark is low-to-high: a sequential teal scale, readable on the dark background. */
const RAMP = ["#134e4a", "#0f766e", "#0d9488", "#2dd4bf", "#99f6e4"];
const NO_GRANTS = "#26262b";

const METRICS = [
  { value: "total", label: "Funding" },
  { value: "count", label: "Grants" },
  { value: "perCapita", label: "Per resident" }
] as const;

interface PlaceValue {
  name: string;
  amount: number;
  count: number;
  perPerson: number | null;
}

const metricValue = (p: PlaceValue, metric: MapMetric) =>
  metric === "total" ? p.amount : metric === "count" ? p.count : p.perPerson;

const formatMetric = (v: number | null, metric: MapMetric) =>
  v === null ? "—" : metric === "total" ? formatAmount(v) : metric === "count" ? v.toLocaleString("en-GB") : formatPerPerson(v);

/** Quintile breaks over the values present. */
const breaksOf = (values: number[]): number[] => {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return [1, 2, 3, 4].map((q) => sorted[Math.min(sorted.length - 1, Math.floor((q * sorted.length) / 5))]);
};
const classOf = (v: number, breaks: number[]) => breaks.filter((b) => v > b).length;

export const MapView = ({
  status,
  map,
  byLocalAuthority,
  places,
  metric,
  onMetricChange,
  selected,
  onToggle,
  onOpenProfile,
  outline = null,
  onOutlineChange = () => {}
}: {
  status: MapStatus;
  map: MapFile | null;
  byLocalAuthority: NamedAmount[];
  places: PlaceIndex;
  metric: MapMetric;
  onMetricChange: (metric: MapMetric) => void;
  selected: readonly string[];
  onToggle: (localAuthority: string) => void;
  onOpenProfile: (localAuthority: string) => void;
  /** Designation whose districts are outlined. */
  outline?: string | null;
  onOutlineChange?: (designation: string | null) => void;
}) => {
  const [hover, setHover] = useState<{ code: string; x: number; y: number; width: number } | null>(null);
  const effectiveMetric: MapMetric = metric === "perCapita" && !places.hasPopulations ? "total" : metric;

  const geo = useMemo(() => {
    if (!map) return null;
    const collection = feature(map.topology, map.topology.objects.lads) as unknown as FeatureCollection<Geometry, { code: string; name: string }>;
    const projection =
      map.crs === "bng"
        ? geoIdentity().reflectY(true).fitExtent([[10, 10], [WIDTH - 10, HEIGHT - 10]], collection as GeoPermissibleObjects)
        : geoMercator().fitExtent([[10, 10], [WIDTH - 10, HEIGHT - 10]], collection as GeoPermissibleObjects);
    const path = geoPath(projection);
    const borders = path(mesh(map.topology, map.topology.objects.lads as never, (a, b) => a !== b) as GeoPermissibleObjects) ?? "";
    const features = collection.features.map((f: LadFeature) => ({ code: f.properties.code, name: f.properties.name, d: path(f) ?? "" }));
    const codeByKey = new Map(features.map((f) => [localAuthorityKey(f.name), f.code]));
    return { features, borders, codeByKey };
  }, [map]);

  const values = useMemo(
    () =>
      byLocalAuthority.map((la) => ({
        name: la.name,
        amount: la.amount,
        count: la.count,
        perPerson: perPerson(la.amount, places.population(la.name))
      })),
    [byLocalAuthority, places]
  );

  // Join places in the data to map features: ONS code first, then name.
  const byCode = useMemo(() => {
    const result = new Map<string, PlaceValue>();
    const unmatched: string[] = [];
    if (geo) {
      for (const v of values) {
        const code = places.code(v.name) ?? geo.codeByKey.get(localAuthorityKey(v.name)) ?? null;
        if (code && geo.features.some((f) => f.code === code)) result.set(code, v);
        else unmatched.push(v.name);
      }
    }
    return { result, unmatched };
  }, [geo, values, places]);

  const breaks = useMemo(
    () => breaksOf(values.map((v) => metricValue(v, effectiveMetric) ?? 0)),
    [values, effectiveMetric]
  );
  // Districts in the outlined designation: by code, falling back to name.
  const outlined = useMemo(() => {
    if (!geo || !outline) return new Set<string>();
    return new Set(geo.features.filter((f) => places.groupsOf(f.name).includes(outline)).map((f) => f.code));
  }, [geo, outline, places]);
  const ranked = [...values].sort((a, b) => (metricValue(b, effectiveMetric) ?? -1) - (metricValue(a, effectiveMetric) ?? -1));
  const hovered = hover ? byCode.result.get(hover.code) ?? null : null;
  const hoveredName = hover && geo ? geo.features.find((f) => f.code === hover.code)?.name ?? "" : "";

  const onMove = (event: MouseEvent<SVGPathElement>, code: string) => {
    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setHover({ code, x: event.clientX - box.left, y: event.clientY - box.top, width: box.width });
  };

  const legend = breaks.length
    ? RAMP.map((colour, i) => {
        const low = i === 0 ? 0 : breaks[i - 1];
        const high = breaks[i];
        return { colour, label: high === undefined ? `Over ${formatMetric(low, effectiveMetric)}` : `${i === 0 ? "Up to" : `${formatMetric(low, effectiveMetric)} to`} ${formatMetric(high, effectiveMetric)}` };
      })
    : [];

  const table = (
    <ChartTable
      caption="Local authorities ranked by the chosen measure"
      columns={[
        { label: "Local authority" },
        { label: "Funding", align: "right" },
        { label: "Grants", align: "right" },
        ...(places.hasPopulations ? [{ label: "Per resident", align: "right" as const }] : []),
        { label: "" },
        { label: "" }
      ]}
      rows={ranked.map((v) => ({
        key: v.name,
        selected: selected.includes(v.name),
        cells: [
          v.name,
          formatGBP(v.amount),
          v.count.toLocaleString("en-GB"),
          ...(places.hasPopulations ? [formatPerPerson(v.perPerson)] : []),
          <FilterButton selected={selected.includes(v.name)} label={v.name} onClick={() => onToggle(v.name)} />,
          <button
            type="button"
            onClick={() => onOpenProfile(v.name)}
            aria-label={`Open the profile of ${v.name}`}
            className={`px-2 py-0.5 rounded-full border border-white/20 text-[11px] font-mono text-white/80 hover:text-white cursor-pointer ${FOCUS_RING}`}
          >
            Profile
          </button>
        ]
      }))}
    />
  );

  return (
    <ChartCard
      title="Funding by Local Authority"
      exportName="funding-by-local-authority"
      imageExport={Boolean(geo)}
      csv={() =>
        toCsv(ranked, [
          { label: "Local authority", value: (v) => v.name },
          { label: "ONS code", value: (v) => places.code(v.name) },
          { label: "Funding (£)", value: (v) => v.amount },
          { label: "Grants", value: (v) => v.count },
          { label: "Per resident (£)", value: (v) => v.perPerson }
        ])
      }
      description={
        <>
          Each district on current boundaries, with your other filters applied. Select a district to filter by it, or use the table for
          profiles.
          {!places.hasPopulations && " Per-resident figures appear when the dataset is built with population estimates."}
        </>
      }
      actions={
        <SegmentedToggle
          label="Measure"
          options={places.hasPopulations ? METRICS : METRICS.filter((m) => m.value !== "perCapita")}
          value={effectiveMetric}
          onChange={onMetricChange}
        />
      }
      table={table}
    >
      {status === "loading" || status === "idle" ? (
        <p className="mt-6 text-sm text-white/70" role="status">
          Loading the map…
        </p>
      ) : !geo ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-white/75">
            The map isn’t available because this dataset was built without boundary data. The table shows the same figures.
          </p>
          {table}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_14rem] gap-6">
          <div className="relative" data-testid="map">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              width={WIDTH}
              height={HEIGHT}
              data-export-svg
              className="w-full h-auto max-h-[80vh]"
              aria-hidden="true"
              onMouseLeave={() => setHover(null)}
            >
              {geo.features.map((f) => {
                const v = byCode.result.get(f.code);
                const value = v ? metricValue(v, effectiveMetric) : null;
                const fill = value !== null && value > 0 ? RAMP[classOf(value, breaks)] : NO_GRANTS;
                const isSelected = v ? selected.includes(v.name) : false;
                return (
                  <path
                    key={f.code}
                    d={f.d}
                    fill={fill}
                    stroke={isSelected ? "#ffffff" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                    data-code={f.code}
                    className={v ? "cursor-pointer" : undefined}
                    onMouseMove={(e) => onMove(e, f.code)}
                    onClick={() => v && onToggle(v.name)}
                  />
                );
              })}
              <path d={geo.borders} fill="none" stroke="#0a0a0c" strokeWidth={0.6} pointerEvents="none" />
              {geo.features
                .filter((f) => outlined.has(f.code))
                .map((f) => (
                  <path key={`outline-${f.code}`} d={f.d} fill="none" stroke="#fbbf24" strokeWidth={1.6} pointerEvents="none" data-outline={f.code} />
                ))}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 px-3 py-2 rounded-lg bg-black/90 backdrop-blur-md border border-white/10 text-xs text-white shadow-xl"
                // Flip to the left of the cursor near the right edge so the tooltip stays on the map.
                style={{ left: hover.x + 240 > hover.width ? Math.max(0, hover.x - 236) : hover.x + 12, top: hover.y + 12 }}
              >
                <strong className="block">{hoveredName}</strong>
                {hovered ? (
                  <span className="font-mono">
                    {formatGBP(hovered.amount)}, {hovered.count.toLocaleString("en-GB")} {hovered.count === 1 ? "grant" : "grants"}
                    {hovered.perPerson !== null && `, ${formatPerPerson(hovered.perPerson)} per resident`}
                  </span>
                ) : (
                  <span className="text-white/70">No grants in view</span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="text-[11px] uppercase font-mono tracking-wider text-white/50 mb-2">
                {METRICS.find((m) => m.value === effectiveMetric)!.label}
              </h4>
              <ul className="space-y-1.5">
                {legend.map((l) => (
                  <li key={l.colour} className="flex items-center gap-2 text-white/85">
                    <span className="w-4 h-3 rounded-sm" style={{ background: l.colour }} aria-hidden="true" />
                    {l.label}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-white/85">
                  <span className="w-4 h-3 rounded-sm border border-white/20" style={{ background: NO_GRANTS }} aria-hidden="true" />
                  No grants in view
                </li>
              </ul>
              <p className="text-white/50 text-[11px] mt-2 font-mono">Five groups with roughly equal numbers of districts.</p>
            </div>
            {places.designations.length > 0 && (
              <div>
                <label htmlFor="ace-map-outline" className="block text-[11px] uppercase font-mono tracking-wider text-white/50 mb-2">
                  Outline
                </label>
                <select
                  id="ace-map-outline"
                  value={outline ?? ""}
                  onChange={(e) => onOutlineChange(e.target.value || null)}
                  className={`w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white [color-scheme:dark] ${FOCUS_RING}`}
                >
                  <option value="" className="bg-black">
                    None
                  </option>
                  {places.designations.map((d) => (
                    <option key={d.id} value={d.id} className="bg-black">
                      {places.groupLabel(d.id)}
                    </option>
                  ))}
                </select>
                {outline && (
                  <p className="flex items-center gap-2 text-white/85 mt-2">
                    <span className="w-4 h-3 rounded-sm border-2 border-[#fbbf24]" aria-hidden="true" />
                    {outlined.size} districts outlined
                  </p>
                )}
              </div>
            )}
            {selected.length > 0 && (
              <div>
                <h4 className="text-[11px] uppercase font-mono font-bold tracking-wider text-white/70 mb-2">Selected</h4>
                <ul className="space-y-1">
                  {selected.map((la) => (
                    <li key={la}>
                      <button
                        type="button"
                        onClick={() => onOpenProfile(la)}
                        className={`underline decoration-white/30 underline-offset-2 text-white hover:decoration-white rounded cursor-pointer ${FOCUS_RING}`}
                      >
                        {la}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {byCode.unmatched.length > 0 && (
              <p className="text-white/65">
                Not on this map: {byCode.unmatched.slice(0, 5).join(", ")}
                {byCode.unmatched.length > 5 ? ` and ${byCode.unmatched.length - 5} more` : ""}. They’re in the table.
              </p>
            )}
            <p className="text-white/65">
              Boundaries: {map!.source}. Source: Office for National Statistics, licensed under the Open Government Licence v3.0. Contains OS data
              © Crown copyright and database right.
            </p>
          </div>
        </div>
      )}
    </ChartCard>
  );
};

export default MapView;
