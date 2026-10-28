// The plain-English sentence above the stats, e.g.
// "In 2024–25, 412 Theatre grants in the North totalled £6.1m, with a median award of £24k."

import { formatFY } from "./fiscal";
import { formatAmount, formatGBP, formatISODate } from "./format";
import type { FilterState } from "./filters";
import type { Stats } from "./aggregate";
import { QUINTILE_LABELS } from "./places";

/** "a", "a and b", "a, b and c". */
export const listText = (items: readonly string[], conjunction = "and"): string =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;

const MAX_LISTED = 3;
const placeName = (area: string) => (area === "London" ? "London" : `the ${area}`);
const quoted = (values: readonly string[]) => values.map((v) => `“${v}”`);

const timePhrase = (f: FilterState): string => {
  const parts: string[] = [];
  if (f.years.length > MAX_LISTED) parts.push(`In ${f.years.length} funding years`);
  else if (f.years.length > 0) parts.push(`In ${listText([...f.years].sort().map(formatFY))}`);
  if (f.dateFrom && f.dateTo) parts.push(`between ${formatISODate(f.dateFrom)} and ${formatISODate(f.dateTo)}`);
  else if (f.dateFrom) parts.push(`from ${formatISODate(f.dateFrom)}`);
  else if (f.dateTo) parts.push(`up to ${formatISODate(f.dateTo)}`);
  if (parts.length === 0) return "Across all funding years";
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const amountPhrase = (over: number | null, upTo: number | null): string | null => {
  if (over !== null && upTo !== null) return `of more than ${formatGBP(over)} and up to ${formatGBP(upTo)}`;
  if (over !== null) return `of more than ${formatGBP(over)}`;
  if (upTo !== null) return `of up to ${formatGBP(upTo)}`;
  return null;
};

const TYPE_TEXT = { organisation: "organisations", individual: "individuals", unknown: "recipients whose type is unclear" };

export const describeView = (f: FilterState, stats: Stats, groupLabel: (id: string) => string = (id) => id): string => {
  const time = timePhrase(f);
  if (stats.count === 0) return `${time}, no grants match these filters.`;

  const n = stats.count.toLocaleString("en-GB");
  const noun = stats.count === 1 ? "grant" : "grants";
  let subject: string;
  if (f.disciplines.length === 1 && f.disciplines[0] === "Not discipline specific") {
    subject = `${n} ${noun} not specific to one discipline`;
  } else if (f.disciplines.length > MAX_LISTED) {
    subject = `${n} ${noun} across ${f.disciplines.length} disciplines`;
  } else if (f.disciplines.length > 0) {
    const names = f.disciplines.map((d) => (d === "Not discipline specific" ? "non-discipline-specific" : d));
    subject = `${n} ${listText(names)} ${noun}`;
  } else {
    subject = `${n} ${noun}`;
  }

  const q = f.q.trim();
  const place =
    f.localAuthorities.length > MAX_LISTED ? `in ${f.localAuthorities.length} local authorities`
    : f.localAuthorities.length > 0 ? `in ${listText(f.localAuthorities)}`
    : f.areas.length > MAX_LISTED ? `in ${f.areas.length} areas`
    : f.areas.length > 0 ? `in ${listText(f.areas.map(placeName))}`
    : null;
  const strands =
    f.strands.length > MAX_LISTED ? `in ${f.strands.length} strands`
    : f.strands.length === 1 ? `in the “${f.strands[0]}” strand`
    : f.strands.length > 1 ? `in the ${listText(quoted(f.strands), "or")} strands`
    : null;
  const priorities =
    f.priorities.length > MAX_LISTED ? `under ${f.priorities.length} priorities`
    : f.priorities.length === 1 ? `under the “${f.priorities[0]}” priority`
    : f.priorities.length > 1 ? `under the ${listText(quoted(f.priorities), "or")} priorities`
    : null;

  const placeGroups =
    f.placeGroups.length === 1
      ? f.placeGroups[0] === "outside"
        ? "outside the designated places"
        : `in ${groupLabel(f.placeGroups[0])}`
      : f.placeGroups.length > 1
        ? `in ${f.placeGroups.length} groups of designated places`
        : null;
  const deprivation =
    f.deprivation.length === 1
      ? `in districts in the ${(QUINTILE_LABELS[f.deprivation[0]] ?? "").toLowerCase()}`
      : f.deprivation.length > 1
        ? `in districts in ${f.deprivation.length} deprivation fifths`
        : null;

  const qualifiers = [
    f.recipientTypes.length > 0 && f.recipientTypes.length < 3 && `to ${listText(f.recipientTypes.map((t) => TYPE_TEXT[t]))}`,
    place,
    placeGroups,
    deprivation,
    strands,
    priorities,
    amountPhrase(f.amountOver, f.amountUpTo),
    q &&
      `matching “${q}”${f.searchIn === "recipient" ? " in recipient names" : f.searchIn === "activity" ? " in project titles" : ""}`
  ].filter(Boolean);

  const total = formatAmount(stats.totalAwarded);
  const outcome =
    stats.count === 1 ? `was for ${total}` : `totalled ${total}, with a median award of ${formatAmount(stats.medianAward)}`;

  return `${time}, ${[subject, ...qualifiers].join(" ")} ${outcome}.`;
};
