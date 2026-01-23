/**
 * Hook for pull-to-refresh functionality
 * Provides touch event handlers and state for implementing pull-to-refresh
 */

import { useState, useCallback } from 'react';

export interface UsePullToRefreshOptions {
  /** Callback function to execute on refresh */
  onRefresh: () => Promise<void>;
  /** Pull distance threshold to trigger refresh (default: 80) */
  threshold?: number;
  /** Resistance factor for rubber band effect (default: 0.5) */
  resistance?: number;
}

export interface UsePullToRefreshReturn {
  /** Current pull distance (with resistance applied) */
  pullDistance: number;
  /** Whether user is currently pulling */
  isPulling: boolean;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
  /** Touch start event handler */
  handleTouchStart: (e: React.TouchEvent) => void;
  /** Touch move event handler */
  handleTouchMove: (e: React.TouchEvent) => void;
  /** Touch end event handler */
  handleTouchEnd: () => void;
  /** Pull threshold value */
  threshold: number;
}

/**
 * Hook for implementing pull-to-refresh functionality
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 0.5,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Only start pull if at the top of the page and not already refreshing
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop <= 0 && !isRefreshing) {
        setPullStartY(e.touches[0].clientY);
      }
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (pullStartY === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - pullStartY);

      // Apply resistance to pull distance (rubber band effect)
      const resistedDistance = Math.min(distance * resistance, threshold * 1.5);
      setPullDistance(resistedDistance);
      setIsPulling(resistedDistance > 10);
    },
    [pullStartY, isRefreshing, resistance, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    // Reset pull state
    setPullStartY(null);
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold,
  };
}
