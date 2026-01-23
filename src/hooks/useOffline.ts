import { useContext } from 'react'
import { OfflineContext } from '@/contexts/offline-context'
import type { OfflineContextValue } from '@/contexts/offline-context'

/**
 * Hook to access offline status and helpers from OfflineContext
 *
 * Usage:
 * ```tsx
 * const { isOnline, isOffline, requireOnline, showOfflineToast } = useOffline()
 *
 * // Check before network action
 * const handleSave = () => {
 *   if (!requireOnline('save')) return
 *   // proceed with save...
 * }
 *
 * // Show custom offline message
 * if (isOffline) {
 *   showOfflineToast('Please connect to the internet to continue')
 * }
 * ```
 *
 * @throws Error if used outside OfflineProvider
 */
export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext)
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider')
  }
  return context
}
