import { useEffect, useRef, useState } from "react";
import { isBotOrCrawler } from "../components/ArcSignalLoader";

interface UseArcSignalLoadingOptions {
  dataLoading: boolean;
  minDurationMs?: number;
  fadeDurationMs?: number;
}

export interface ArcSignalLoadingState {
  showOverlay: boolean;
  isFading: boolean;
  isFinished: boolean;
}

export const useArcSignalLoading = ({
  dataLoading,
  minDurationMs = 5000,
  fadeDurationMs = 500
}: UseArcSignalLoadingOptions): ArcSignalLoadingState => {
  const [isCrawler] = useState(() => isBotOrCrawler());
  const mountTime = useRef(Date.now());
  const [minTimeElapsed, setMinTimeElapsed] = useState(() => isCrawler);
  const [isFading, setIsFading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isCrawler) {
      setMinTimeElapsed(true);
      return;
    }
    const elapsed = Date.now() - mountTime.current;
    const remaining = Math.max(0, minDurationMs - elapsed);
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isCrawler, minDurationMs]);

  useEffect(() => {
    // Dismiss overlay only when BOTH data is ready AND minimum display time has elapsed
    if (!dataLoading && minTimeElapsed && !isFinished && !isFading) {
      if (isCrawler) {
        setIsFinished(true);
      } else {
        setIsFading(true);
        const timer = setTimeout(() => {
          setIsFinished(true);
        }, fadeDurationMs);
        return () => clearTimeout(timer);
      }
    }
  }, [dataLoading, minTimeElapsed, isFinished, isFading, isCrawler, fadeDurationMs]);

  return {
    showOverlay: !isFinished,
    isFading,
    isFinished
  };
};
