const Block = ({ className }: { className: string }) => (
  <div className={`bg-white/[0.06] rounded-2xl motion-safe:animate-pulse ${className}`} aria-hidden="true" />
);

/** Placeholder shapes of the dashboard while the grants load. */
export const LoadingSkeleton = ({ count }: { count: number | null }) => (
  <div className="space-y-8" data-testid="loading-skeleton">
    <p role="status" className="text-sm font-mono text-white/70">
      Loading {count ? `${count.toLocaleString("en-GB")} grants` : "grants"}…
    </p>
    <Block className="h-44" />
    <Block className="h-10 rounded-full" />
    <Block className="h-7 w-2/3 rounded-lg" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <Block key={i} className="h-32" />
      ))}
    </div>
    <div className="space-y-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Block key={i} className="h-12 rounded-xl" />
      ))}
    </div>
  </div>
);
