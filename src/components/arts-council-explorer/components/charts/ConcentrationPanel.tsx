import { formatAmount } from "../../lib/format";
import type { Aggregates, RecipientTotal } from "../../lib/aggregate";
import { FOCUS_RING } from "../ui";

const ShareCard = ({ label, share }: { label: string; share: number }) => (
  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
    <h4 className="text-[11px] font-mono uppercase text-white/70">{label}</h4>
    <p className="text-xl font-light text-white mt-1">{share}%</p>
    <div className="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden" aria-hidden="true">
      <div className="bg-teal-400 h-full rounded-full" style={{ width: `${share}%` }} />
    </div>
  </div>
);

export const ConcentrationPanel = ({
  concentration,
  leaderboard,
  onOpenRecipient
}: {
  concentration: Aggregates["concentration"];
  leaderboard: readonly RecipientTotal[];
  onOpenRecipient: (key: string) => void;
}) => {
  const top = leaderboard[0]?.totalAmount || 1;
  return (
    <section aria-labelledby="ace-concentration" className="p-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col h-full">
      <div className="mb-6">
        <h3 id="ace-concentration" className="text-sm font-semibold tracking-wide uppercase text-white/85 font-mono">
          Funding Concentration
        </h3>
        <p className="text-xs text-white/65 mt-1">Share of funding held by the most-funded recipients in view.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <ShareCard label="Top 1% of recipients" share={concentration.top1PctShare} />
        <ShareCard label="Top 10% of recipients" share={concentration.top10PctShare} />
      </div>

      <h4 className="text-[11px] font-mono uppercase font-bold text-white/70 tracking-wider mb-3">Top 10 Recipients</h4>
      <ol className="space-y-3 flex-1 overflow-y-auto max-h-[240px] pr-1" data-testid="leaderboard">
        {leaderboard.map((item, index) => (
          <li key={item.key} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
            <div className="flex justify-between items-start gap-2">
              <button
                type="button"
                onClick={() => onOpenRecipient(item.key)}
                title={`Open the profile of ${item.recipient}`}
                className={`text-left text-xs font-medium text-white truncate max-w-[160px] hover:underline rounded cursor-pointer ${FOCUS_RING}`}
              >
                {index + 1}. {item.recipient}
              </button>
              <span className="text-xs font-mono font-bold text-white">{formatAmount(item.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-white/65 font-mono">
              <span>
                {item.count} {item.count === 1 ? "grant" : "grants"}
              </span>
              <span>Avg {formatAmount(Math.round(item.totalAmount / item.count))}</span>
            </div>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden" aria-hidden="true">
              <div className="bg-white/50 h-full rounded-full" style={{ width: `${Math.round((item.totalAmount / top) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
