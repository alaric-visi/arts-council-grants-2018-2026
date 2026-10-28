/** Trims and collapses whitespace. Empty or missing values become null. */
export const cleanText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
};

/** Lowercase, accent-free form for comparisons. */
export const foldText = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
