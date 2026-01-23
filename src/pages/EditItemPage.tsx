/**
 * Edit Item Page
 *
 * Page for editing an existing inventory item.
 * Route: /item/:id/edit
 *
 * Features (US-057):
 * - Page title: 'Edit Item'
 * - Reuses ItemEditor component pattern with existing data pre-filled
 * - Photo shown but not editable (read-only)
 * - Bottom buttons: Cancel (text), Save Changes (primary)
 * - Save success: return to /item/{id}, toast 'Item updated successfully'
 * - Cancel: return to /item/{id} without saving
 * - Unsaved changes: show 'Discard?' dialog on navigation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useLocations } from '@/hooks/useLocations';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { TagsInput } from '@/components/TagsInput';
import { Toast } from '@/components/Toast';
import type { Category } from '@/types';
import { generateItemEmbedding } from '@/lib/embeddingUtils';

/**
 * Raw item data from Supabase query
 */
interface RawItemData {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  tags: string[];
  location_id: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  purchase_date: string | null;
  expiration_date: string | null;
  brand: string | null;
  model: string | null;
  notes: string | null;
  is_favorite: boolean;
  keep_forever: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Form values for the edit form
 */
interface EditFormValues {
  name: string;
  description: string;
  quantity: number;
  categoryId: string | null;
  locationId: string | null;
  tags: string[];
  price: number | null;
  currency: string;
  purchaseDate: string | null;
  expirationDate: string | null;
  brand: string;
  model: string;
  notes: string;
}

/**
 * Supported currencies
 */
const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
] as const;

/**
 * Back arrow icon
 */
function BackIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Quantity stepper component
 */
function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const handleDecrement = useCallback(() => {
    if (value > min) onChange(value - 1);
  }, [value, min, onChange]);

  const handleIncrement = useCallback(() => {
    if (value < max) onChange(value + 1);
  }, [value, max, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10);
      if (!isNaN(newValue)) onChange(Math.max(min, Math.min(max, newValue)));
    },
    [min, max, onChange]
  );

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
          value <= min
            ? 'border-[#f5ebe0]/60 bg-[#fdf8f2] text-[#d6ccc2] cursor-not-allowed'
            : 'border-[#f5ebe0] bg-white text-[#6f5f52] hover:bg-[#fdf8f2] active:bg-[#f3ece4]'
        }`}
        aria-label="Decrease quantity"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        className="w-16 h-10 text-center text-lg font-medium border border-[#f5ebe0] rounded-lg focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
          value >= max
            ? 'border-[#f5ebe0]/60 bg-[#fdf8f2] text-[#d6ccc2] cursor-not-allowed'
            : 'border-[#f5ebe0] bg-white text-[#6f5f52] hover:bg-[#fdf8f2] active:bg-[#f3ece4]'
        }`}
        aria-label="Increase quantity"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Category Selector component (simplified for edit mode - no AI suggestion)
 */
function CategorySelector({
  value,
  onChange,
  categories,
  isLoading,
}: {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categories: Category[];
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get sorted categories (user categories first, then system)
  const sortedCategories = useMemo(() => {
    const userCategories = categories.filter((c) => !c.is_system);
    const systemCategories = categories.filter((c) => c.is_system);
    return [...userCategories, ...systemCategories];
  }, [categories]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === value) || null,
    [categories, value]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (category: Category | null) => {
      onChange(category?.id || null);
      setIsOpen(false);
    },
    [onChange]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-[#6f5f52] mb-2">Category</label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none transition-colors text-left border-[#f5ebe0] bg-white ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedCategory ? (
            <>
              <span className="text-lg flex-shrink-0">{selectedCategory.icon}</span>
              <span className="truncate">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-[#b9a99b]">Select a category</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[#b9a99b] flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#f5ebe0]/60 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-[#8d7b6d] text-center">Loading...</div>
          ) : (
            <>
              {/* No category option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                  !value ? 'bg-[#fdf8f2] text-[#4a3f35]' : 'hover:bg-[#fdf8f2]'
                }`}
              >
                <span className="text-lg">🚫</span>
                <span>No category</span>
              </button>
              {sortedCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleSelect(category)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    category.id === value ? 'bg-[#fdf8f2] text-[#4a3f35]' : 'hover:bg-[#fdf8f2]'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{category.icon}</span>
                  <span className="flex-1 truncate">{category.name}</span>
                  {category.id === value && (
                    <svg className="w-5 h-5 text-[#4a3f35] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton
 */
function EditItemSkeleton() {
  return (
    <div className="min-h-screen bg-[#fdf8f2]">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse" />
          <div className="w-24 h-6 rounded bg-[#efe6dc] animate-pulse" />
          <div className="w-16" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-4 space-y-6">
        <div className="w-full aspect-video bg-[#efe6dc] rounded-xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-12 bg-[#efe6dc] rounded-xl animate-pulse" />
          <div className="h-12 bg-[#efe6dc] rounded-xl animate-pulse" />
          <div className="h-24 bg-[#efe6dc] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * Error state
 */
function EditItemError({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#fdf8f2] flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-[#4a3f35]">Edit Item</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-[#8d7b6d] text-center mb-6">{message}</p>
        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-[#4a3f35] text-white font-medium rounded-2xl hover:bg-[#3d332b] transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onBack}
            className="px-6 py-2 border border-[#f5ebe0] text-[#6f5f52] font-medium rounded-2xl hover:bg-[#fdf8f2] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Discard changes dialog
 */
function DiscardDialog({
  onDiscard,
  onCancel,
}: {
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl mx-4 max-w-sm w-full overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-6 text-center">
          <h3 className="text-lg font-semibold text-[#4a3f35] mb-2">Discard changes?</h3>
          <p className="text-[#8d7b6d]">
            You have unsaved changes. Are you sure you want to leave?
          </p>
        </div>

        <div className="flex border-t border-[#f5ebe0]/60">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-[#6f5f52] font-medium hover:bg-[#fdf8f2] transition-colors"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 py-3 text-red-600 font-medium hover:bg-red-50 transition-colors border-l border-[#f5ebe0]/60"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen photo viewer
 */
function PhotoViewer({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      role="dialog"
      aria-label="Full screen photo viewer"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close photo viewer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-white/80 text-sm">Photo (read-only)</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={onClose}>
        <img
          src={imageUrl}
          alt="Item photo"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="text-center text-white/60 text-sm py-4 bg-black/80">
        Tap anywhere to close
      </div>
    </div>
  );
}

/**
 * Edit Item Page Component
 */
export function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch hooks
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { locations, isLoading: locationsLoading } = useLocations();

  // Item state
  const [item, setItem] = useState<RawItemData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formValues, setFormValues] = useState<EditFormValues | null>(null);
  const [initialValues, setInitialValues] = useState<EditFormValues | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(false);
  const [showFloatingSave, setShowFloatingSave] = useState(false);
  const [locationError, setLocationError] = useState<string | undefined>(undefined);

  // Track if user wants to navigate away
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  /**
   * Check if form has unsaved changes
   */
  const hasChanges = useMemo(() => {
    if (!formValues || !initialValues) return false;
    return (
      formValues.name !== initialValues.name ||
      formValues.description !== initialValues.description ||
      formValues.quantity !== initialValues.quantity ||
      formValues.categoryId !== initialValues.categoryId ||
      formValues.locationId !== initialValues.locationId ||
      JSON.stringify(formValues.tags) !== JSON.stringify(initialValues.tags) ||
      formValues.price !== initialValues.price ||
      formValues.currency !== initialValues.currency ||
      formValues.purchaseDate !== initialValues.purchaseDate ||
      formValues.expirationDate !== initialValues.expirationDate ||
      formValues.brand !== initialValues.brand ||
      formValues.model !== initialValues.model ||
      formValues.notes !== initialValues.notes
    );
  }, [formValues, initialValues]);

  /**
   * Warn user about unsaved changes when leaving the page
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  /**
   * Track scroll position for floating save button
   * Show FAB when user has scrolled up (scroll position > 100px)
   */
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      // Show floating save when scrolled down more than 100px
      setShowFloatingSave(scrollTop > 100);
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Fetch item data
   */
  const fetchItem = useCallback(async () => {
    if (!id) {
      setError('Item ID is missing');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .returns<RawItemData[]>()
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('This item no longer exists');
        } else {
          throw fetchError;
        }
        return;
      }

      // Check ownership
      if (data.user_id !== user?.id) {
        setError('You do not have permission to edit this item');
        return;
      }

      setItem(data);

      // Initialize form values
      const values: EditFormValues = {
        name: data.name || '',
        description: data.description || '',
        quantity: data.quantity || 1,
        categoryId: data.category_id,
        locationId: data.location_id,
        tags: data.tags || [],
        price: data.price,
        currency: data.currency || 'CNY',
        purchaseDate: data.purchase_date,
        expirationDate: data.expiration_date,
        brand: data.brand || '',
        model: data.model || '',
        notes: data.notes || '',
      };

      setFormValues(values);
      setInitialValues(values);

      // Auto-expand additional fields if any have values
      if (data.price || data.purchase_date || data.expiration_date || data.brand || data.model) {
        setIsAdditionalFieldsExpanded(true);
      }
    } catch (err) {
      console.error('Error fetching item:', err);
      setError("Couldn't load item details");
    } finally {
      setIsLoading(false);
    }
  }, [id, user?.id]);

  // Fetch on mount
  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  /**
   * Handle back/cancel navigation
   */
  const handleBack = useCallback(() => {
    if (hasChanges) {
      pendingNavigationRef.current = () => navigate(`/item/${id}`);
      setShowDiscardDialog(true);
    } else {
      navigate(`/item/${id}`);
    }
  }, [hasChanges, navigate, id]);

  /**
   * Handle save
   */
  const handleSave = useCallback(async () => {
    if (!formValues || !id || !user) return;

    // Validate required fields
    if (!formValues.locationId) {
      setLocationError('Please select a location for this item');
      setToast({ message: 'Please select a location', type: 'error' });
      return;
    }

    setIsSaving(true);
    setLocationError(undefined);

    try {
      const updateData = {
        name: formValues.name || null,
        description: formValues.description || null,
        quantity: formValues.quantity,
        category_id: formValues.categoryId,
        location_id: formValues.locationId,
        tags: formValues.tags,
        price: formValues.price,
        currency: formValues.currency,
        purchase_date: formValues.purchaseDate,
        expiration_date: formValues.expirationDate,
        brand: formValues.brand || null,
        model: formValues.model || null,
        notes: formValues.notes || null,
      };

      const { error: updateError } = await (supabase
        .from('items') as ReturnType<typeof supabase.from>)
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Regenerate embedding if text-related fields changed
      const embeddingFieldsChanged =
        formValues.name !== initialValues?.name ||
        formValues.description !== initialValues?.description ||
        JSON.stringify(formValues.tags) !== JSON.stringify(initialValues?.tags) ||
        formValues.brand !== initialValues?.brand;

      if (embeddingFieldsChanged) {
        generateItemEmbedding(id);
      }

      // Update initial values to reflect saved state
      setInitialValues(formValues);

      // Show success and navigate back
      setToast({ message: 'Item updated successfully', type: 'success' });

      // Navigate after brief delay to show toast
      setTimeout(() => {
        navigate(`/item/${id}`);
      }, 1000);
    } catch (err) {
      console.error('Error updating item:', err);
      setToast({ message: 'Failed to update item', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [formValues, id, user, navigate]);

  /**
   * Handle discard confirmation
   */
  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    if (pendingNavigationRef.current) {
      pendingNavigationRef.current();
      pendingNavigationRef.current = null;
    }
  }, []);

  /**
   * Handle keep editing (cancel discard)
   */
  const handleKeepEditing = useCallback(() => {
    setShowDiscardDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  /**
   * Update form field
   */
  const updateField = useCallback(<K extends keyof EditFormValues>(field: K, value: EditFormValues[K]) => {
    setFormValues((prev) => (prev ? { ...prev, [field]: value } : null));
    // Clear location error when location is selected
    if (field === 'locationId' && value) {
      setLocationError(undefined);
    }
  }, []);

  /**
   * Get location display
   */
  const selectedLocationDisplay = useMemo(() => {
    if (!formValues?.locationId) return null;
    const location = locations.find((l) => l.id === formValues.locationId);
    if (!location) return null;
    return { icon: location.icon, path: location.path || location.name };
  }, [formValues?.locationId, locations]);

  /**
   * Get today's date for max purchase date
   */
  const todayString = useMemo(() => new Date().toISOString().split('T')[0], []);

  /**
   * Check if expiration date is past
   */
  const isExpirationDatePast = useMemo(() => {
    if (!formValues?.expirationDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(formValues.expirationDate) < today;
  }, [formValues?.expirationDate]);

  // Loading state
  if (isLoading) {
    return <EditItemSkeleton />;
  }

  // Error state
  if (error || !item || !formValues) {
    return (
      <EditItemError
        message={error || 'Item not found'}
        onRetry={error === "Couldn't load item details" ? fetchItem : undefined}
        onBack={handleBack}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#fdf8f2] flex flex-col pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleBack}
              disabled={isSaving}
              className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors disabled:opacity-50"
              aria-label="Go back"
            >
              <BackIcon />
            </button>
            <h1 className="text-lg font-semibold text-[#4a3f35]">Edit Item</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Photo (read-only) */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => setShowPhotoViewer(true)}
              className="relative w-full aspect-video bg-[#efe6dc] rounded-xl overflow-hidden group"
              aria-label="View photo"
            >
              <img
                src={item.thumbnail_url || item.photo_url}
                alt={formValues.name || 'Item photo'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-[#6f5f52]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                </div>
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded-md">
                <span className="text-xs text-white">View only</span>
              </div>
            </button>
          </div>

          {/* Form Fields */}
          <div className="px-4 space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="item-name" className="block text-sm font-medium text-[#6f5f52] mb-2">
                Item Name
              </label>
              <div className="relative">
                <input
                  id="item-name"
                  type="text"
                  value={formValues.name}
                  onChange={(e) => updateField('name', e.target.value.slice(0, 200))}
                  placeholder="e.g., Blue Coffee Mug"
                  maxLength={200}
                  className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#b9a99b]">
                  {formValues.name.length}/200
                </span>
              </div>
            </div>

            {/* Quantity Field */}
            <div>
              <label className="block text-sm font-medium text-[#6f5f52] mb-2">Quantity</label>
              <QuantityStepper
                value={formValues.quantity}
                onChange={(value) => updateField('quantity', value)}
                min={1}
                max={999}
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="item-description" className="block text-sm font-medium text-[#6f5f52] mb-2">
                Description
              </label>
              <div className="relative">
                <textarea
                  id="item-description"
                  value={formValues.description}
                  onChange={(e) => updateField('description', e.target.value.slice(0, 1000))}
                  placeholder="Add notes about this item..."
                  maxLength={1000}
                  rows={4}
                  className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none resize-none bg-white"
                />
                <span className="absolute right-3 bottom-3 text-xs text-[#b9a99b]">
                  {formValues.description.length}/1000
                </span>
              </div>
            </div>

            {/* Category Field */}
            <CategorySelector
              value={formValues.categoryId}
              onChange={(value) => updateField('categoryId', value)}
              categories={categories}
              isLoading={categoriesLoading}
            />

            {/* Location Field */}
            <div>
              <label className="block text-sm font-medium text-[#6f5f52] mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsLocationPickerOpen(true)}
                disabled={locationsLoading}
                className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none transition-colors text-left ${
                  locationsLoading ? 'opacity-50 cursor-not-allowed' : ''
                } ${locationError ? 'border-red-500 bg-red-50' : 'border-[#f5ebe0] bg-white'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedLocationDisplay ? (
                    <>
                      <span className="text-lg flex-shrink-0">{selectedLocationDisplay.icon}</span>
                      <span className="truncate">{selectedLocationDisplay.path}</span>
                    </>
                  ) : (
                    <span className="text-[#b9a99b] flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      Select a location
                    </span>
                  )}
                </div>
                <svg
                  className="w-5 h-5 text-[#b9a99b] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {locationError && (
                <p className="mt-1 text-xs text-red-600">{locationError}</p>
              )}
            </div>

            {/* Tags Field */}
            <TagsInput
              value={formValues.tags}
              onChange={(tags) => updateField('tags', tags)}
              aiSuggestedTags={[]}
              isAIFilled={false}
              onAIFieldModified={() => {}}
            />

            {/* Additional Fields Section */}
            <div className="border-t border-[#f5ebe0]/60 pt-4">
              <button
                type="button"
                onClick={() => setIsAdditionalFieldsExpanded(!isAdditionalFieldsExpanded)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="text-sm font-medium text-[#6f5f52]">
                  Additional Details
                  {(formValues.price !== null ||
                    formValues.purchaseDate ||
                    formValues.expirationDate ||
                    formValues.brand ||
                    formValues.model) && (
                    <span className="ml-2 text-xs text-[#b9a99b]">(has values)</span>
                  )}
                </span>
                <svg
                  className={`w-5 h-5 text-[#b9a99b] transition-transform ${
                    isAdditionalFieldsExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isAdditionalFieldsExpanded && (
                <div className="mt-4 space-y-6">
                  {/* Price Field */}
                  <div>
                    <label htmlFor="item-price" className="block text-sm font-medium text-[#6f5f52] mb-2">
                      Price
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="item-price"
                        type="number"
                        value={formValues.price ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateField('price', value === '' ? null : parseFloat(value));
                        }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="flex-1 px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <select
                        value={formValues.currency}
                        onChange={(e) => updateField('currency', e.target.value)}
                        className="px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                        aria-label="Currency"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.symbol} {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label htmlFor="item-purchase-date" className="block text-sm font-medium text-[#6f5f52] mb-2">
                      Purchase Date
                    </label>
                    <input
                      id="item-purchase-date"
                      type="date"
                      value={formValues.purchaseDate ?? ''}
                      onChange={(e) => updateField('purchaseDate', e.target.value || null)}
                      max={todayString}
                      className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                    />
                  </div>

                  {/* Expiration Date */}
                  <div>
                    <label
                      htmlFor="item-expiration-date"
                      className="flex items-center gap-2 text-sm font-medium text-[#6f5f52] mb-2"
                    >
                      Expiration Date
                      {isExpirationDatePast && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Past date
                        </span>
                      )}
                    </label>
                    <input
                      id="item-expiration-date"
                      type="date"
                      value={formValues.expirationDate ?? ''}
                      onChange={(e) => updateField('expirationDate', e.target.value || null)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white ${
                        isExpirationDatePast ? 'border-amber-300' : 'border-[#f5ebe0]'
                      }`}
                    />
                    {isExpirationDatePast && (
                      <p className="mt-1 text-xs text-amber-600">This item has already expired</p>
                    )}
                  </div>

                  {/* Brand */}
                  <div>
                    <label htmlFor="item-brand" className="block text-sm font-medium text-[#6f5f52] mb-2">
                      Brand
                    </label>
                    <div className="relative">
                      <input
                        id="item-brand"
                        type="text"
                        value={formValues.brand}
                        onChange={(e) => updateField('brand', e.target.value.slice(0, 100))}
                        placeholder="e.g., Apple, Samsung, Nike"
                        maxLength={100}
                        className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#b9a99b]">
                        {formValues.brand.length}/100
                      </span>
                    </div>
                  </div>

                  {/* Model */}
                  <div>
                    <label htmlFor="item-model" className="block text-sm font-medium text-[#6f5f52] mb-2">
                      Model
                    </label>
                    <div className="relative">
                      <input
                        id="item-model"
                        type="text"
                        value={formValues.model}
                        onChange={(e) => updateField('model', e.target.value.slice(0, 100))}
                        placeholder="e.g., iPhone 15 Pro"
                        maxLength={100}
                        className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#b9a99b]">
                        {formValues.model.length}/100
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="item-notes" className="block text-sm font-medium text-[#6f5f52] mb-2">
                      Notes
                    </label>
                    <textarea
                      id="item-notes"
                      value={formValues.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="Additional notes..."
                      rows={3}
                      className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none resize-none bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#f5ebe0]/60 px-4 py-3 pb-safe z-20">
          {/* Helper text when no changes */}
          {!hasChanges && !isSaving && (
            <p className="text-xs text-[#b9a99b] text-center mb-2">
              修改内容后即可保存
            </p>
          )}
          <div className="flex gap-3 max-w-lg mx-auto">
            {/* Cancel button (text) */}
            <button
              onClick={handleBack}
              disabled={isSaving}
              className="flex-1 py-3 text-[#6f5f52] font-medium rounded-lg hover:bg-[#fdf8f2] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Save Changes button (primary) */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-lg transition-colors ${
                hasChanges
                  ? 'bg-[#8d7b6d] text-white hover:bg-[#7c6b5d] active:bg-teal-800'
                  : 'bg-[#efe6dc] text-[#b9a99b] cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Floating Save FAB - appears when scrolled */}
        {showFloatingSave && hasChanges && !isSaving && (
          <button
            onClick={handleSave}
            className="fixed bottom-24 right-4 w-14 h-14 bg-[#8d7b6d] text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-[#7c6b5d] active:bg-teal-800 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
            aria-label="Save changes"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}

        {/* Floating Save FAB - saving state */}
        {showFloatingSave && isSaving && (
          <div
            className="fixed bottom-24 right-4 w-14 h-14 bg-[#8d7b6d] text-white rounded-full shadow-lg flex items-center justify-center z-30"
          >
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
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
        )}
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        selectedLocationId={formValues.locationId}
        onSelect={(locationId) => updateField('locationId', locationId)}
      />

      {/* Photo Viewer */}
      {showPhotoViewer && (
        <PhotoViewer imageUrl={item.photo_url} onClose={() => setShowPhotoViewer(false)} />
      )}

      {/* Discard Dialog */}
      {showDiscardDialog && <DiscardDialog onDiscard={handleDiscard} onCancel={handleKeepEditing} />}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
