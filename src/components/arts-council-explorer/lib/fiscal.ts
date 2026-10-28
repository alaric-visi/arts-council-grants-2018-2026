// Financial years run from 1 April to 31 March and are written "2018-2019".

const FY_PATTERN = /^(\d{4})-(\d{4})$/;

export const fyStartYear = (fy: string): number | null => {
  const match = FY_PATTERN.exec(fy);
  return match ? Number(match[1]) : null;
};

/** "2018-2019" → "2018–19" */
export const formatFY = (fy: string): string => {
  const match = FY_PATTERN.exec(fy);
  return match ? `${match[1]}\u2013${match[2].slice(2)}` : fy;
};

export const previousFY = (fy: string): string | null => {
  const start = fyStartYear(fy);
  return start === null ? null : `${start - 1}-${start}`;
};

/** True until the end of the 31 March that closes the financial year. */
export const isFYInProgress = (fy: string, today: Date = new Date()): boolean => {
  const start = fyStartYear(fy);
  if (start === null) return false;
  const yearEnd = new Date(start + 1, 2, 31, 23, 59, 59, 999);
  return today.getTime() <= yearEnd.getTime();
};

/** "2019-05-01" → "2019-2020"; "2019-03-31" → "2018-2019". */
export const fyFromISODate = (iso: string): string | null => {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const start = Number(match[2]) >= 4 ? year : year - 1;
  return `${start}-${start + 1}`;
};

/**
 * Funding year from an ACE file name, which varies by year:
 * "…2018-19_0.xlsx", "…2019 20.xlsx", "…202021.xlsx", "…202526.xlsx".
 */
export const fyFromFileName = (fileName: string): string | null => {
  const pattern = /(20\d{2})[\s_-]?(\d{2})(?!\d)/g;
  for (const match of fileName.matchAll(pattern)) {
    const start = Number(match[1]);
    if (Number(match[2]) === (start + 1) % 100) return `${start}-${start + 1}`;
  }
  return null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** Calendar month name of an ISO date. */
export const monthOfISODate = (iso: string): string | null => {
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? MONTHS[month - 1] : null;
};

/** Financial-year quarter: April–June is Q1, January–March is Q4. */
export const fyQuarterOfISODate = (iso: string): string | null => {
  const month = Number(iso.slice(5, 7));
  if (!(month >= 1 && month <= 12)) return null;
  return `Q${Math.floor(((month - 4 + 12) % 12) / 3) + 1}`;
};

export const shiftISOYear = (iso: string, years: number): string =>
  `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 (UTC), used by the compact dataset format. */
export const isoToDay = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export const dayToISO = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
