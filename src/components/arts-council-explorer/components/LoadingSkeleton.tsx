import { ArcSignalLoader } from "./ArcSignalLoader";

/** Replaced placeholder skeleton with ArcSignalLoader */
export const LoadingSkeleton = ({ count }: { count: number | null }) => (
  <ArcSignalLoader
    label="LOADING ARCHIVE SIGNAL"
    sublabel={count ? `Loading ${count.toLocaleString("en-GB")} grants…` : "Arts Council England National Lottery Project Grants"}
  />
);

export default LoadingSkeleton;
