import { ArrowLeft } from "lucide-react";

export const BackLink = ({ href = "/tools", label = "Back to Tools" }: { href?: string; label?: string }) => (
  <a
    href={href}
    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white/60 hover:text-white transition-colors px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex-shrink-0"
    title={label}
  >
    <span aria-hidden="true">←</span>
    <span>{label}</span>
  </a>
);
