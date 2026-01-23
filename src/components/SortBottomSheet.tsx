/**
 * SortBottomSheet - Bottom sheet modal for selecting sort options
 * Displays all available sort options with checkmark for current selection
 */

import { useEffect, useRef } from 'react';
import type { InventorySortOption } from '@/hooks/useInventoryItems';
import { SORT_OPTIONS } from '@/hooks/useInventoryItems';

interface SortBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentSort: InventorySortOption;
  onSortChange: (sort: InventorySortOption) => void;
}

export function SortBottomSheet({
  isOpen,
  onClose,
  currentSort,
  onSortChange,
}: SortBottomSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSortSelect = (sort: InventorySortOption) => {
    onSortChange(sort);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-[#4a3f35]/20 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#fdf8f2] rounded-t-[3rem] soft-shadow animate-in slide-in-from-bottom duration-300 border-t border-white/50">
        {/* Handle bar */}
        <div className="flex justify-center pt-5 pb-2">
          <div className="w-12 h-1.5 bg-[#4a3f35]/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4">
          <h2 className="text-2xl font-black text-[#4a3f35] tracking-tight">Sort by</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl text-[#d6ccc2] hover:text-[#4a3f35] soft-shadow transition-all active:scale-95"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
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

        {/* Sort options */}
        <div className="py-2 pb-safe max-h-96 overflow-y-auto">
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.key === currentSort;
            return (
              <button
                key={option.key}
                onClick={() => handleSortSelect(option.key)}
                className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-[#fdf8f2] text-[#4a3f35]'
                    : 'hover:bg-[#fdf8f2] text-[#4a3f35]'
                }`}
              >
                <span className={`text-base ${isSelected ? 'font-medium' : ''}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <svg
                    className="w-5 h-5 text-[#4a3f35]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Safe area padding for iPhone */}
        <div className="h-6" />
      </div>
    </div>
  );
}
