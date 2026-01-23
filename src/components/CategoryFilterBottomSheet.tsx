/**
 * CategoryFilterBottomSheet - Bottom sheet modal for filtering items by category
 *
 * Features:
 * - All Categories checkbox at top (toggles all/none)
 * - Multi-select checkboxes for category selection
 * - System categories first (by sort_order), then user categories (alphabetical)
 * - Each row shows: checkbox + icon + name + item count
 * - Selected count indicator
 * - Apply Filter button at bottom
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Category } from '@/types';

interface CategoryFilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategoryIds: string[];
  onApplyFilter: (categoryIds: string[]) => void;
}

/**
 * Hook for fetching item counts per category
 */
function useCategoryItemCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch item counts grouped by category_id
        const { data, error } = await supabase
          .from('items')
          .select('category_id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .not('category_id', 'is', null)
          .returns<{ category_id: string }[]>();

        if (error) {
          console.error('Error fetching category counts:', error);
          setIsLoading(false);
          return;
        }

        // Count items per category
        const countMap: Record<string, number> = {};
        for (const item of data || []) {
          if (item.category_id) {
            countMap[item.category_id] = (countMap[item.category_id] || 0) + 1;
          }
        }

        setCounts(countMap);
      } catch (err) {
        console.error('Error fetching category counts:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCounts();
  }, [user]);

  return { counts, isLoading };
}

/**
 * Category row component with checkbox
 */
interface CategoryRowProps {
  category: Category;
  isSelected: boolean;
  itemCount: number;
  onToggle: (id: string) => void;
}

function CategoryRow({ category, isSelected, itemCount, onToggle }: CategoryRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(category.id)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fdf8f2]"
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
          isSelected
            ? 'bg-[#4a3f35] border-[#4a3f35]'
            : 'border-2 border-[#d6ccc2]'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Category icon */}
      <span className="text-lg flex-shrink-0">{category.icon}</span>

      {/* Category name */}
      <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>
        {category.name}
      </span>

      {/* Item count badge */}
      {itemCount > 0 && (
        <span className="flex-shrink-0 text-xs bg-[#f5ebe0] text-[#8d7b6d] px-2 py-0.5 rounded-full">
          {itemCount}
        </span>
      )}
    </button>
  );
}

/**
 * Inner content component - gets reset when modal opens
 */
interface CategoryFilterContentProps {
  categories: Category[];
  systemCategories: Category[];
  userCategories: Category[];
  isLoading: boolean;
  itemCounts: Record<string, number>;
  selectedCategoryIds: string[];
  onApplyFilter: (categoryIds: string[]) => void;
  onClose: () => void;
}

function CategoryFilterContent({
  categories,
  systemCategories,
  userCategories,
  isLoading,
  itemCounts,
  selectedCategoryIds,
  onApplyFilter,
  onClose,
}: CategoryFilterContentProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    () => new Set(selectedCategoryIds)
  );

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  /**
   * Toggle a single category
   */
  const handleToggle = useCallback((id: string) => {
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Toggle all categories (select all / deselect all)
   */
  const handleToggleAll = useCallback(() => {
    if (localSelectedIds.size === categories.length) {
      // Deselect all
      setLocalSelectedIds(new Set());
    } else {
      // Select all
      setLocalSelectedIds(new Set(categories.map((c) => c.id)));
    }
  }, [localSelectedIds.size, categories]);

  /**
   * Handle apply filter
   */
  const handleApply = useCallback(() => {
    // If all are selected or none are selected, clear the filter
    if (localSelectedIds.size === 0 || localSelectedIds.size === categories.length) {
      onApplyFilter([]);
    } else {
      onApplyFilter(Array.from(localSelectedIds));
    }
    onClose();
  }, [localSelectedIds, categories.length, onApplyFilter, onClose]);

  // Compute selection state
  const allSelected = localSelectedIds.size === categories.length && categories.length > 0;
  const noneSelected = localSelectedIds.size === 0;
  const someSelected = !allSelected && !noneSelected;
  const selectedCount = localSelectedIds.size;

  // Sort categories: system first (by sort_order), then user (alphabetical)
  const sortedCategories = useMemo(() => {
    const sortedSystem = [...systemCategories].sort((a, b) => a.sort_order - b.sort_order);
    const sortedUser = [...userCategories].sort((a, b) => a.name.localeCompare(b.name));
    return [...sortedSystem, ...sortedUser];
  }, [systemCategories, userCategories]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-[#4a3f35]/20 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#fdf8f2] rounded-t-[3rem] soft-shadow animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[80vh] border-t border-white/50">
        {/* Handle bar */}
        <div className="flex justify-center pt-5 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-[#4a3f35]/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0">
          <h2 className="text-2xl font-black text-[#4a3f35] tracking-tight">Filter by Category</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 text-[#4a3f35] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : (
            <div>
              {/* All Categories checkbox */}
              <button
                type="button"
                onClick={handleToggleAll}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fdf8f2] border-b border-[#f5ebe0]"
              >
                {/* Checkbox (with indeterminate state for partial selection) */}
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    allSelected || someSelected
                      ? 'bg-[#4a3f35] border-[#4a3f35]'
                      : 'border-2 border-[#d6ccc2]'
                  }`}
                >
                  {allSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {someSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <span className={`flex-1 ${allSelected ? 'font-medium' : ''}`}>
                  All Categories
                </span>
              </button>

              {/* Category list */}
              {sortedCategories.length > 0 ? (
                <div className="py-1">
                  {sortedCategories.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      isSelected={localSelectedIds.has(category.id)}
                      itemCount={itemCounts[category.id] || 0}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-[#a89887]">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-[#d6ccc2]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <p className="text-sm">No categories yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with selection indicator and Apply button */}
        <div className="flex-shrink-0 px-8 py-6 bg-white/40 border-t border-[#f5ebe0]/60 rounded-t-[2rem]">
          {/* Selection indicator */}
          {someSelected && (
            <p className="text-xs text-[#a89887] mb-2 text-center">
              {selectedCount} selected
            </p>
          )}
          <button
            onClick={handleApply}
            className="w-full py-3.5 bg-[#4a3f35] text-white font-black rounded-2xl hover:bg-[#3d332b] transition-colors active:scale-[0.98]"
          >
            Apply Filter
          </button>
        </div>

        {/* Safe area padding for iPhone */}
        <div className="h-6 bg-[#fdf8f2] flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Category Filter Bottom Sheet Component
 *
 * Wrapper that handles open/close state. The inner content component
 * is unmounted when modal closes, which naturally resets its state.
 */
export function CategoryFilterBottomSheet({
  isOpen,
  onClose,
  selectedCategoryIds,
  onApplyFilter,
}: CategoryFilterBottomSheetProps) {
  const { categories, systemCategories, userCategories, isLoading: categoriesLoading } = useCategories();
  const { counts: itemCounts, isLoading: countsLoading } = useCategoryItemCounts();

  const isLoading = categoriesLoading || countsLoading;

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  return (
    <CategoryFilterContent
      categories={categories}
      systemCategories={systemCategories}
      userCategories={userCategories}
      isLoading={isLoading}
      itemCounts={itemCounts}
      selectedCategoryIds={selectedCategoryIds}
      onApplyFilter={onApplyFilter}
      onClose={onClose}
    />
  );
}
