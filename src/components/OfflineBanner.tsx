import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * OfflineBanner - Shows a persistent banner when the user is offline
 *
 * This component displays a fixed banner at the top of the screen when
 * the browser is offline, warning users that some features may not work.
 *
 * The banner:
 * - Uses the useOnlineStatus hook to detect online/offline state
 * - Shows a warning icon and message
 * - Is fixed at the top with a yellow/amber background for visibility
 * - Automatically hides when the user comes back online
 */
export function OfflineBanner() {
  const { isOffline } = useOnlineStatus()

  // Don't render anything when online
  if (!isOffline) {
    return null
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-md"
      role="alert"
      aria-live="polite"
    >
      {/* Wifi off icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span className="text-sm font-medium">
        You're offline
      </span>
    </div>
  )
}

export default OfflineBanner
