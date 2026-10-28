// Public entry point.
export { ArtsCouncilExplorer, DEFAULT_DATA_URLS } from "./ArtsCouncilExplorer";
export type { ArtsCouncilExplorerProps } from "./ArtsCouncilExplorer";
export { default } from "./ArtsCouncilExplorer";
export type { DataSource, DatasetMeta, Grant, GrantRecord, RecipientType } from "./lib/types";
export { normaliseGrants } from "./lib/normalise";
export { decodeCompact, encodeCompact, isCompactDataset } from "./lib/compact";
export { aggregateGrants, buildYearTrend, crossfilter, SIZE_BRACKETS } from "./lib/aggregate";
export { describeView } from "./lib/summary";
export { formatAmount, formatGBP, formatISODate } from "./lib/format";
export { formatFY, isFYInProgress } from "./lib/fiscal";
export { buildGrantsCsv } from "./lib/csv";
