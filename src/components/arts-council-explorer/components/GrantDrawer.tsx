import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link2, X } from "lucide-react";
import { formatFY } from "../lib/fiscal";
import { formatAmount, formatGBP, formatISODate } from "../lib/format";
import type { Grant } from "../lib/types";
import { FOCUS_RING } from "./ui";

const TYPE_TEXT = {
  organisation: "Organisation",
  individual: "Individual",
  unknown: "Unclear from the name"
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="py-2.5 grid grid-cols-[9rem_1fr] gap-3 border-b border-white/10">
    <dt className="text-[11px] uppercase font-mono tracking-wider text-white/65 pt-0.5">{label}</dt>
    <dd className="text-sm text-white/90">{children}</dd>
  </div>
);

const PROFILE_LINK = `text-left underline decoration-white/30 underline-offset-2 hover:decoration-white rounded cursor-pointer ${FOCUS_RING}`;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Detail panel for one grant: a modal dialog that traps focus, closes on
 * Escape or a click outside, and returns focus to where it was opened from.
 */
export const GrantDrawer = ({
  grant,
  history,
  shareUrl,
  onClose,
  onOpen,
  onShowRecipient,
  onOpenProfile
}: {
  grant: Grant;
  /** All grants to the same recipient, newest first. */
  history: readonly Grant[];
  shareUrl: string;
  onClose: () => void;
  onOpen: (uid: string) => void;
  onShowRecipient: (name: string) => void;
  onOpenProfile: (kind: "recipient" | "place" | "discipline", id: string) => void;
}) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  // Focus the panel on open; give focus back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  useEffect(() => {
    setCopied(false);
    panel.current?.scrollTo?.({ top: 0 });
  }, [grant.uid]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const others = history.filter((g) => g.uid !== grant.uid);
  const historyTotal = history.reduce((sum, g) => sum + g.award_amount, 0);
  const laChanged = grant.local_authority && grant.local_authority_current && grant.local_authority_current !== grant.local_authority;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm motion-safe:animate-none" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg h-full overflow-y-auto bg-black/95 backdrop-blur-xl border-l border-white/10 p-6 md:p-8 text-white"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase font-mono tracking-wider text-white/50">Grant</p>
            <h2 id={titleId} className="text-2xl font-semibold leading-tight mt-1 text-white">
              {grant.recipient}
            </h2>
            <p className="text-white/70 text-sm mt-2">{grant.activity_name || "No activity name recorded"}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close grant details"
            className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white cursor-pointer transition-colors ${FOCUS_RING}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-4xl font-light tracking-tight mt-6">{formatGBP(grant.award_amount)}</p>

        <dl className="mt-6">
          <Row label="Award date">{grant.award_date ? formatISODate(grant.award_date) : "—"}</Row>
          <Row label="Funding year">{formatFY(grant.funding_year)}</Row>
          <Row label="Decision">{[grant.decision_month, grant.decision_quarter && `${grant.decision_quarter} of the financial year`].filter(Boolean).join(", ") || "—"}</Row>
          <Row label="ACE area">{grant.ace_area ?? "—"}</Row>
          <Row label="Local authority">
            {grant.local_authority_current ? (
              <button type="button" onClick={() => onOpenProfile("place", grant.local_authority_current!)} className={PROFILE_LINK}>
                {grant.local_authority}
              </button>
            ) : (
              grant.local_authority ?? "—"
            )}
            {laChanged && <span className="block text-white/70 text-xs mt-0.5">Now part of {grant.local_authority_current}</span>}
            {grant.la_code && <span className="block text-white/70 text-xs mt-0.5 font-mono">ONS {grant.la_code}</span>}
          </Row>
          <Row label="Discipline">
            {grant.main_discipline ? (
              <button type="button" onClick={() => onOpenProfile("discipline", grant.main_discipline!)} className={PROFILE_LINK}>
                {grant.main_discipline}
              </button>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Strand">{grant.strand ?? "—"}</Row>
          <Row label="Priority">{grant.time_limited_priority ?? "None"}</Row>
          <Row label="Recipient type">
            {TYPE_TEXT[grant.recipient_type]}
            <span className="block text-white/70 text-xs mt-0.5">Inferred from the name, so it can be wrong.</span>
          </Row>
          {grant.source_file && (
            <Row label="Source">
              <span className="break-words">{grant.source_file}</span>
            </Row>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={copyLink}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/80 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
          >
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            Copy link to this grant
          </button>
          <span role="status" className="self-center text-xs text-emerald-400 font-mono">
            {copied ? "Link copied" : ""}
          </span>
        </div>

        <section className="mt-8" aria-labelledby={`${titleId}-history`}>
          <h3 id={`${titleId}-history`} className="text-[11px] uppercase font-mono tracking-wider text-white/50">
            All grants to this recipient
          </h3>
          <p className="text-xs text-white/70 mt-1.5">
            {history.length.toLocaleString("en-GB")} {history.length === 1 ? "grant" : "grants"} totalling {formatAmount(historyTotal)}, across
            all years and areas.
          </p>
          {others.length > 0 && (
            <ul className="mt-3 space-y-2">
              {others.slice(0, 8).map((g) => (
                <li key={g.uid}>
                  <button
                    type="button"
                    onClick={() => onOpen(g.uid)}
                    className={`w-full text-left p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 cursor-pointer transition-colors ${FOCUS_RING}`}
                  >
                    <span className="flex justify-between gap-3 text-xs">
                      <span className="text-white truncate">{g.activity_name || "Untitled"}</span>
                      <span className="font-mono text-white shrink-0">{formatAmount(g.award_amount)}</span>
                    </span>
                    <span className="block text-[11px] text-white/50 font-mono mt-1">{formatFY(g.funding_year)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => onOpenProfile("recipient", grant.recipient_key)}
            className={`mt-4 mr-4 text-xs font-mono underline text-white hover:text-white rounded cursor-pointer ${FOCUS_RING}`}
          >
            Open the recipient’s profile
          </button>
          {history.length > 1 && (
            <button
              type="button"
              onClick={() => onShowRecipient(grant.recipient)}
              className={`mt-4 text-xs font-mono underline text-white/80 hover:text-white rounded cursor-pointer ${FOCUS_RING}`}
            >
              Search the grants list for “{grant.recipient}”
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
