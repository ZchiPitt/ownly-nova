/**
 * ConfirmDialog Component
 *
 * Reusable confirmation dialog with customizable title, message, and buttons.
 * Features:
 * - Modal with backdrop overlay
 * - Centered card with animation
 * - Danger variant for destructive actions
 * - Optional cancel and confirm callbacks
 *
 * This component is meant to be used via the useConfirm hook:
 * ```tsx
 * const confirm = useConfirm()
 *
 * if (await confirm({
 *   title: 'Delete Item?',
 *   message: 'This action cannot be undone.',
 *   confirmText: 'Delete',
 *   variant: 'danger'
 * })) {
 *   // User confirmed
 * }
 * ```
 */

import { useEffect, useCallback, type ReactNode } from 'react'

export type ConfirmDialogVariant = 'default' | 'danger'

export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string
  /** Dialog message (can be a React node for rich content) */
  message: ReactNode
  /** Text for confirm button (default: "Confirm") */
  confirmText?: string
  /** Text for cancel button (default: "Cancel") */
  cancelText?: string
  /** Variant styling for confirm button */
  variant?: ConfirmDialogVariant
  /** Callback when confirmed */
  onConfirm?: () => void | Promise<void>
  /** Callback when cancelled */
  onCancel?: () => void
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  /** Unique ID for this dialog instance */
  id: string
  /** Promise resolve function */
  resolve: (result: boolean) => void
}

interface ConfirmDialogProps {
  /** Dialog state */
  dialog: ConfirmDialogState
  /** Callback to close dialog */
  onClose: () => void
}

const variantStyles: Record<ConfirmDialogVariant, string> = {
  default: 'bg-[#d6ccc2] text-[#4a3f35] hover:bg-[#c8b9ab]',
  danger: 'bg-[#f8e1d7] text-[#a04d2b] hover:bg-[#f0d0be]',
}

const iconByVariant: Record<ConfirmDialogVariant, ReactNode> = {
  default: (
    <svg className="w-12 h-12 text-[#8d7b6d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  danger: (
    <svg className="w-12 h-12 text-[#a04d2b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}

/**
 * ConfirmDialog Component
 *
 * Renders a modal dialog for user confirmation.
 */
export function ConfirmDialog({ dialog, onClose }: ConfirmDialogProps) {
  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
    resolve,
  } = dialog

  // Handle escape key to cancel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prevent body scroll when dialog is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    await onConfirm?.()
    resolve(true)
    onClose()
  }, [onConfirm, resolve, onClose])

  const handleCancel = useCallback(() => {
    onCancel?.()
    resolve(false)
    onClose()
  }, [onCancel, resolve, onClose])

  const handleBackdropClick = useCallback(() => {
    handleCancel()
  }, [handleCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#4a3f35]/35 animate-in fade-in duration-200"
        onClick={handleBackdropClick}
        aria-label="Close dialog"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-[#fdf8f2] rounded-[1.75rem] border border-[#f5ebe0]/70 soft-shadow animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Icon */}
        <div className="flex justify-center pt-6">
          {iconByVariant[variant]}
        </div>

        {/* Content */}
        <div className="px-6 py-4 text-center">
          <h2
            id="confirm-dialog-title"
            className="text-xl font-black text-[#4a3f35] tracking-tight mb-2"
          >
            {title}
          </h2>
          <div className="text-sm text-[#8d7b6d]">
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-[#4a3f35] bg-white/85 border border-[#d8cfc4] rounded-xl hover:bg-white active:bg-[#fdf8f2] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
