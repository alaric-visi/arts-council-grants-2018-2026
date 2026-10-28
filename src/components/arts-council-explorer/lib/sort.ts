const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

/** Missing values always sort last, whichever direction is chosen. */
export const compareValues = (a: unknown, b: unknown, order: "asc" | "desc"): number => {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const result =
    typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
  return order === "asc" ? result : -result;
};
