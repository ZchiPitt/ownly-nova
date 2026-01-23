import { createContext } from 'react'

export interface OfflineContextValue {
  /** Whether the browser is online */
  isOnline: boolean
  /** Whether the browser is offline (convenience property) */
  isOffline: boolean
  /**
   * Check if online and show toast if offline.
   * Use this before network-required actions.
   * @param actionName - Optional name of the action for the toast message
   * @returns true if online, false if offline (and toast was shown)
   */
  requireOnline: (actionName?: string) => boolean
  /** Show a custom offline message toast */
  showOfflineToast: (message?: string) => void
}

export const OfflineContext = createContext<OfflineContextValue | null>(null)
