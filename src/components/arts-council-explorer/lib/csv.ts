import type { GrantRecord } from "./types";

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => unknown;
}

// Spreadsheet apps treat text starting with these characters as a formula.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

/** RFC 4180 CSV with a UTF-8 byte-order mark so Excel reads accented names correctly. */
export const toCsv = <T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>, { bom = true } = {}): string => {
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(","));
  return `${bom ? "\uFEFF" : ""}${[header, ...lines].join("\r\n")}`;
};

export const GRANT_EXPORT_COLUMNS: ReadonlyArray<CsvColumn<GrantRecord>> = [
  { label: "Recipient", value: (r) => r.recipient },
  { label: "Activity Name", value: (r) => r.activity_name },
  { label: "Award Amount", value: (r) => r.award_amount },
  { label: "Award Date", value: (r) => r.award_date },
  { label: "Decision Month", value: (r) => r.decision_month },
  { label: "Decision Quarter", value: (r) => r.decision_quarter },
  { label: "ACE Area", value: (r) => r.ace_area },
  { label: "Local Authority", value: (r) => r.local_authority },
  { label: "Main Discipline", value: (r) => r.main_discipline },
  { label: "Strand", value: (r) => r.strand },
  { label: "Time-Limited Priority", value: (r) => r.time_limited_priority },
  { label: "Funding Year", value: (r) => r.funding_year }
];

/** The grants export offered in the UI. */
export const buildGrantsCsv = (rows: readonly GrantRecord[]): string => toCsv(rows, GRANT_EXPORT_COLUMNS);

/**
 * Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF or LF,
 * leading BOM). Used by the pipeline for CSV inputs and the ONS lookup.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
};
