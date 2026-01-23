/**
 * Pull-to-refresh indicator component
 * Shows a visual indicator during pull-to-refresh gesture
 */

interface PullToRefreshIndicatorProps {
  /** Current pull distance */
  pullDistance: number;
  /** Pull threshold to trigger refresh */
  threshold: number;
  /** Whether user is currently pulling */
  isPulling: boolean;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
}

/**
 * Visual indicator for pull-to-refresh
 * Shows during pull gesture and refresh operation
 */
export function PullToRefreshIndicator({
  pullDistance,
  threshold,
  isPulling,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  const showIndicator = isPulling || isRefreshing;
  const hasReachedThreshold = pullDistance >= threshold;

  if (!showIndicator) return null;

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
      style={{
        top: 0,
        height: Math.max(pullDistance, isRefreshing ? threshold : 0),
        transform: `translateY(${isRefreshing ? 0 : -threshold + pullDistance}px)`,
        transition: isRefreshing ? 'height 0.3s ease-out' : undefined,
      }}
    >
      <div
        className={`flex items-center gap-2 transition-opacity ${
          hasReachedThreshold || isRefreshing ? 'opacity-100' : 'opacity-50'
        }`}
      >
        {isRefreshing ? (
          // Spinning loader during refresh
          <svg
            className="w-5 h-5 text-[#4a3f35] animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // Arrow icon during pull
          <svg
            className={`w-5 h-5 text-[#4a3f35] transition-transform duration-200 ${
              hasReachedThreshold ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
        <span className="text-sm text-[#8d7b6d]">
          {isRefreshing
            ? 'Refreshing...'
            : hasReachedThreshold
            ? 'Release to refresh'
            : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
