/**
 * Item Editor Page
 *
 * Page wrapper for the ItemEditor component.
 * Receives item data via router state and provides page-level navigation and save handling.
 *
 * Route: /add/edit
 *
 * Expected location.state:
 * - detectedItem: DetectedItem | null - AI-detected item data
 * - imageUrl: string - URL of the item photo
 * - thumbnailUrl: string - URL of the thumbnail
 * - imagePath: string - Storage path for image
 * - thumbnailPath: string - Storage path for thumbnail
 * - itemQueue: DetectedItem[] - Remaining items to process
 * - totalItems: number - Total items in queue
 * - currentItemIndex: number - Current item position (1-based)
 *
 * Multi-item queue flow (US-035):
 * - Shows progress indicator "Adding item X of Y"
 * - After saving: brief toast "Item X saved", auto-proceeds to next
 * - After all saved: summary "X items added successfully!" with View Inventory button
 * - User can cancel queue at any point
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState, useRef } from 'react';
import { ItemEditor, type ItemEditorValues } from '@/components/ItemEditor';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRecentLocation } from '@/hooks/useRecentLocation';
import { Toast } from '@/components/Toast';
import type { DetectedItem } from '@/types/api';
import type { ItemAIMetadata } from '@/types';
import { generateItemEmbedding } from '@/lib/embeddingUtils';

/**
 * State passed via router to ItemEditorPage
 */
interface ItemEditorState {
  detectedItem: DetectedItem | null;
  imageUrl: string;
  thumbnailUrl: string;
  imagePath: string;
  thumbnailPath: string;
  itemQueue: DetectedItem[];
  totalItems: number;
  currentItemIndex: number;
  sourceBatchId?: string | null;
  sharedLocationId?: string | null;
}

/**
 * Success type determines what UI to show after save
 */
type SuccessType = 'single' | 'queue-continue' | 'queue-complete';

export function ItemEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locationId: recentLocationId } = useRecentLocation();

  // Extract state from router
  const state = location.state as ItemEditorState | null;

  // Track form values for save functionality (using ref for stable reference in callbacks)
  const formValuesRef = useRef<ItemEditorValues | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successType, setSuccessType] = useState<SuccessType>('single');
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [savedItemsCount, setSavedItemsCount] = useState(0);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Validation error state
  const [locationError, setLocationError] = useState<string | undefined>(undefined);

  // Auto-dismiss timer ref for success overlay
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer ref for queue continue toast
  const queueContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if no state (direct navigation)
  useEffect(() => {
    if (!state || !state.imageUrl) {
      navigate('/add', { replace: true });
    }
  }, [state, navigate]);

  // Reset save state when navigating to a new item in the queue
  useEffect(() => {
    isSavingRef.current = false;
    setIsSaving(false);
    setShowSuccess(false);
    setSavedItemId(null);
  }, [state?.currentItemIndex]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
      if (queueContinueTimerRef.current) {
        clearTimeout(queueContinueTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle back navigation
   */
  const handleBack = useCallback(() => {
    // Navigate back to add page
    navigate('/add', { replace: true });
  }, [navigate]);

  /**
   * Handle form value changes
   */
  const handleFormChange = useCallback((values: ItemEditorValues) => {
    formValuesRef.current = values;
    // Clear location error when user selects a location
    if (values.locationId) {
      setLocationError(undefined);
    }
  }, []);

  /**
   * Handle save item to database
   */
  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;

    const values = formValuesRef.current;
    if (!values || !user || !state) return;

    // Validate required fields
    if (!values.locationId) {
      setLocationError('Please select a location for this item');
      setToast({ message: 'Please select a location', type: 'error' });
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setLocationError(undefined);

    try {
      // Build AI metadata if detected item exists
      const aiMetadata: ItemAIMetadata | null = state.detectedItem
        ? {
            detected_name: state.detectedItem.name || undefined,
            detected_category: state.detectedItem.category_suggestion || undefined,
            detected_tags: state.detectedItem.tags || undefined,
            detected_brand: state.detectedItem.brand || undefined,
            confidence_score: state.detectedItem.confidence || undefined,
            detected_bbox: state.detectedItem.bbox || undefined,
            analysis_provider: 'openai',
            analysis_model: 'gpt-4o',
            analyzed_at: new Date().toISOString(),
          }
        : null;

      // Insert item into database
      // Type assertion needed because Database type definition may not be fully compatible
      // with the Supabase client's generic inference
      const insertData = {
        user_id: user.id,
        photo_url: state.imageUrl,
        thumbnail_url: state.thumbnailUrl || null,
        source_batch_id: state.sourceBatchId ?? null,
        name: values.name || null,
        description: values.description || null,
        category_id: values.categoryId || null,
        tags: values.tags,
        location_id: values.locationId || null,
        quantity: values.quantity,
        price: values.price,
        currency: values.currency,
        purchase_date: values.purchaseDate || null,
        expiration_date: values.expirationDate || null,
        brand: values.brand || null,
        model: values.model || null,
        notes: null, // Notes are in description for now
        is_favorite: false,
        keep_forever: false,
        ai_metadata: aiMetadata,
        last_viewed_at: null,
      };

      const { data, error } = await (supabase
        .from('items') as ReturnType<typeof supabase.from>)
        .insert(insertData as Record<string, unknown>)
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      // Store saved item ID
      setSavedItemId(data.id);

      // Generate embedding for semantic search (non-blocking)
      generateItemEmbedding(data.id);

      // Determine success type based on queue state
      const hasMoreItems = state.itemQueue.length > 0;
      const isPartOfQueue = state.totalItems > 1;

      if (hasMoreItems) {
        // More items in queue - show brief toast and proceed to next item
        setSuccessType('queue-continue');
        setSavedItemsCount(state.currentItemIndex);
        setShowSuccess(true);

        // Brief delay then navigate to next item
        queueContinueTimerRef.current = setTimeout(() => {
          const nextItem = state.itemQueue[0];
          const remainingQueue = state.itemQueue.slice(1);

          navigate('/add/edit', {
            replace: true,
            state: {
              detectedItem: nextItem,
              imageUrl: state.imageUrl,
              thumbnailUrl: nextItem.thumbnail_url || state.thumbnailUrl,
              imagePath: state.imagePath,
              thumbnailPath: nextItem.thumbnail_path || state.thumbnailPath,
              itemQueue: remainingQueue,
              totalItems: state.totalItems,
              currentItemIndex: state.currentItemIndex + 1,
              sourceBatchId: state.sourceBatchId ?? null,
              sharedLocationId: state.sharedLocationId ?? null,
            },
          });
        }, 1500);
      } else if (isPartOfQueue) {
        // Last item in queue - show summary
        setSuccessType('queue-complete');
        setSavedItemsCount(state.totalItems);
        setShowSuccess(true);

        // Auto-dismiss after 5 seconds
        autoDismissTimerRef.current = setTimeout(() => {
          navigate('/inventory', { replace: true });
        }, 5000);
      } else {
        // Single item (not part of queue) - show standard success
        setSuccessType('single');
        setShowSuccess(true);

        // Start auto-dismiss timer (5 seconds)
        autoDismissTimerRef.current = setTimeout(() => {
          navigate('/inventory', { replace: true });
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      setToast({ message: 'Failed to save item. Please try again.', type: 'error' });
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [user, state, navigate]);

  /**
   * Handle Add Another Item action
   */
  const handleAddAnother = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    navigate('/add', { replace: true });
  }, [navigate]);

  /**
   * Handle View Item action
   */
  const handleViewItem = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    if (savedItemId) {
      navigate(`/item/${savedItemId}`, { replace: true });
    }
  }, [navigate, savedItemId]);

  /**
   * Handle Go to Inventory action
   */
  const handleGoToInventory = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    if (queueContinueTimerRef.current) {
      clearTimeout(queueContinueTimerRef.current);
    }
    navigate('/inventory', { replace: true });
  }, [navigate]);

  /**
   * Handle cancel queue action (stop adding remaining items)
   */
  const handleCancelQueue = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    if (queueContinueTimerRef.current) {
      clearTimeout(queueContinueTimerRef.current);
    }
    // Go to inventory - the current item was already saved
    navigate('/inventory', { replace: true });
  }, [navigate]);

  // Show loading/redirect state if no state
  if (!state || !state.imageUrl) {
    return (
      <div className="min-h-screen bg-[#fdf8f2] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#4a3f35] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-white flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#f5ebe0]/60 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleBack}
              disabled={isSaving}
              className="p-2 -ml-2 text-[#8d7b6d] hover:text-[#4a3f35] disabled:opacity-50"
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
            <h1 className="text-lg font-semibold text-[#4a3f35]">
              {state.detectedItem ? 'Edit Item Details' : 'Add Item Details'}
            </h1>
            {/* Cancel queue button (when in queue mode) */}
            {state.totalItems > 1 ? (
              <button
                onClick={handleCancelQueue}
                disabled={isSaving}
                className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : (
              <div className="w-10" /> // Spacer for centering
            )}
          </div>

          {/* Progress indicator for queue mode */}
          {state.totalItems > 1 && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-[#6f5f52]">
                  Adding item {state.currentItemIndex} of {state.totalItems}
                </span>
                <span className="text-xs text-[#8d7b6d]">
                  {state.itemQueue.length} remaining
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#efe6dc] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4a3f35] rounded-full transition-all duration-300"
                  style={{
                    width: `${((state.currentItemIndex - 1) / state.totalItems) * 100}%`,
                  }}
                />
              </div>
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {Array.from({ length: state.totalItems }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < state.currentItemIndex - 1
                        ? 'bg-green-500'
                        : i === state.currentItemIndex - 1
                          ? 'bg-[#4a3f35]'
                          : 'bg-[#efe6dc]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ItemEditor Component */}
        {/* Key prop forces remount when item changes, resetting all form state */}
        <div className="flex-1 overflow-hidden">
          <ItemEditor
            key={`item-${state.currentItemIndex}`}
            detectedItem={state.detectedItem}
            imageUrl={state.imageUrl}
            thumbnailUrl={state.thumbnailUrl}
            imagePath={state.imagePath}
            thumbnailPath={state.thumbnailPath}
            currentItemIndex={state.currentItemIndex}
            totalItems={state.totalItems}
            onFormChange={handleFormChange}
            locationError={locationError}
            defaultLocationId={state.sharedLocationId ?? recentLocationId}
          />
        </div>

        {/* Save Button - Sticky at bottom */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-[#f5ebe0]/60 bg-white safe-area-pb">
          <button
            type="button"
            disabled={isSaving}
            className="w-full py-3.5 px-4 bg-[#4a3f35] text-white font-medium rounded-2xl hover:bg-[#3d332b] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
          >
            {isSaving ? (
              <>
                {/* Loading spinner */}
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                Saving...
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Item
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-6">
          {/* Checkmark animation */}
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-green-100 animate-[pulse_2s_ease-in-out_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
                <svg
                  className="w-10 h-10 text-white animate-[check-draw_0.3s_ease-out_0.2s_forwards]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ strokeDasharray: 32, strokeDashoffset: 32 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Success message - varies by type */}
          {successType === 'queue-continue' ? (
            <>
              <h2 className="text-2xl font-bold text-[#4a3f35] mb-2">
                Item {savedItemsCount} Saved!
              </h2>
              <p className="text-[#8d7b6d] text-center mb-6">
                Loading next item...
              </p>
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mb-6">
                {Array.from({ length: state?.totalItems || 0 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      i < savedItemsCount
                        ? 'bg-green-500'
                        : i === savedItemsCount
                          ? 'bg-[#4a3f35] animate-pulse'
                          : 'bg-[#efe6dc]'
                    }`}
                  />
                ))}
              </div>
              {/* Cancel queue button */}
              <button
                onClick={handleCancelQueue}
                className="text-sm text-[#8d7b6d] hover:text-[#6f5f52] transition-colors"
              >
                Stop and go to inventory
              </button>
            </>
          ) : successType === 'queue-complete' ? (
            <>
              <h2 className="text-2xl font-bold text-[#4a3f35] mb-2">
                {savedItemsCount} Items Added!
              </h2>
              <p className="text-[#8d7b6d] text-center mb-8">
                All items have been added to your inventory successfully.
              </p>
              {/* Action buttons for queue complete */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={handleGoToInventory}
                  className="w-full py-3.5 px-4 bg-[#4a3f35] text-white font-medium rounded-2xl hover:bg-[#3d332b] transition-colors flex items-center justify-center gap-2"
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
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  View Inventory
                </button>
                <button
                  onClick={handleAddAnother}
                  className="w-full py-3.5 px-4 bg-white text-[#6f5f52] font-medium rounded-xl border border-[#f5ebe0] hover:bg-[#fdf8f2] transition-colors flex items-center justify-center gap-2"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add More Items
                </button>
              </div>
              {/* Auto-dismiss timer */}
              <p className="mt-6 text-sm text-[#b9a99b]">
                Redirecting to inventory in 5 seconds...
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#4a3f35] mb-2">
                Item Saved!
              </h2>
              <p className="text-[#8d7b6d] text-center mb-8">
                Your item has been added to your inventory.
              </p>

              {/* Action buttons for single item */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={handleAddAnother}
                  className="w-full py-3.5 px-4 bg-[#4a3f35] text-white font-medium rounded-2xl hover:bg-[#3d332b] transition-colors flex items-center justify-center gap-2"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Another Item
                </button>

                <button
                  onClick={handleViewItem}
                  className="w-full py-3.5 px-4 bg-white text-[#6f5f52] font-medium rounded-xl border border-[#f5ebe0] hover:bg-[#fdf8f2] transition-colors flex items-center justify-center gap-2"
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  View Item
                </button>

                <button
                  onClick={handleGoToInventory}
                  className="w-full py-3.5 px-4 text-[#8d7b6d] font-medium hover:text-[#6f5f52] transition-colors flex items-center justify-center gap-2"
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
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  Go to Inventory
                </button>
              </div>

              {/* Auto-dismiss timer */}
              <p className="mt-6 text-sm text-[#b9a99b]">
                Redirecting to inventory in 5 seconds...
              </p>
            </>
          )}
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Custom animation styles */}
      <style>{`
        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes check-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
}
