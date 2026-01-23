import { useState, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './toast-context'
import type { ToastContextValue, Toast, ToastOptions, ToastType } from './toast-context'

interface ToastProviderProps {
  children: ReactNode
  /** Maximum number of toasts to display at once. Default: 5 */
  maxToasts?: number
}

/**
 * ToastProvider - Context provider for toast notifications
 *
 * This provider:
 * - Manages a stack of toast notifications
 * - Provides convenient methods for showing different types of toasts
 * - Supports action buttons (e.g., Undo)
 * - Auto-dismisses toasts after a configurable duration
 *
 * Usage:
 * ```tsx
 * // Wrap your app with ToastProvider
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 *
 * // In a component
 * const { toast, success, error } = useToast()
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
 * ```
 */
export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdCounter = useRef(0)
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Clear any existing timeout for this toast
    const timeout = timeoutsRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }

    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
    timeoutsRef.current.clear()
    setToasts([])
  }, [])

  const toast = useCallback(
    (options: ToastOptions | string): string => {
      const normalizedOptions: ToastOptions =
        typeof options === 'string' ? { message: options } : options

      const id = `toast-${++toastIdCounter.current}`
      const newToast: Toast = {
        ...normalizedOptions,
        id,
        type: normalizedOptions.type ?? 'info',
        duration: normalizedOptions.duration ?? 3000,
      }

      setToasts((prev) => {
        // Limit the number of toasts
        const newToasts = [...prev, newToast]
        if (newToasts.length > maxToasts) {
          // Dismiss oldest toasts
          const toRemove = newToasts.slice(0, newToasts.length - maxToasts)
          toRemove.forEach((t) => {
            const timeout = timeoutsRef.current.get(t.id)
            if (timeout) {
              clearTimeout(timeout)
              timeoutsRef.current.delete(t.id)
            }
          })
          return newToasts.slice(-maxToasts)
        }
        return newToasts
      })

      // Set up auto-dismiss if duration > 0
      if (newToast.duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id)
        }, newToast.duration)
        timeoutsRef.current.set(id, timeout)
      }

      return id
    },
    [maxToasts, dismiss]
  )

  const createTypedToast = useCallback(
    (type: ToastType) =>
      (message: string, options?: Omit<ToastOptions, 'message' | 'type'>): string => {
        return toast({ message, type, ...options })
      },
    [toast]
  )

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      success: createTypedToast('success'),
      error: createTypedToast('error'),
      info: createTypedToast('info'),
      warning: createTypedToast('warning'),
      dismiss,
      dismissAll,
    }),
    [toasts, toast, createTypedToast, dismiss, dismissAll]
  )

  return <ToastContext.Provider value={contextValue}>{children}</ToastContext.Provider>
}
