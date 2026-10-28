// Accent- and case-insensitive search, plus match positions for highlighting.

import { foldText } from "./text";
import type { Grant } from "./types";

export type SearchScope = "all" | "recipient" | "activity";

const cache = new WeakMap<Grant, { recipient: string; activity: string }>();

/** Folded recipient and activity text, computed once per grant. */
export const searchText = (grant: Grant) => {
  let entry = cache.get(grant);
  if (!entry) {
    entry = { recipient: foldText(grant.recipient), activity: foldText(grant.activity_name) };
    cache.set(grant, entry);
  }
  return entry;
};

export const matchesSearch = (grant: Grant, foldedQuery: string, scope: SearchScope): boolean => {
  if (!foldedQuery) return true;
  const text = searchText(grant);
  return (
    (scope !== "activity" && text.recipient.includes(foldedQuery)) ||
    (scope !== "recipient" && text.activity.includes(foldedQuery))
  );
};

/**
 * Where the query matches in the original text, as [start, end) ranges.
 * "cafe" finds "Café", "CAFE" and "café".
 */
export const matchRanges = (text: string, query: string): Array<[number, number]> => {
  const q = foldText(query.trim());
  if (!q) return [];

  let folded = "";
  const origin: number[] = []; // origin[i] = index in `text` of folded character i
  for (let i = 0; i < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const f = foldText(char);
    for (let k = 0; k < f.length; k += 1) origin.push(i);
    folded += f;
    i += char.length;
  }
  origin.push(text.length);

  const ranges: Array<[number, number]> = [];
  for (let at = folded.indexOf(q); at !== -1; at = folded.indexOf(q, at + q.length)) {
    ranges.push([origin[at], origin[at + q.length]]);
  }
  return ranges;
};
