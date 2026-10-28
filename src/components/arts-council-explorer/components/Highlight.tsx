import { matchRanges } from "../lib/search";

/** Text with search matches marked. */
export const Highlight = ({ text, query }: { text: string; query: string }) => {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={i} className="bg-teal-400/30 text-white rounded-sm">
        {text.slice(start, end)}
      </mark>
    );
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
};
