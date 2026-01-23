/**
 * BottomSheet - Reusable bottom sheet modal component
 *
 * Slides up from bottom with backdrop overlay, tap-to-close, and scrollable content.
 * Pattern: Props-based component for direct use (no Context/Hook needed).
 *
 * Usage:
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Select Option"
 *   footer={<button>Apply</button>}
 * >
 *   <p>Content goes here</p>
 * </BottomSheet>
 * ```
 */

import { useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface BottomSheetProps {
  /** Whether the bottom sheet is visible */
  isOpen: boolean
  /** Callback when closing */
  onClose: () => void
  /** Optional title shown in header */
  title?: string
  /** Content to render in the body */
  children?: ReactNode
  /** Optional footer content (e.g., action buttons) */
  footer?: ReactNode
  /** Optional max width (default: 'max-w-lg') */
  maxWidth?: string
  /** Show handle bar at top (default: true) */
  showHandleBar?: boolean
  /** Optional close button in header (default: true) */
  showCloseButton?: boolean
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  showHandleBar = true,
  showCloseButton = true,
}: BottomSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-[#4a3f35]/20 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-300"
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`w-full ${maxWidth} bg-[#fdf8f2] rounded-t-[3rem] soft-shadow max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-500 border-t border-white/50`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        {showHandleBar && (
          <div className="flex justify-center pt-5 pb-2">
            <div className="w-12 h-1.5 bg-[#4a3f35]/10 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-8 py-4 flex-shrink-0">
            {title ? (
              <h2 className="text-2xl font-black text-[#4a3f35] tracking-tight">{title}</h2>
            ) : (
              <div />
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl text-[#d6ccc2] hover:text-[#4a3f35] soft-shadow transition-all active:scale-95"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-10 no-scrollbar">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-8 py-6 bg-white/40 border-t border-[#f5ebe0]/60 flex-shrink-0 rounded-t-[2rem]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
