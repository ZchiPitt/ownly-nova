import { useContext } from 'react'
import { ToastContext } from '@/contexts/toast-context'
import type { ToastOptions, ToastAction } from '@/contexts/toast-context'

/**
 * useToast - Hook for accessing toast notification system
 *
 * Usage:
 * ```tsx
 * const { toast, success, error, info, warning, dismiss, dismissAll } = useToast()
 *
 * // Simple toast
 * toast('Hello world')
 *
 * // Success toast
 * success('Item saved successfully')
 *
 * // Toast with action button
 * toast({
 *   message: 'Item deleted',
 *   type: 'success',
 *   action: { label: 'Undo', onClick: () => restoreItem() }
 * })
 *
 * // Custom duration (5 seconds)
 * info('This will stay for 5 seconds', { duration: 5000 })
 *
 * // No auto-dismiss
 * warning('Please review this', { duration: 0 })
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}

// Type-safe helper for action button
export type { ToastAction, ToastOptions }
