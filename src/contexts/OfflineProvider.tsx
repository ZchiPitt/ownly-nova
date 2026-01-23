import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { OfflineContext } from './offline-context'
import type { OfflineContextValue } from './offline-context'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { Toast } from '@/components/Toast'

interface OfflineProviderProps {
  children: ReactNode
}

/**
 * OfflineProvider - Context provider for offline status and offline action handling
 *
 * This provider:
 * - Tracks online/offline status using useOnlineStatus hook
 * - Provides a requireOnline() function to check connectivity before actions
 * - Shows toast notifications when actions are attempted while offline
 *
 * Usage:
 * ```tsx
 * // In a component
 * const { isOffline, requireOnline } = useOffline()
 *
 * const handleSave = () => {
 *   if (!requireOnline('save this item')) return
 *   // ... proceed with save
 * }
 * ```
 */
export function OfflineProvider({ children }: OfflineProviderProps) {
  const { isOnline, isOffline } = useOnlineStatus()
  const [offlineToast, setOfflineToast] = useState<string | null>(null)

  const showOfflineToast = useCallback((message?: string) => {
    setOfflineToast(message || 'This requires an internet connection')
  }, [])

  const requireOnline = useCallback(
    (actionName?: string): boolean => {
      if (isOnline) {
        return true
      }
      // Show toast with action-specific message if provided
      if (actionName) {
        showOfflineToast(`Cannot ${actionName} while offline`)
      } else {
        showOfflineToast()
      }
      return false
    },
    [isOnline, showOfflineToast]
  )

  const handleCloseToast = useCallback(() => {
    setOfflineToast(null)
  }, [])

  const contextValue = useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      isOffline,
      requireOnline,
      showOfflineToast,
    }),
    [isOnline, isOffline, requireOnline, showOfflineToast]
  )

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      {offlineToast && (
        <Toast
          message={offlineToast}
          type="warning"
          onClose={handleCloseToast}
        />
      )}
    </OfflineContext.Provider>
  )
}
