/**
 * Item Editor Component
 *
 * Form for editing item details before saving to inventory.
 * Used for both new items (from AI detection or manual add) and editing existing items.
 *
 * Features:
 * - Photo thumbnail at top (tappable for full view)
 * - Name input with max 200 chars
 * - Quantity stepper (1-999)
 * - Description textarea with max 1000 chars
 * - Category selector with AI suggestion and create new option
 * - AI sparkle indicator for AI pre-filled fields
 * - Sparkle disappears when user modifies field
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useLocations } from '@/hooks/useLocations';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { TagsInput } from '@/components/TagsInput';
import type { DetectedItem } from '@/types/api';
import type { Category } from '@/types';

/**
 * Props for the ItemEditor component
 */
export interface ItemEditorProps {
  /** AI-detected item data (null for manual add) */
  detectedItem: DetectedItem | null;
  /** URL of the item photo */
  imageUrl: string;
  /** URL of the thumbnail image */
  thumbnailUrl: string;
  /** Path to the image in storage */
  imagePath: string;
  /** Path to the thumbnail in storage */
  thumbnailPath: string;
  /** Current item index (1-based) for multi-item queue */
  currentItemIndex: number;
  /** Total items in queue */
  totalItems: number;
  /** Callback when user wants to view full image */
  onViewFullImage?: () => void;
  /** Callback to get current form values (for parent to access) */
  onFormChange?: (values: ItemEditorValues) => void;
  /** Error message for location field (shown when validation fails) */
  locationError?: string;
  /** Default location ID to pre-populate (e.g., user's most recent location) */
  defaultLocationId?: string | null;
}

/**
 * Form values from the ItemEditor
 */
export interface ItemEditorValues {
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
}

/**
 * Track which fields were AI-filled (sparkle indicator shown)
 */
interface AIFilledFields {
  name: boolean;
  description: boolean;
  category: boolean;
  location: boolean;
  tags: boolean;
  brand: boolean;
}

/**
 * Supported currencies for price input
 */
const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
] as const;

/**
 * AI Sparkle icon component
 */
function SparkleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-label="AI-suggested"
    >
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
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
    if (value > min) {
      onChange(value - 1);
    }
  }, [value, min, onChange]);

  const handleIncrement = useCallback(() => {
    if (value < max) {
      onChange(value + 1);
    }
  }, [value, max, onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  }, [min, max, onChange]);

  return (
    <div className="flex items-center gap-3">
      {/* Decrement button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${value <= min
            ? 'border-[#f5ebe0] bg-[#fdf8f2] text-[#d6ccc2] cursor-not-allowed'
            : 'border-[#f5ebe0] bg-white text-[#4a3f35] hover:bg-[#fdf8f2] active:bg-[#f5ebe0]'
          }`}
        aria-label="Decrease quantity"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Quantity input */}
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        className="w-16 h-10 text-center text-lg font-medium border border-[#f5ebe0] rounded-lg focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />

      {/* Increment button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${value >= max
            ? 'border-[#f5ebe0] bg-[#fdf8f2] text-[#d6ccc2] cursor-not-allowed'
            : 'border-[#f5ebe0] bg-white text-[#4a3f35] hover:bg-[#fdf8f2] active:bg-[#f5ebe0]'
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
 * Category Selector component with AI suggestion and create new option
 */
function CategorySelector({
  value,
  onChange,
  aiSuggestion,
  isAIFilled,
  onAIFieldModified,
}: {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  aiSuggestion: string | null;
  isAIFilled: boolean;
  onAIFieldModified: () => void;
}) {
  const { categories, isLoading, createCategory, getSortedCategories } = useCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get sorted categories with AI suggestion at top
  const sortedCategories = useMemo(
    () => getSortedCategories(aiSuggestion),
    [getSortedCategories, aiSuggestion]
  );

  // Find the selected category
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === value) || null,
    [categories, value]
  );

  // Find AI suggested category
  const aiSuggestedCategory = useMemo(() => {
    if (!aiSuggestion) return null;
    return categories.find((c) => c.name.toLowerCase() === aiSuggestion.toLowerCase()) || null;
  }, [categories, aiSuggestion]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setNewCategoryName('');
        setCreateError(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  /**
   * Handle category selection
   */
  const handleSelect = useCallback(
    (category: Category | null) => {
      onChange(category?.id || null);
      setIsOpen(false);
      // Clear AI indicator when user selects a different category
      if (isAIFilled && category?.id !== aiSuggestedCategory?.id) {
        onAIFieldModified();
      }
    },
    [onChange, isAIFilled, aiSuggestedCategory, onAIFieldModified]
  );

  /**
   * Handle creating a new category
   */
  const handleCreateCategory = useCallback(async () => {
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      setCreateError('Category name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setCreateError('Category name must be 50 characters or less');
      return;
    }

    // Check if category already exists (case-insensitive)
    const exists = categories.some(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setCreateError('A category with this name already exists');
      return;
    }

    setIsSaving(true);
    setCreateError(null);

    const newCategory = await createCategory({ name: trimmedName });

    setIsSaving(false);

    if (newCategory) {
      // Select the newly created category
      onChange(newCategory.id);
      setIsCreating(false);
      setNewCategoryName('');
      setIsOpen(false);
      // Clear AI indicator since user created a new category
      if (isAIFilled) {
        onAIFieldModified();
      }
    } else {
      setCreateError('Failed to create category. Please try again.');
    }
  }, [newCategoryName, categories, createCategory, onChange, isAIFilled, onAIFieldModified]);

  /**
   * Handle key press in create input
   */
  const handleCreateKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreateCategory();
      } else if (e.key === 'Escape') {
        setIsCreating(false);
        setNewCategoryName('');
        setCreateError(null);
      }
    },
    [handleCreateCategory]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
        Category
        {isAIFilled && (
          <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
            <SparkleIcon className="w-3 h-3" />
            AI
          </span>
        )}
      </label>

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none transition-colors text-left ${isAIFilled
            ? 'border-[#d6ccc2] bg-[#f5ebe0]/50'
            : 'border-[#f5ebe0] bg-white'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedCategory ? (
            <>
              <span className="text-lg flex-shrink-0">{selectedCategory.icon}</span>
              <span className="truncate">{selectedCategory.name}</span>
              {isAIFilled && selectedCategory.id === aiSuggestedCategory?.id && (
                <span className="flex-shrink-0 text-xs text-[#4a3f35]">(AI suggested)</span>
              )}
            </>
          ) : (
            <span className="text-[#d6ccc2]">Select a category</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[#d6ccc2] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#f5ebe0] rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-[#a89887] text-center">Loading categories...</div>
          ) : (
            <>
              {/* Category options */}
              {sortedCategories.map((category, index) => {
                const isAISuggested = category.id === aiSuggestedCategory?.id;
                const isSelected = category.id === value;
                const isFirstUserCategory =
                  index > 0 &&
                  !category.is_system &&
                  sortedCategories[index - 1]?.is_system;
                const isFirstSystemCategory =
                  index > 0 &&
                  category.is_system &&
                  !sortedCategories[index - 1]?.is_system &&
                  !isAISuggested;

                return (
                  <div key={category.id}>
                    {/* Section divider */}
                    {(isFirstUserCategory || isFirstSystemCategory) && (
                      <div className="border-t border-[#f5ebe0] my-1" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelect(category)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${isSelected
                          ? 'bg-[#f5ebe0] text-[#4a3f35]'
                          : 'hover:bg-[#fdf8f2]'
                        }`}
                    >
                      <span className="text-lg flex-shrink-0">{category.icon}</span>
                      <span className="flex-1 truncate">{category.name}</span>
                      {isAISuggested && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
                          <SparkleIcon className="w-3 h-3" />
                          AI
                        </span>
                      )}
                      {isSelected && (
                        <svg
                          className="w-5 h-5 text-[#4a3f35] flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Create new category option */}
              <div className="border-t border-[#f5ebe0] mt-1">
                {isCreating ? (
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => {
                          setNewCategoryName(e.target.value.slice(0, 50));
                          setCreateError(null);
                        }}
                        onKeyDown={handleCreateKeyPress}
                        placeholder="Category name"
                        maxLength={50}
                        className="flex-1 px-3 py-2 text-sm border border-[#f5ebe0] rounded-lg focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={isSaving || !newCategoryName.trim()}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isSaving || !newCategoryName.trim()
                            ? 'bg-[#f5ebe0] text-[#d6ccc2] cursor-not-allowed'
                            : 'bg-[#4a3f35] text-white hover:bg-[#3d332b]'
                          }`}
                      >
                        {isSaving ? (
                          <svg
                            className="w-4 h-4 animate-spin"
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
                        ) : (
                          'Save'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setNewCategoryName('');
                          setCreateError(null);
                        }}
                        disabled={isSaving}
                        className="p-2 text-[#d6ccc2] hover:text-[#8d7b6d]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    {createError && (
                      <p className="mt-1 text-xs text-red-600">{createError}</p>
                    )}
                    <p className="mt-1 text-xs text-[#d6ccc2]">
                      {newCategoryName.length}/50
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[#4a3f35] hover:bg-[#f5ebe0] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Create new category</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ItemEditor({
  detectedItem,
  imageUrl,
  thumbnailUrl,
  currentItemIndex,
  totalItems,
  onViewFullImage,
  onFormChange,
  locationError,
  defaultLocationId,
}: ItemEditorProps) {
  // Get categories to find AI suggested category
  const { categories, isLoading: categoriesLoading } = useCategories();

  // Initialize form state from detected item or defaults
  const [name, setName] = useState(detectedItem?.name || '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Derive the AI-suggested category ID from categories
  // This will be null until categories are loaded
  const categorySuggestion = detectedItem?.category_suggestion || null;
  const aiSuggestedCategoryId = useMemo(() => {
    if (!categorySuggestion || categoriesLoading) return null;
    const match = categories.find(
      (c) => c.name.toLowerCase() === categorySuggestion.toLowerCase()
    );
    return match?.id || null;
  }, [categories, categorySuggestion, categoriesLoading]);

  // Category state - uses the AI suggestion or null
  // We use the aiSuggestedCategoryId as the default when it becomes available
  const [categoryIdState, setCategoryIdState] = useState<string | null>(null);
  const [hasUserSelectedCategory, setHasUserSelectedCategory] = useState(false);

  // Derive the actual categoryId to use
  // If user has explicitly selected a category, use that
  // Otherwise, use the AI suggestion if available
  const categoryId = hasUserSelectedCategory
    ? categoryIdState
    : (aiSuggestedCategoryId ?? categoryIdState);

  // Wrapper to set category and mark as user-selected
  const setCategoryId = useCallback((newCategoryId: string | null) => {
    setCategoryIdState(newCategoryId);
    setHasUserSelectedCategory(true);
  }, []);

  // Tags state - initialized from AI detection
  const [tags, setTags] = useState<string[]>(detectedItem?.tags || []);

  // AI-suggested tags for display
  const aiSuggestedTags = useMemo(
    () => detectedItem?.tags || [],
    [detectedItem?.tags]
  );

  // Additional fields state
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('CNY');
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [brand, setBrand] = useState(detectedItem?.brand || '');
  const [model, setModel] = useState('');

  // Control expansion of additional fields section
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(() => {
    // Auto-expand if any additional field has a value
    return !!(detectedItem?.brand);
  });

  // Track which fields are still AI-filled (sparkle shown until user modifies)
  const [aiFilledFields, setAIFilledFields] = useState<AIFilledFields>(() => ({
    name: !!detectedItem?.name,
    description: false, // AI doesn't provide description
    category: !!detectedItem?.category_suggestion,
    location: !!defaultLocationId, // Location suggested from recent items
    tags: (detectedItem?.tags || []).length > 0,
    brand: !!detectedItem?.brand,
  }));

  // Track if full image viewer is open
  const [isViewingFullImage, setIsViewingFullImage] = useState(false);

  // Location state - initialize with default location if provided
  const [locationId, setLocationId] = useState<string | null>(defaultLocationId ?? null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const { locations, isLoading: locationsLoading } = useLocations();

  // Update locationId when defaultLocationId arrives asynchronously (only if not already set)
  useEffect(() => {
    if (defaultLocationId && !locationId) {
      setLocationId(defaultLocationId);
      setAIFilledFields(prev => ({ ...prev, location: true }));
    }
  }, [defaultLocationId, locationId]);

  /**
   * Handle name change - clear AI indicator when user modifies
   */
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, 200);
    setName(newValue);
    // Clear AI indicator when user types
    if (aiFilledFields.name) {
      setAIFilledFields(prev => ({ ...prev, name: false }));
    }
  }, [aiFilledFields.name]);

  /**
   * Handle description change
   */
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.slice(0, 1000);
    setDescription(newValue);
    // Clear AI indicator if it was set (for future use)
    if (aiFilledFields.description) {
      setAIFilledFields(prev => ({ ...prev, description: false }));
    }
  }, [aiFilledFields.description]);

  /**
   * Handle quantity change
   */
  const handleQuantityChange = useCallback((newValue: number) => {
    setQuantity(newValue);
  }, []);

  /**
   * Handle category change
   */
  const handleCategoryChange = useCallback((newCategoryId: string | null) => {
    setCategoryId(newCategoryId);
  }, [setCategoryId]);

  /**
   * Handle category AI field modified
   */
  const handleCategoryAIModified = useCallback(() => {
    if (aiFilledFields.category) {
      setAIFilledFields((prev) => ({ ...prev, category: false }));
    }
  }, [aiFilledFields.category]);

  /**
   * Handle location change - clear AI indicator when user modifies
   */
  const handleLocationChange = useCallback((newLocationId: string | null) => {
    setLocationId(newLocationId);
    // Clear AI indicator when user selects a different location
    if (aiFilledFields.location && newLocationId !== defaultLocationId) {
      setAIFilledFields(prev => ({ ...prev, location: false }));
    }
  }, [aiFilledFields.location, defaultLocationId]);

  /**
   * Handle tags change
   */
  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
  }, []);

  /**
   * Handle tags AI field modified
   */
  const handleTagsAIModified = useCallback(() => {
    if (aiFilledFields.tags) {
      setAIFilledFields((prev) => ({ ...prev, tags: false }));
    }
  }, [aiFilledFields.tags]);

  /**
   * Handle price change
   */
  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setPrice(null);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        setPrice(numValue);
      }
    }
  }, []);

  /**
   * Handle currency change
   */
  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrency(e.target.value);
  }, []);

  /**
   * Handle purchase date change
   */
  const handlePurchaseDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPurchaseDate(value || null);
  }, []);

  /**
   * Handle expiration date change
   */
  const handleExpirationDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExpirationDate(value || null);
  }, []);

  /**
   * Handle brand change
   */
  const handleBrandChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 100);
    setBrand(value);
    // Clear AI indicator when user modifies
    if (aiFilledFields.brand) {
      setAIFilledFields((prev) => ({ ...prev, brand: false }));
    }
  }, [aiFilledFields.brand]);

  /**
   * Handle model change
   */
  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 100);
    setModel(value);
  }, []);

  /**
   * Toggle additional fields expansion
   */
  const toggleAdditionalFields = useCallback(() => {
    setIsAdditionalFieldsExpanded((prev) => !prev);
  }, []);

  /**
   * Check if expiration date is in the past
   */
  const isExpirationDatePast = useMemo(() => {
    if (!expirationDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    return expDate < today;
  }, [expirationDate]);

  /**
   * Get today's date string for max purchase date
   */
  const todayString = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  /**
   * Open location picker modal
   */
  const openLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(true);
  }, []);

  /**
   * Close location picker modal
   */
  const closeLocationPicker = useCallback(() => {
    setIsLocationPickerOpen(false);
  }, []);

  /**
   * Get selected location display
   */
  const selectedLocationDisplay = useMemo(() => {
    if (!locationId) return null;
    const location = locations.find((l) => l.id === locationId);
    if (!location) return null;
    return {
      icon: location.icon,
      path: location.path || location.name,
    };
  }, [locationId, locations]);

  /**
   * Handle thumbnail click - open full image viewer
   */
  const handleThumbnailClick = useCallback(() => {
    if (onViewFullImage) {
      onViewFullImage();
    } else {
      setIsViewingFullImage(true);
    }
  }, [onViewFullImage]);

  /**
   * Close full image viewer
   */
  const closeFullImageViewer = useCallback(() => {
    setIsViewingFullImage(false);
  }, []);

  /**
   * Current form values for parent access
   */
  const formValues: ItemEditorValues = useMemo(() => ({
    name,
    description,
    quantity,
    categoryId,
    locationId,
    tags,
    price,
    currency,
    purchaseDate,
    expirationDate,
    brand,
    model,
  }), [name, description, quantity, categoryId, locationId, tags, price, currency, purchaseDate, expirationDate, brand, model]);

  // Notify parent of form changes
  useMemo(() => {
    onFormChange?.(formValues);
  }, [formValues, onFormChange]);

  return (
    <>
      <div className="flex flex-col h-full bg-[#fdf8f2]">
        {/* Progress indicator for multi-item queue */}
        {totalItems > 1 && (
          <div className="flex-shrink-0 px-4 py-2 bg-[#fdf8f2] border-b border-[#f5ebe0]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#4a3f35]">
                Adding item {currentItemIndex} of {totalItems}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: totalItems }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${i < currentItemIndex ? 'bg-[#4a3f35]' : 'bg-[#f5ebe0]'
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-6">
          {/* Compact Header: Thumbnail + Name */}
          <div className="p-4 bg-white border-b border-[#f5ebe0]">
            <div className="flex gap-4">
              {/* Small Thumbnail */}
              <button
                type="button"
                onClick={handleThumbnailClick}
                className="relative flex-shrink-0 w-24 h-24 bg-[#f5ebe0] rounded-xl overflow-hidden group"
                aria-label="View full image"
              >
                <img
                  src={thumbnailUrl || imageUrl}
                  alt={name || 'Item photo'}
                  className="w-full h-full object-cover"
                />
                {/* Expand icon overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Name Field - Next to thumbnail */}
              <div className="flex-1 min-w-0">
                <label htmlFor="item-name" className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-1.5">
                  Item Name
                  {aiFilledFields.name && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-1.5 py-0.5 rounded-full">
                      <SparkleIcon className="w-3 h-3" />
                      AI
                    </span>
                  )}
                </label>
                <input
                  id="item-name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="e.g., Blue Coffee Mug"
                  maxLength={200}
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none transition-colors ${aiFilledFields.name
                      ? 'border-[#d6ccc2] bg-[#fdf8f2]/50'
                      : 'border-[#f5ebe0] bg-white'
                    }`}
                />
                <span className="text-xs text-[#d6ccc2] mt-1 block text-right">
                  {name.length}/200
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="px-4 py-4 space-y-5">

            {/* Quantity Field */}
            <div>
              <label className="block text-sm font-medium text-[#4a3f35] mb-2">
                Quantity
              </label>
              <QuantityStepper
                value={quantity}
                onChange={handleQuantityChange}
                min={1}
                max={999}
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="item-description" className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
                Description
                {aiFilledFields.description && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
                    <SparkleIcon className="w-3 h-3" />
                    AI
                  </span>
                )}
              </label>
              <div className="relative">
                <textarea
                  id="item-description"
                  value={description}
                  onChange={handleDescriptionChange}
                  placeholder="Add notes about this item..."
                  maxLength={1000}
                  rows={4}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none resize-none transition-colors ${aiFilledFields.description
                      ? 'border-[#d6ccc2] bg-[#fdf8f2]/50'
                      : 'border-[#f5ebe0] bg-white'
                    }`}
                />
                {/* Character count */}
                <span className="absolute right-3 bottom-3 text-xs text-[#d6ccc2]">
                  {description.length}/1000
                </span>
              </div>
            </div>

            {/* Category Field */}
            <CategorySelector
              value={categoryId}
              onChange={handleCategoryChange}
              aiSuggestion={detectedItem?.category_suggestion || null}
              isAIFilled={aiFilledFields.category}
              onAIFieldModified={handleCategoryAIModified}
            />

            {/* Location Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
                Location <span className="text-red-500">*</span>
                {aiFilledFields.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
                    <SparkleIcon className="w-3 h-3" />
                    AI
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={openLocationPicker}
                disabled={locationsLoading}
                className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none transition-colors text-left ${locationsLoading ? 'opacity-50 cursor-not-allowed' : ''
                  } ${locationError
                    ? 'border-red-500 bg-red-50'
                    : aiFilledFields.location
                      ? 'border-[#d6ccc2] bg-[#f5ebe0]/50'
                      : 'border-[#f5ebe0] bg-white'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedLocationDisplay ? (
                    <>
                      <span className="text-lg flex-shrink-0">{selectedLocationDisplay.icon}</span>
                      <span className="truncate">{selectedLocationDisplay.path}</span>
                      {aiFilledFields.location && locationId === defaultLocationId && (
                        <span className="flex-shrink-0 text-xs text-[#4a3f35]">(AI suggested)</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#d6ccc2] flex items-center gap-2">
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
                  className="w-5 h-5 text-[#d6ccc2] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {locationError ? (
                <p className="mt-1 text-xs text-red-600">{locationError}</p>
              ) : (
                <p className="mt-1 text-xs text-[#d6ccc2]">
                  Where is this item stored?
                </p>
              )}
            </div>

            {/* Tags Field */}
            <TagsInput
              value={tags}
              onChange={handleTagsChange}
              aiSuggestedTags={aiSuggestedTags}
              isAIFilled={aiFilledFields.tags}
              onAIFieldModified={handleTagsAIModified}
            />

            {/* Additional Fields Section (collapsible) */}
            <div className="border-t border-[#f5ebe0] pt-4">
              <button
                type="button"
                onClick={toggleAdditionalFields}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="text-sm font-medium text-[#4a3f35]">
                  Additional Details
                  {(price !== null || purchaseDate || expirationDate || brand || model) && (
                    <span className="ml-2 text-xs text-[#d6ccc2]">(has values)</span>
                  )}
                </span>
                <svg
                  className={`w-5 h-5 text-[#d6ccc2] transition-transform ${isAdditionalFieldsExpanded ? 'rotate-180' : ''
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expandable additional fields */}
              {isAdditionalFieldsExpanded && (
                <div className="mt-4 space-y-6">
                  {/* Price Field with Currency Selector */}
                  <div>
                    <label htmlFor="item-price" className="block text-sm font-medium text-[#4a3f35] mb-2">
                      Price
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="item-price"
                          type="number"
                          value={price ?? ''}
                          onChange={handlePriceChange}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <select
                        value={currency}
                        onChange={handleCurrencyChange}
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

                  {/* Purchase Date Field */}
                  <div>
                    <label htmlFor="item-purchase-date" className="block text-sm font-medium text-[#4a3f35] mb-2">
                      Purchase Date
                    </label>
                    <input
                      id="item-purchase-date"
                      type="date"
                      value={purchaseDate ?? ''}
                      onChange={handlePurchaseDateChange}
                      max={todayString}
                      className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                    />
                    <p className="mt-1 text-xs text-[#d6ccc2]">
                      When did you purchase this item?
                    </p>
                  </div>

                  {/* Expiration Date Field */}
                  <div>
                    <label htmlFor="item-expiration-date" className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
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
                      value={expirationDate ?? ''}
                      onChange={handleExpirationDateChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white ${isExpirationDatePast ? 'border-amber-300' : 'border-[#f5ebe0]'
                        }`}
                    />
                    {isExpirationDatePast && (
                      <p className="mt-1 text-xs text-amber-600">
                        This item has already expired
                      </p>
                    )}
                  </div>

                  {/* Brand Field */}
                  <div>
                    <label htmlFor="item-brand" className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
                      Brand
                      {aiFilledFields.brand && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
                          <SparkleIcon className="w-3 h-3" />
                          AI
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        id="item-brand"
                        type="text"
                        value={brand}
                        onChange={handleBrandChange}
                        placeholder="e.g., Apple, Samsung, Nike"
                        maxLength={100}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none ${aiFilledFields.brand
                            ? 'border-[#d6ccc2] bg-[#fdf8f2]/50'
                            : 'border-[#f5ebe0] bg-white'
                          }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#d6ccc2]">
                        {brand.length}/100
                      </span>
                    </div>
                  </div>

                  {/* Model Field */}
                  <div>
                    <label htmlFor="item-model" className="block text-sm font-medium text-[#4a3f35] mb-2">
                      Model
                    </label>
                    <div className="relative">
                      <input
                        id="item-model"
                        type="text"
                        value={model}
                        onChange={handleModelChange}
                        placeholder="e.g., iPhone 15 Pro, Galaxy S24"
                        maxLength={100}
                        className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#d6ccc2]">
                        {model.length}/100
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={closeLocationPicker}
        selectedLocationId={locationId}
        onSelect={handleLocationChange}
      />

      {/* Full Image Viewer Modal */}
      {isViewingFullImage && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={closeFullImageViewer}
        >
          {/* Close button */}
          <button
            onClick={closeFullImageViewer}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Full image */}
          <img
            src={imageUrl}
            alt={name || 'Item photo'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Hint text */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <span className="text-sm text-white/60">Tap anywhere to close</span>
          </div>
        </div>
      )}
    </>
  );
}

