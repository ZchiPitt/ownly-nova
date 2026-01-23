import { createContext } from 'react'
import type { ConfirmDialogOptions, ConfirmDialogState, ConfirmDialogVariant } from '@/components/ConfirmDialog'

/**
 * Extended options with promise-based API
 */
export interface UseConfirmOptions extends Omit<ConfirmDialogOptions, 'onConfirm' | 'onCancel'> {
  /** Optional callback executed when user confirms (before promise resolves) */
  onConfirm?: () => void | Promise<void>
  /** Optional callback executed when user cancels (before promise resolves) */
  onCancel?: () => void
}

/**
 * Context value type for confirm dialog management
 */
export interface ConfirmContextValue {
  /** Currently active dialog (null if none) */
  dialog: ConfirmDialogState | null
  /** Show a confirmation dialog and wait for user response */
  confirm: (options: UseConfirmOptions) => Promise<boolean>
  /** Close the current dialog */
  close: () => void
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null)

// Re-export types from ConfirmDialog for convenience
export type { ConfirmDialogState, ConfirmDialogOptions, ConfirmDialogVariant }
