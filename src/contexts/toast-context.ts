import { createContext } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  /** Label for the action button */
  label: string
  /** Callback when action is clicked */
  onClick: () => void
}

export interface ToastOptions {
  /** The message to display */
  message: string
  /** The type of toast (determines color) */
  type?: ToastType
  /** Duration in milliseconds before auto-dismiss. Set to 0 for no auto-dismiss. Default: 3000 */
  duration?: number
  /** Optional action button */
  action?: ToastAction
}

export interface Toast extends ToastOptions {
  /** Unique identifier for the toast */
  id: string
  /** Type with default applied */
  type: ToastType
  /** Duration with default applied */
  duration: number
}

export interface ToastContextValue {
  /** Array of currently visible toasts */
  toasts: Toast[]
  /** Show a toast notification */
  toast: (options: ToastOptions | string) => string
  /** Show a success toast */
  success: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => string
  /** Show an error toast */
  error: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => string
  /** Show an info toast */
  info: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => string
  /** Show a warning toast */
  warning: (message: string, options?: Omit<ToastOptions, 'message' | 'type'>) => string
  /** Dismiss a specific toast by ID */
  dismiss: (id: string) => void
  /** Dismiss all toasts */
  dismissAll: () => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
