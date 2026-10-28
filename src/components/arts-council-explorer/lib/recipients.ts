import { foldText } from "./text";
import type { RecipientType } from "./types";

/**
 * Grouping key for a recipient name. Treats these as the same recipient:
 * case, accents, whitespace, punctuation ("St. Mary's" / "St Marys"),
 * "&" / "and", and "Limited" / "Ltd".
 *
 * It deliberately does not merge "Foo" with "Foo Ltd" or "The Foo" with
 * "Foo": those may be different legal entities. The pipeline lists such
 * near-matches for review instead (see looseRecipientKey).
 */
export const recipientKey = (name: string): string => {
  const key = foldText(name)
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/&/g, " and ")
    .replace(/['.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\s+/g, " ")
    .trim();
  return key || name.toLowerCase().trim();
};

const LEGAL_SUFFIX = /\s+(?:ltd|cic|cio|llp|plc|inc|uk|and co)$/;

/** Looser key used only to suggest possible duplicates for human review. */
export const looseRecipientKey = (name: string): string => {
  let key = recipientKey(name).replace(/^the\s+/, "");
  while (LEGAL_SUFFIX.test(key)) key = key.replace(LEGAL_SUFFIX, "");
  return key;
};

// ---------------------------------------------------------------------------
// Recipient type (inferred)
//
// ACE's data doesn't say whether a recipient is a person or an organisation.
// These rules guess from the name and answer "unknown" rather than guess
// when a name gives nothing to go on. Two-word company names that look like
// personal names ("Joli Vyann" is a circus company) will be misread.
// ---------------------------------------------------------------------------

const ORGANISATION_WORDS = new Set(
  (
    "ltd limited cic cio llp plc inc trust trustees theatre theater theatres company festival festivals " +
    "council borough society association collective ensemble orchestra orchestras choir chorus band " +
    "museum museums gallery galleries library libraries archive archives productions production records " +
    "recordings foundation university college school academy centre center centres network partnership " +
    "agency project projects press publishing publishers studio studios arts dance music poetry opera " +
    "circus cinema film films media radio magazine books events entertainment group club hub forum " +
    "alliance consortium federation guild institute board services community communities charity " +
    "church cathedral heritage pride carnival puppets players singers youth lab labs factory partners " +
    "initiative programme foundation collaborative consort quartet trio"
  ).split(" ")
);

/** First words that are almost never a person's given name. */
const NON_NAME_FIRST_WORDS = new Set(
  (
    "the a an our my your we all little strange downtown thunder old new big red blue black white green " +
    "golden silver wild dark bright open free hidden lost secret electric urban rural north south east " +
    "west northern southern eastern western first last future futures dream dreams road street city town " +
    "village world global local national british english one two three four five six seven eight nine ten"
  ).split(" ")
);

const NAME_PARTICLES = new Set(["de", "del", "della", "der", "den", "van", "von", "da", "di", "du", "le", "la", "bin", "binti", "al", "el", "ap"]);

const NAME_TOKEN = /^\p{L}[\p{L}'\u2019.-]*$/u;

export const inferRecipientType = (name: string): RecipientType => {
  const tidy = name.replace(/\s+-\s+/g, "-").trim();
  const tokens = tidy.split(/\s+/).filter(Boolean);
  const words = tokens.map((t) => foldText(t).replace(/[^\p{L}\p{N}]/gu, ""));

  if (words.some((w) => ORGANISATION_WORDS.has(w))) return "organisation";
  if (/\d/.test(tidy)) return "organisation";
  if (tokens.length === 1) {
    // An all-caps single word is usually an acronym ("FOSPL").
    return /^[\p{Lu}\d]{2,}$/u.test(tokens[0]) ? "organisation" : "unknown";
  }
  if (NON_NAME_FIRST_WORDS.has(words[0])) return "organisation";
  // "Bertrand Lesca & Nasi Voutsas" is two people; "Cat and Mouse" isn't.
  if (/&|\band\b/i.test(tidy)) return "unknown";

  const nameWords = words.filter((w) => !NAME_PARTICLES.has(w));
  if (
    nameWords.length >= 2 &&
    nameWords.length <= 4 &&
    tokens.every((t) => NAME_TOKEN.test(t))
  ) {
    return "individual";
  }
  return "unknown";
};
