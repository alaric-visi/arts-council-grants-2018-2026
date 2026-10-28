import { cleanText } from "./text";
import { canonicalDiscipline, canonicalStrand } from "./taxonomy";
import { inferRecipientType, recipientKey } from "./recipients";
import { currentLocalAuthority } from "./local-authorities";
import { fyFromISODate, fyQuarterOfISODate, monthOfISODate } from "./fiscal";
import { assignGrantIds } from "./ids";
import type { Grant, RecipientType } from "./types";

const RECIPIENT_TYPES = new Set<RecipientType>(["organisation", "individual", "unknown"]);

/**
 * Cleans raw rows from any source (Supabase, legacy JSON, props) using the
 * same rules as the data pipeline. Derived fields already present (for
 * example from a pipeline-built Supabase import) are kept as they are.
 * Rows without a valid amount, date-derived or explicit funding year are dropped.
 */
export const normaliseGrants = (rows: readonly unknown[]): Grant[] => {
  const grants: Grant[] = [];
  let dropped = 0;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") {
      dropped += 1;
      continue;
    }
    const row = raw as Record<string, unknown>;
    const amount = typeof row.award_amount === "number" ? row.award_amount : Number(row.award_amount);
    const awardDate = cleanText(row.award_date) ?? "";
    const fundingYear =
      cleanText(row.funding_year)?.replace(/[\u2013\u2014]/g, "-") ?? fyFromISODate(awardDate);
    if (!Number.isFinite(amount) || !fundingYear) {
      dropped += 1;
      continue;
    }

    const recipient = cleanText(row.recipient) ?? "Unknown recipient";
    const localAuthority = cleanText(row.local_authority);
    const presetType = row.recipient_type as RecipientType;

    grants.push({
      id: row.id !== null && row.id !== undefined ? String(row.id) : undefined,
      uid: "",
      recipient,
      recipient_key: cleanText(row.recipient_key) ?? recipientKey(recipient),
      recipient_type: RECIPIENT_TYPES.has(presetType) ? presetType : inferRecipientType(recipient),
      activity_name: cleanText(row.activity_name) ?? "",
      award_amount: amount,
      award_date: awardDate,
      decision_month: cleanText(row.decision_month) ?? monthOfISODate(awardDate),
      decision_quarter: cleanText(row.decision_quarter) ?? fyQuarterOfISODate(awardDate),
      ace_area: cleanText(row.ace_area),
      local_authority: localAuthority,
      local_authority_current:
        cleanText(row.local_authority_current) ?? (localAuthority ? currentLocalAuthority(localAuthority) : null),
      la_code: cleanText(row.la_code),
      main_discipline: canonicalDiscipline(row.main_discipline)?.label ?? null,
      strand: canonicalStrand(row.strand)?.label ?? null,
      time_limited_priority: cleanText(row.time_limited_priority),
      funding_year: fundingYear,
      source_file: cleanText(row.source_file) ?? undefined
    });
  }

  if (dropped > 0) {
    console.warn(`Dropped ${dropped} grant rows with a missing amount or funding year.`);
  }
  return assignGrantIds(grants);
};
