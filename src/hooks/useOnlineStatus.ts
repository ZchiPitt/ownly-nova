import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to track online/offline status using the Navigator.onLine API
 * and online/offline window events.
 *
 * @returns {object} Object with:
 *   - isOnline: boolean - Whether the browser is online
 *   - isOffline: boolean - Convenience property (opposite of isOnline)
 */
export function useOnlineStatus() {
  // Initialize with current online status
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Check if navigator.onLine is available (should always be in modern browsers)
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine
    }
    // Default to online if we can't determine
    return true
  })

  const handleOnline = useCallback(() => {
    setIsOnline(true)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
  }, [])

  useEffect(() => {
    // Add event listeners for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return {
    isOnline,
    isOffline: !isOnline,
  }
}
