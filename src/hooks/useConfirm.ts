import { useContext } from 'react'
import { ConfirmContext } from '@/contexts/confirm-context'

/**
 * useConfirm - Hook for showing confirmation dialogs
 *
 * Usage:
 * ```tsx
 * const confirm = useConfirm()
 *
 * // Basic usage
 * if (await confirm({
 *   title: 'Delete Item?',
 *   message: 'This action cannot be undone.',
 * })) {
 *   deleteItem()
 * }
 *
 * // With custom button text
 * if (await confirm({
 *   title: 'Log out',
 *   message: 'Are you sure you want to log out?',
 *   confirmText: 'Log Out',
 *   cancelText: 'Stay Logged In',
 * })) {
 *   logout()
 * }
 *
 * // Danger variant
 * if (await confirm({
 *   title: 'Delete Account?',
 *   message: 'This will permanently delete your account and all data.',
 *   confirmText: 'Delete Account',
 *   variant: 'danger',
 * })) {
 *   deleteAccount()
 * }
 *
 * // With callbacks
 * if (await confirm({
 *   title: 'Save Changes?',
 *   message: 'You have unsaved changes.',
 *   confirmText: 'Save',
 *   onConfirm: async () => {
 *     await saveChanges()
 *   },
 * })) {
 *   navigateAway()
 * }
 *
 * // Rich message with React nodes
 * if (await confirm({
 *   title: 'Delete Item?',
 *   message: (
 *     <div>
 *       <p>This will delete "{itemName}"</p>
 *       <p className="text-sm text-gray-500 mt-2">Permanently deleted after 30 days</p>
 *     </div>
 *   ),
 *   variant: 'danger',
 * })) {
 *   deleteItem()
 * }
 * ```
 */
export function useConfirm() {
  const context = useContext(ConfirmContext)

  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }

  return context
}

// Re-export types for convenience
export type { UseConfirmOptions, ConfirmDialogVariant } from '@/contexts/confirm-context'
