// Stable grant ids for deep links (?grant=…), derived from content so they
// cost nothing in the dataset file and survive rebuilds: the same grant gets
// the same id whatever source it was loaded from. Exact duplicates get -2, -3…

import type { Grant } from "./types";

/** cyrb53: fast 53-bit string hash with good distribution. */
const cyrb53 = (text: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

type IdFields = Pick<Grant, "recipient_key" | "activity_name" | "award_amount" | "award_date" | "funding_year">;

export const grantContentId = (g: IdFields): string =>
  cyrb53([g.recipient_key, g.activity_name.toLowerCase(), g.award_amount, g.award_date, g.funding_year].join("\u0000"))
    .toString(36)
    .padStart(11, "0");

/** Sets uid on each grant, in place. */
export const assignGrantIds = <T extends IdFields & { uid: string }>(grants: T[]): T[] => {
  const seen = new Map<string, number>();
  for (const grant of grants) {
    const base = grantContentId(grant);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    grant.uid = n === 1 ? base : `${base}-${n}`;
  }
  return grants;
};
