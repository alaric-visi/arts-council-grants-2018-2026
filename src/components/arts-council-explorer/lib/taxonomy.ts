// Canonical labels for ACE disciplines and strands.
//
// ACE's spreadsheets spell the same category differently between years
// ("Digital Arts" vs "Visual arts", "£30,000 and under" vs "£30,000 and below").
// These rules only fix spelling. They never merge categories that are really
// different: "£15,000 and below" (earlier rounds) and "£30,000 and below"
// (later rounds) were genuinely different strands and stay separate.
//
// Values no rule recognises are kept as cleaned text and reported by the
// pipeline (known: false), so new categories surface instead of vanishing.

import { cleanText } from "./text";

export interface CanonicalLabel {
  label: string;
  known: boolean;
}

const lookupKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Disciplines
// ---------------------------------------------------------------------------

const DISCIPLINES = [
  "Combined arts",
  "Dance",
  "Digital arts",
  "Libraries",
  "Literature",
  "Museums",
  "Music",
  "Not discipline specific",
  "Theatre",
  "Visual arts"
] as const;

const DISCIPLINE_SYNONYMS: Record<string, string> = {
  "combined art": "Combined arts",
  "digital art": "Digital arts",
  digital: "Digital arts",
  library: "Libraries",
  museum: "Museums",
  "visual art": "Visual arts",
  "not discipline-specific": "Not discipline specific",
  "non discipline specific": "Not discipline specific",
  "non-discipline specific": "Not discipline specific"
};

const DISCIPLINE_INDEX: Record<string, string> = Object.fromEntries([
  ...DISCIPLINES.map((label) => [lookupKey(label), label]),
  ...Object.entries(DISCIPLINE_SYNONYMS)
]);

export const canonicalDiscipline = (value: unknown): CanonicalLabel | null => {
  const text = cleanText(value);
  if (!text) return null;
  const known = DISCIPLINE_INDEX[lookupKey(text)];
  if (known) return { label: known, known: true };
  // Unknown: sentence case so case variants of a new label still group together.
  return { label: text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(), known: false };
};

// ---------------------------------------------------------------------------
// Strands
// ---------------------------------------------------------------------------

const poundFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const parsePounds = (digits: string, thousands: string | undefined): number =>
  Number(digits.replace(/,/g, "")) * (thousands ? 1000 : 1);

const pounds = (amount: number): string => `£${poundFormat.format(amount)}`;

const AMOUNT = String.raw`£\s?([\d,]+)(k)?`;

const STRAND_RULES: Array<{ pattern: RegExp; label: (m: RegExpMatchArray) => string }> = [
  {
    // "£30,000 and below", "£30,000 and under", "£30k or less"
    pattern: new RegExp(`^${AMOUNT} (?:and|or) (?:below|under|less)$`),
    label: (m) => `${pounds(parsePounds(m[1], m[2]))} and below`
  },
  {
    // "Up to £30,000"
    pattern: new RegExp(`^up to ${AMOUNT}$`),
    label: (m) => `${pounds(parsePounds(m[1], m[2]))} and below`
  },
  {
    // "Above £30,000 - Major Project", "Over £30,000 – major projects"
    pattern: new RegExp(`^(?:above|over|more than) ${AMOUNT} ?-? ?major projects?$`),
    label: (m) => `Above ${pounds(parsePounds(m[1], m[2]))} (major project)`
  },
  {
    // "Above £30,000", "Over £30,000"
    pattern: new RegExp(`^(?:above|over|more than) ${AMOUNT}$`),
    label: (m) => `Above ${pounds(parsePounds(m[1], m[2]))}`
  },
  {
    pattern: /^grassroots (?:live )?music$/,
    label: () => "Grassroots music"
  }
];

export const canonicalStrand = (value: unknown): CanonicalLabel | null => {
  const text = cleanText(value);
  if (!text) return null;
  const key = lookupKey(text);
  for (const rule of STRAND_RULES) {
    const match = key.match(rule.pattern);
    if (match) return { label: rule.label(match), known: true };
  }
  return { label: text.replace(/\s*[\u2013\u2014]\s*/g, " - "), known: false };
};
