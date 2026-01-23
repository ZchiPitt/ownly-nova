/**
 * Toast notification component
 *
 * Displays non-intrusive notification messages at the bottom of the screen.
 * Supports multiple toasts stacking, action buttons, and auto-dismissal.
 *
 * This component is meant to be used via the ToastProvider and useToast hook:
 * ```tsx
 * const { toast, success } = useToast()
 * toast('Hello world')
 * success('Item saved successfully')
 * ```
 */

import { useEffect, useState } from 'react'
import type { Toast } from '@/contexts/toast-context'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  toast: Toast
  onDismiss: () => void
  /** Position in the stack (0 = bottom/most recent) */
  index: number
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-[#e3ead3] text-[#516241] border-[#d7e1c2]',
  error: 'bg-[#f8e1d7] text-[#a04d2b] border-[#f0d0be]',
  info: 'bg-[#f3ece4] text-[#6f5f52] border-[#e8dbcf]',
  warning: 'bg-[#fcf6bd] text-[#826a2a] border-[#efe5a4]',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: 'i',
  warning: '!',
}

export function ToastItem({ toast, onDismiss, index }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // No auto-dismiss here - ToastProvider handles timing
  }, [])

  const handleAction = () => {
    toast.action?.onClick()
    onDismiss()
  }

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border soft-shadow
        transform transition-all duration-300 ease-out
        ${typeStyles[toast.type]}
        ${isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
      `}
      style={{
        // Stack toasts from bottom up with slight overlap
        marginBottom: index > 0 ? '0.5rem' : '0',
        maxHeight: '120px',
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span className="flex-shrink-0 text-lg font-bold" aria-hidden="true">
        {typeIcons[toast.type]}
      </span>

      {/* Message */}
      <p className="flex-1 text-sm font-medium break-words">
        {toast.message}
      </p>

      {/* Action button */}
      {toast.action && (
        <button
          type="button"
          onClick={handleAction}
          className="flex-shrink-0 px-3 py-1 text-xs font-semibold rounded-full bg-white/70 hover:bg-white transition-colors border border-white/60"
        >
          {toast.action.label}
        </button>
      )}

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => {
          setIsExiting(true)
          setTimeout(onDismiss, 300)
        }}
        className="flex-shrink-0 p-1 rounded hover:bg-white/70 transition-colors"
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

/**
 * ToastContainer - Renders all active toasts in a stack
 *
 * Positioned fixed at bottom center with proper spacing for mobile bottom nav.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-50 flex flex-col items-center pointer-events-none"
      role="region"
      aria-label="Toast notifications"
    >
      <div className="w-full max-w-md flex flex-col-reverse pointer-events-auto">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => onDismiss(toast.id)}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

// Backward-compatible export for simple usage
// This is deprecated - use ToastProvider + useToast instead
interface SimpleToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: SimpleToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 mx-auto max-w-md px-4 py-3 rounded-xl border soft-shadow text-center z-50 transition-opacity duration-300 ${
        typeStyles[type]
      } ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {message}
    </div>
  )
}
