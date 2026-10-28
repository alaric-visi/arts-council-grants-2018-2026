import type { Topology } from "topojson-specification";

// The map file written by the pipeline (la-map.v1.json): English local
// authority district boundaries as TopoJSON with an object "lads" whose
// features have properties { code, name }.

export const MAP_FORMAT = "ace-la-map";
export const MAP_VERSION = 1;

export interface MapFile {
  format: typeof MAP_FORMAT;
  version: number;
  /** "bng": British National Grid metres; "wgs84": longitude/latitude degrees. */
  crs: "wgs84" | "bng";
  /** File the boundaries came from. */
  source: string;
  topology: Topology;
}

export const isMapFile = (value: unknown): value is MapFile =>
  Boolean(value) &&
  typeof value === "object" &&
  (value as MapFile).format === MAP_FORMAT &&
  (value as MapFile).version === MAP_VERSION &&
  Boolean((value as MapFile).topology?.objects?.lads);
