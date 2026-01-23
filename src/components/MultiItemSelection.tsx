/**
 * Multi-Item Selection Component
 *
 * Displays when AI detects multiple items in a single photo.
 * Allows users to select which items to add to their inventory.
 *
 * Features:
 * - Original photo preview at top
 * - List of detected items with checkboxes
 * - Confidence badges (High/Medium/Low)
 * - Category suggestion display
 * - AI-suggested tags preview
 * - Select/deselect all functionality
 * - Add Selected Items button with count
 * - Queue navigation to Item Editor
 */

import { useState, useCallback } from 'react';
import type { DetectedItem } from '@/types/api';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { useLocations } from '@/hooks/useLocations';

/**
 * Props for the MultiItemSelection component
 */
export interface MultiItemSelectionProps {
  /** URL of the original uploaded image */
  imageUrl: string;
  /** URL of the thumbnail image */
  thumbnailUrl: string;
  /** Path to the image in storage (for cleanup/reference) */
  imagePath: string;
  /** Path to the thumbnail in storage */
  thumbnailPath: string;
  /** Array of items detected by AI analysis */
  detectedItems: DetectedItem[];
  /** Callback when user wants to go back */
  onBack: () => void;
  /** Callback when user proceeds with selected items */
  onProceed: (selectedItems: DetectedItem[], imageInfo: ImageInfo, sharedLocationId?: string | null) => void;
  /** Callback when user batch saves selected items */
  onBatchSave?: (selectedItems: DetectedItem[], sharedLocationId?: string | null) => void;
  /** Whether batch save is in progress */
  isBatchSaving?: boolean;
  /** Batch save progress info */
  batchSaveProgress?: { current: number; total: number };
}

/**
 * Image info passed to the proceed callback
 */
export interface ImageInfo {
  imageUrl: string;
  thumbnailUrl: string;
  imagePath: string;
  thumbnailPath: string;
}

/**
 * Get confidence badge color and text based on confidence score
 */
function getConfidenceBadge(confidence: number): { text: string; className: string } {
  if (confidence >= 0.8) {
    return { text: 'High', className: 'bg-green-100 text-green-700' };
  } else if (confidence >= 0.6) {
    return { text: 'Medium', className: 'bg-yellow-100 text-yellow-700' };
  } else {
    return { text: 'Low', className: 'bg-[#fdf8f2] text-[#8d7b6d]' };
  }
}

export function MultiItemSelection({
  imageUrl,
  thumbnailUrl,
  imagePath,
  thumbnailPath,
  detectedItems,
  onBack,
  onProceed,
  onBatchSave,
  isBatchSaving = false,
  batchSaveProgress,
}: MultiItemSelectionProps) {
  // Track which items are selected (default: all selected)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(detectedItems.map((_, index) => index))
  );

  // Shared location for all items
  const [sharedLocationId, setSharedLocationId] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const { locations } = useLocations();

  /**
   * Toggle selection of a single item
   */
  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  /**
   * Select or deselect all items
   */
  const toggleSelectAll = useCallback(() => {
    if (selectedIndices.size === detectedItems.length) {
      // All selected, deselect all
      setSelectedIndices(new Set());
    } else {
      // Not all selected, select all
      setSelectedIndices(new Set(detectedItems.map((_, index) => index)));
    }
  }, [selectedIndices.size, detectedItems]);

  /**
   * Handle proceed button click
   */
  const handleProceed = useCallback(() => {
    const selectedItems = detectedItems.filter((_, index) => selectedIndices.has(index));
    if (selectedItems.length > 0) {
      onProceed(selectedItems, {
        imageUrl,
        thumbnailUrl,
        imagePath,
        thumbnailPath,
      }, sharedLocationId);
    }
  }, [selectedIndices, detectedItems, onProceed, imageUrl, thumbnailUrl, imagePath, thumbnailPath, sharedLocationId]);

  const selectedCount = selectedIndices.size;
  const allSelected = selectedCount === detectedItems.length;
  const selectedItems = detectedItems.filter((_, index) => selectedIndices.has(index));

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#f5ebe0]">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-[#8d7b6d] hover:text-[#4a3f35]"
          aria-label="Go back"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-[#4a3f35]">Multiple Items Found</h2>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Original Photo Preview */}
      <div className="flex-shrink-0 p-4 bg-[#fdf8f2]">
        <img
          src={imageUrl}
          alt="Captured items"
          className="w-full max-h-48 object-contain rounded-lg"
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {/* Description and Select All */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#f5ebe0]">
          <p className="text-sm text-[#8d7b6d]">
            We found {detectedItems.length} items. Select which to add:
          </p>
          <button
            onClick={toggleSelectAll}
            className="text-sm font-medium text-[#4a3f35] hover:text-[#3d332b]"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Items */}
        <div className="p-4 space-y-3">
          {detectedItems.map((item, index) => {
            const isSelected = selectedIndices.has(index);
            const confidenceBadge = getConfidenceBadge(item.confidence);

            return (
              <button
                key={index}
                onClick={() => toggleSelection(index)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${isSelected
                    ? 'border-[#4a3f35] bg-[#e3ead3]/20'
                    : 'border-[#f5ebe0] bg-white hover:border-[#d6ccc2]'
                  }`}
              >
                {/* Checkbox */}
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors mt-0.5 ${isSelected
                      ? 'bg-[#4a3f35] border-[#4a3f35]'
                      : 'border-[#d6ccc2] bg-white'
                    }`}
                >
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  {/* Item Name with AI sparkle */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#4a3f35] truncate">
                      {item.name}
                    </span>
                    {/* AI sparkle indicator */}
                    <svg
                      className="w-4 h-4 text-[#fbc4ab] flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
                    </svg>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Category suggestion */}
                    {item.category_suggestion && (
                      <span className="inline-flex items-center text-xs px-2 py-1 bg-[#fdf8f2] rounded-full text-[#8d7b6d]">
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        {item.category_suggestion}
                      </span>
                    )}

                    {/* Confidence badge */}
                    <span
                      className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${confidenceBadge.className}`}
                    >
                      {confidenceBadge.text} confidence
                    </span>
                  </div>

                  {/* Tags preview (show first 3 tags) */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {item.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-block text-xs px-2 py-0.5 bg-[#fdf8f2] text-[#4a3f35] rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-xs text-[#d6ccc2]">
                          +{item.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Brand if available */}
                  {item.brand && (
                    <p className="text-xs text-[#a89887] mt-1">
                      Brand: {item.brand}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Location selector for all items */}
      <div className="flex-shrink-0 px-4 pt-3 pb-1 border-t border-[#f5ebe0] bg-white">
        <p className="text-xs text-[#8d7b6d] mb-2">Location for all items (optional)</p>
        <button
          onClick={() => setShowLocationPicker(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 border border-[#f5ebe0] rounded-xl bg-[#fdf8f2] hover:bg-[#f5ebe0]/60 transition-colors text-left"
        >
          <svg
            className="w-5 h-5 text-[#8d7b6d] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className={`flex-1 text-sm truncate ${sharedLocationId ? 'text-[#4a3f35] font-medium' : 'text-[#b9a99b]'}`}>
            {sharedLocationId
              ? (locations.find((l) => l.id === sharedLocationId)?.path ||
                 locations.find((l) => l.id === sharedLocationId)?.name ||
                 'Selected location')
              : 'Tap to set location for all items'}
          </span>
          {sharedLocationId ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSharedLocationId(null);
              }}
              className="p-1 -m-1 text-[#d6ccc2] hover:text-[#8d7b6d]"
              aria-label="Clear location"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg
              className="w-4 h-4 text-[#d6ccc2] flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom Action Bar - Review and add one by one (primary action) */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-t border-[#f5ebe0] bg-white">
        <button
          onClick={handleProceed}
          disabled={selectedCount === 0}
          className={`w-full py-3.5 px-4 font-medium rounded-2xl transition-colors flex items-center justify-center gap-2 ${selectedCount > 0
              ? 'bg-[#4a3f35] text-white hover:bg-[#3d332b]'
              : 'bg-[#f5ebe0] text-[#d6ccc2] cursor-not-allowed'
            }`}
        >
          {selectedCount > 0 ? (
            <>
              Review and Add {selectedCount} {selectedCount === 1 ? 'item' : 'items'} one by one
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
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </>
          ) : (
            'Select items to add'
          )}
        </button>
      </div>

      {/* Add All Directly Button (secondary action) */}
      {selectedItems.length > 0 && onBatchSave && (
        <div className="px-4 pb-4 bg-white safe-area-pb">
          <button
            onClick={() => onBatchSave(selectedItems, sharedLocationId)}
            disabled={isBatchSaving || !sharedLocationId}
            className={`w-full px-4 py-3 rounded-2xl font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              sharedLocationId
                ? 'bg-[#e3ead3] text-[#4a3f35] hover:bg-[#d6dfc4] disabled:opacity-50'
                : 'bg-[#f5ebe0] text-[#b9a99b]'
            }`}
          >
            {isBatchSaving ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving {batchSaveProgress?.current || 0} of {batchSaveProgress?.total || 0}...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>
                  {sharedLocationId
                    ? `Add All ${selectedItems.length} items directly`
                    : `Select a location to add all directly`}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        selectedLocationId={sharedLocationId}
        onSelect={setSharedLocationId}
      />
    </div>
  );
}
