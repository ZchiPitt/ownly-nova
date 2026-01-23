/**
 * ConfirmProvider - Context provider for confirmation dialogs
 *
 * Wraps the app to provide the confirm dialog functionality via useConfirm hook.
 *
 * Usage:
 * ```tsx
 * <ConfirmProvider>
 *   <App />
 * </ConfirmProvider>
 * ```
 */

import { useState, useCallback, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ConfirmContext, type ConfirmDialogState, type UseConfirmOptions } from './confirm-context'

interface ConfirmProviderProps {
  children: ReactNode
}

/**
 * ConfirmProvider Component
 *
 * Provides confirmation dialog context to the app.
 */
export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null)

  /**
   * Show a confirmation dialog and return a promise that resolves to true/false
   */
  const confirm = useCallback((options: UseConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id = `confirm-${Date.now()}-${Math.random()}`
      const dialogState: ConfirmDialogState = {
        id,
        ...options,
        resolve,
      }
      setDialog(dialogState)
    })
  }, [])

  /**
   * Close the current dialog
   */
  const close = useCallback(() => {
    setDialog(null)
  }, [])

  const contextValue = {
    dialog,
    confirm,
    close,
  }

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {dialog && <ConfirmDialog dialog={dialog} onClose={close} />}
    </ConfirmContext.Provider>
  )
}
