/**
 * Gallery Grid Component - 3-column card grid view for inventory items
 * Displays items as cards with category badges, location, and price
 * Supports infinite scroll pagination
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem } from '@/hooks/useInventoryItems';

/**
 * Format price with currency symbol
 */
function formatPrice(price: number | null, currency: string): string | null {
  if (price === null || price === undefined) return null;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(price);
}

/**
 * Props for ItemCard component
 */
interface ItemCardProps {
  item: InventoryItem;
  onClick?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

/**
 * Individual item card for gallery view - Ownly style
 */
/**
 * Individual item card for gallery view - Warm Redesign
 */
function ItemCard({ item, onClick, isSelectionMode, isSelected, onToggleSelect }: ItemCardProps) {
  const imageUrl = item.thumbnail_url || item.photo_url;
  const displayName = item.name || 'Untitled Item';
  const formattedPrice = formatPrice(item.price, item.currency);
  const locationDisplay = item.location_name || item.location_path;
  const sharedPhotoCount = item.shared_photo_count ?? 0;

  const handleClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`relative w-full text-left bg-white rounded-[2.5rem] overflow-hidden soft-shadow border border-[#f5ebe0]/40 transition-all active:scale-95 group ${isSelectionMode && isSelected ? 'ring-4 ring-[#e3ead3] ring-offset-2' : ''
        }`}
    >
      {/* Image container - 1:1 aspect ratio for more "clay" look */}
      <div className="relative w-full aspect-square bg-[#fdf8f2] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#d6ccc2]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1.5">
            {item.category_name && (
              <span className="px-3 py-1 bg-white/85 backdrop-blur-md rounded-full text-[8px] font-black text-[#4a3f35] uppercase tracking-widest border border-white/50">
                {item.category_name}
              </span>
            )}
            {item.has_active_listing && (
              <span className="px-3 py-1 bg-[#e3ead3]/90 backdrop-blur-md rounded-full text-[8px] font-black text-[#4a3f35] uppercase tracking-widest border border-white/50">
                Listed
              </span>
            )}
          </div>

          {item.is_favorite && !isSelectionMode && (
            <div className="w-8 h-8 bg-white/85 backdrop-blur-md rounded-full flex items-center justify-center soft-shadow border border-white/50">
              <svg className="w-4 h-4 text-[#fbc4ab]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            </div>
          )}
        </div>

        {/* Checkbox Overlay (Selection Mode) */}
        {isSelectionMode && (
          <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
            <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center transition-all ${isSelected ? 'bg-[#e3ead3] border-white' : 'bg-white/40 border-white/60'}`}>
              {isSelected && (
                <svg className="w-6 h-6 text-[#4a3f35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
          </div>
        )}

        {/* Meta Overlays (Shared count, quantity) */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none">
          {sharedPhotoCount > 0 && (
            <div className="px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[9px] font-black text-white uppercase tracking-wider">
              {sharedPhotoCount} Photos
            </div>
          )}
          {item.quantity > 1 && (
            <div className="px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-black text-[#4a3f35] border border-white/50">
              x{item.quantity}
            </div>
          )}
        </div>
      </div>

      {/* Item Info section */}
      <div className="p-5 space-y-3">
        <h3 className="font-black text-[#4a3f35] text-[13px] tracking-tight truncate leading-tight">
          {displayName}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <svg className="w-3.5 h-3.5 text-[#e3ead3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            <span className="text-[9px] font-black text-[#8d7b6d] uppercase tracking-wider truncate">
              {locationDisplay || 'Unknown Spot'}
            </span>
          </div>

          {formattedPrice && (
            <span className="px-3 py-1 bg-[#fdf8f2] border border-[#f5ebe0] rounded-full text-[10px] font-black text-[#4a3f35]">
              {formattedPrice}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Skeleton loading card for gallery view
 */
function ItemCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* Image skeleton - 4:5 aspect ratio */}
      <div className="w-full aspect-[4/5] bg-[#f5ebe0] animate-pulse" />

      {/* Info skeleton */}
      <div className="p-3">
        <div className="h-4 bg-[#f5ebe0] rounded animate-pulse w-3/4 mb-2" />
        <div className="flex items-center justify-between">
          <div className="h-3 bg-[#f5ebe0] rounded animate-pulse w-1/2" />
          <div className="h-4 bg-[#f5ebe0] rounded animate-pulse w-12" />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component for when there are no items (new user)
 */
function EmptyState({ onAddItem }: { onAddItem: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-[#f5ebe0] rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-10 h-10 text-[#8d7b6d]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-[#4a3f35] mb-1">
        No items yet
      </h3>
      <p className="text-sm text-[#a89887] text-center mb-6 max-w-xs">
        Start by adding your first item
      </p>
      <button
        onClick={onAddItem}
        className="px-6 py-2.5 bg-[#4a3f35] text-white text-sm font-medium rounded-full hover:bg-[#3d332b] transition-colors active:scale-95"
      >
        Add First Item
      </button>
    </div>
  );
}

/**
 * Filtered empty state component for when no items match filters
 */
function FilteredEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Filter icon with X overlay */}
      <div className="w-20 h-20 bg-[#f5ebe0] rounded-full flex items-center justify-center mb-4 relative">
        <svg
          className="w-10 h-10 text-[#d6ccc2]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {/* X badge overlay */}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#8d7b6d] rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-[#4a3f35] mb-1">
        No items match your filters
      </h3>
      <p className="text-sm text-[#a89887] text-center mb-6 max-w-xs">
        Try adjusting your filter criteria or clear all filters to see your items
      </p>
      <button
        onClick={onClearFilters}
        className="px-6 py-2.5 bg-[#f5ebe0] text-[#4a3f35] text-sm font-medium rounded-full hover:bg-[#efe5d8] transition-colors active:scale-95"
      >
        Clear Filters
      </button>
    </div>
  );
}

/**
 * Loading spinner for pagination
 */
function LoadingMoreSpinner() {
  return (
    <div className="flex items-center justify-center py-4">
      <svg
        className="w-5 h-5 text-[#4a3f35] animate-spin"
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
      <span className="ml-2 text-sm text-[#8d7b6d]">Loading more...</span>
    </div>
  );
}

/**
 * End of list message
 */
function EndOfListMessage({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="flex items-center gap-2 text-[#d6ccc2]">
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
        <span className="text-sm">
          You've seen all {totalCount} item{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * Props for GalleryGrid component
 */
interface GalleryGridProps {
  items: InventoryItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  totalCount?: number;
  onRefresh: () => void;
  onLoadMore?: () => void;
  error?: string | null;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Whether selection mode is active */
  isSelectionMode?: boolean;
  /** Set of selected item IDs */
  selectedIds?: Set<string>;
  /** Callback when an item's selection is toggled */
  onToggleSelect?: (itemId: string) => void;
}

/**
 * Gallery grid view for inventory items with infinite scroll
 */
export function GalleryGrid({
  items,
  isLoading,
  isRefreshing,
  isLoadingMore = false,
  hasMore = true,
  totalCount = 0,
  onRefresh,
  onLoadMore,
  error,
  hasActiveFilters = false,
  onClearFilters,
  isSelectionMode = false,
  selectedIds,
  onToggleSelect,
}: GalleryGridProps) {
  const navigate = useNavigate();
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  const handleItemClick = (itemId: string) => {
    navigate(`/item/${itemId}`);
  };

  const handleAddItem = () => {
    navigate('/add');
  };

  // Set up Intersection Observer for infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    const triggerElement = loadMoreTriggerRef.current;
    if (!triggerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Trigger when element is within 200px of viewport
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        // rootMargin adds 200px buffer before the element is visible
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(triggerElement);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, isLoading, isLoadingMore]);

  // Show loading skeletons on initial load
  if (isLoading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {Array.from({ length: 6 }).map((_, index) => (
          <ItemCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Show error state
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#4a3f35] mb-1">
          Couldn't load your items
        </h3>
        <p className="text-sm text-[#a89887] text-center mb-4">
          {error}
        </p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-[#f5ebe0] text-[#4a3f35] text-sm font-medium rounded-lg hover:bg-[#efe5d8] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show filtered empty state (when filters active but no results)
  if (!isLoading && items.length === 0 && hasActiveFilters && onClearFilters) {
    return <FilteredEmptyState onClearFilters={onClearFilters} />;
  }

  // Show empty state (new user with no items)
  if (!isLoading && items.length === 0) {
    return <EmptyState onAddItem={handleAddItem} />;
  }

  return (
    <div className="relative">
      {/* Pull-to-refresh indicator */}
      {isRefreshing && (
        <div className="flex items-center justify-center py-3 mb-2">
          <svg
            className="w-5 h-5 text-[#4a3f35] animate-spin"
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
          <span className="ml-2 text-sm text-[#8d7b6d]">Refreshing...</span>
        </div>
      )}

      {/* Item grid - 2 columns on mobile, 3 on larger screens */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onClick={() => handleItemClick(item.id)}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds?.has(item.id)}
            onToggleSelect={() => onToggleSelect?.(item.id)}
          />
        ))}
      </div>

      {/* Infinite scroll trigger and loading indicator */}
      {items.length > 0 && (
        <>
          {/* Invisible trigger element for Intersection Observer */}
          <div ref={loadMoreTriggerRef} className="h-px" />

          {/* Loading more spinner */}
          {isLoadingMore && <LoadingMoreSpinner />}

          {/* End of list message */}
          {!hasMore && !isLoadingMore && totalCount > 0 && (
            <EndOfListMessage totalCount={totalCount} />
          )}
        </>
      )}
    </div>
  );
}

// Also export sub-components for potential standalone use
export { ItemCard, ItemCardSkeleton, EmptyState, FilteredEmptyState };
