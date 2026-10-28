// minimumFractionDigits is set explicitly: some older engines throw a
// RangeError when maximumFractionDigits is below the currency default of 2.
const gbpCompact = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});
const gbpFull = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

/** Compact amount for cards and axes, e.g. "£14.4k", "£1.2m". */
export const formatAmount = (value: number): string => gbpCompact.format(value);

/** Exact amount for tooltips and tables, e.g. "£14,400". */
export const formatGBP = (value: number): string => gbpFull.format(value);

/** "2026-04-08" → "8 Apr 2026" */
export const formatISODate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : shortDate.format(date);
};
