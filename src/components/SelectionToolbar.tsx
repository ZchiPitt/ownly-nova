/**
 * Selection Toolbar Component
 *
 * A fixed bottom toolbar that appears when items are selected in the inventory.
 * Provides batch actions like delete and mark as sold.
 */

import { useConfirm } from '@/hooks/useConfirm';

export interface SelectionToolbarProps {
  /** Number of items currently selected */
  selectedCount: number;
  /** Total number of items available for selection */
  totalCount: number;
  /** Callback to select all items */
  onSelectAll: () => void;
  /** Callback to deselect all items */
  onDeselectAll: () => void;
  /** Callback to delete selected items */
  onDelete: () => Promise<void>;
  /** Callback to mark selected items as sold */
  onMarkAsSold: () => Promise<void>;
  /** Callback to exit selection mode */
  onCancel: () => void;
  /** Whether a batch operation is in progress */
  isProcessing?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onMarkAsSold,
  onCancel,
  isProcessing = false,
}: SelectionToolbarProps) {
  const confirmDialog = useConfirm();

  const allSelected = selectedCount === totalCount && totalCount > 0;
  const hasSelection = selectedCount > 0;

  const handleDeleteClick = async () => {
    if (!hasSelection) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Delete Items',
      message: `Are you sure you want to delete ${selectedCount} item${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });

    if (confirmed) {
      await onDelete();
    }
  };

  const handleSoldClick = async () => {
    if (!hasSelection) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Mark as Sold',
      message: `Mark ${selectedCount} item${selectedCount !== 1 ? 's' : ''} as sold? This will archive the item${selectedCount !== 1 ? 's' : ''} from your active inventory.`,
      confirmText: 'Mark as Sold',
      variant: 'default',
    });

    if (confirmed) {
      await onMarkAsSold();
    }
  };

  return (
    <>
      {/* Selection toolbar - fixed at bottom above bottom nav */}
      <div className="fixed bottom-14 left-0 right-0 z-40 bg-[#fdf8f2] border-t border-[#f5ebe0] shadow-lg safe-area-pb">
        {/* Selection info and actions */}
        <div className="px-4 py-3">
          {/* Top row: Selection count and select all/deselect all */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Cancel button */}
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="p-1.5 -ml-1.5 text-[#a89887] hover:text-[#4a3f35] disabled:opacity-50"
                aria-label="Exit selection mode"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Selection count */}
              <span className="text-sm font-medium text-[#4a3f35]">
                {selectedCount} selected
              </span>
            </div>

            {/* Select All / Deselect All toggle */}
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              disabled={isProcessing}
              className="text-sm font-medium text-[#4a3f35] hover:text-[#3d332b] disabled:opacity-50"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            {/* Mark as Sold button */}
            <button
              onClick={handleSoldClick}
              disabled={!hasSelection || isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-black text-sm transition-all ${
                hasSelection && !isProcessing
                  ? 'bg-[#dce7c8] text-[#4f6342] border border-[#cddcb1] hover:bg-[#d3e0bc] hover:border-[#bfd09e] active:bg-[#c7d6ae]'
                  : 'bg-[#f3ece4] text-[#b9a99b] border border-[#ece2d8] cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>Mark as Sold</span>
            </button>

            {/* Delete button */}
            <button
              onClick={handleDeleteClick}
              disabled={!hasSelection || isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-black text-sm transition-all ${
                hasSelection && !isProcessing
                  ? 'bg-[#f6ddd3] text-[#8e4b34] border border-[#edcabd] hover:bg-[#f2d3c6] hover:border-[#e6b8a8] active:bg-[#eac4b2]'
                  : 'bg-[#f3ece4] text-[#b9a99b] border border-[#ece2d8] cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
