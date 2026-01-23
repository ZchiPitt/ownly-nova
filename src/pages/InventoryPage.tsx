/**
 * Inventory Page - Browse all user items
 * Shows inventory with header, search icon, view toggle, item count, and FAB
 * Supports infinite scroll pagination with scroll position restoration
 * Filter state persisted in URL: /inventory?location={id}&categories={id1,id2}&sort={key}
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUserSettings } from '@/hooks/useUserSettings';
import type { InventorySortOption } from '@/hooks/useInventoryItems';
import {
  useInventoryItems,
  getSortFromUrlParam,
  getUrlParamFromSort,
  getSortLabel,
} from '@/hooks/useInventoryItems';
import { GalleryGrid } from '@/components/GalleryGrid';
import { ItemList } from '@/components/ItemList';
import { SortBottomSheet } from '@/components/SortBottomSheet';
import { LocationFilterBottomSheet } from '@/components/LocationFilterBottomSheet';
import { CategoryFilterBottomSheet } from '@/components/CategoryFilterBottomSheet';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { useLocations } from '@/hooks/useLocations';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { Toast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Key for storing scroll position in sessionStorage
const SCROLL_POSITION_KEY = 'inventory-scroll-position';

// View mode type
type ViewMode = 'gallery' | 'list';

/**
 * Grid icon for gallery view toggle
 */
function GridIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-5 h-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {filled ? (
        // Filled grid icon
        <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
      ) : (
        // Outline grid icon
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
        />
      )}
    </svg>
  );
}

/**
 * List icon for list view toggle
 */
function ListIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-5 h-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {filled ? (
        // Filled list icon
        <>
          <rect x="4" y="5" width="16" height="3" rx="1" />
          <rect x="4" y="10.5" width="16" height="3" rx="1" />
          <rect x="4" y="16" width="16" height="3" rx="1" />
        </>
      ) : (
        // Outline list icon
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      )}
    </svg>
  );
}

/**
 * Search icon for header
 */
function SearchIcon() {
  return (
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, updateSettings } = useUserSettings();
  const { user } = useAuth();

  // Get sort from URL param, default to 'newest'
  const sortFromUrl = getSortFromUrlParam(searchParams.get('sort'));

  // Get filters from URL params
  const locationIdFromUrl = searchParams.get('location');
  const categoriesFromUrl = searchParams.get('categories');

  // Parse categories from URL (comma-separated IDs)
  const selectedCategoryIds = categoriesFromUrl ? categoriesFromUrl.split(',').filter(Boolean) : [];

  // Bottom sheet states
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

  // Fetch locations for getting location name for chip label
  const { locations } = useLocations();

  // Compute filter active states
  const hasActiveCategories = selectedCategoryIds.length > 0;
  const hasActiveLocation = locationIdFromUrl !== null;
  const hasAnyActiveFilter = hasActiveCategories || hasActiveLocation;

  const {
    items,
    isLoading: itemsLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    totalCount,
    error: itemsError,
    refresh: refreshItems,
    loadMore,
  } = useInventoryItems({
    sortBy: sortFromUrl,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    locationId: locationIdFromUrl ?? undefined,
  });

  // Track if we should restore scroll position
  const shouldRestoreScrollRef = useRef(true);
  const hasRestoredScrollRef = useRef(false);

  // Track if user has explicitly changed the view (to avoid overriding with settings)
  const [userSelectedView, setUserSelectedView] = useState<ViewMode | null>(null);
  const [, setIsUpdatingView] = useState(false);

  // Toast state for refresh feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Selection mode handlers
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Batch delete handler (soft delete)
  // Uses RPC function to bypass RLS issues caused by location_item_count trigger
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0 || !user) return;

    setIsProcessingBatch(true);
    try {
      const idsToDelete = Array.from(selectedIds);

      // Use RPC function for each item to bypass RLS issues with triggers
      // The soft_delete_item function is SECURITY DEFINER and handles the trigger correctly
      const deletePromises = idsToDelete.map((itemId) =>
        (supabase as any).rpc('soft_delete_item', { item_id: itemId })
      );

      const results = await Promise.all(deletePromises);
      const errors = results.filter((r: { error: unknown }) => r.error);

      if (errors.length > 0) {
        console.error('Some items failed to delete:', errors);
        throw new Error(`Failed to delete ${errors.length} item(s)`);
      }

      setToast({ message: `${idsToDelete.length} item${idsToDelete.length !== 1 ? 's' : ''} deleted`, type: 'success' });
      exitSelectionMode();
      await refreshItems();
    } catch (err) {
      console.error('Batch delete error:', err);
      setToast({ message: 'Failed to delete items', type: 'error' });
    } finally {
      setIsProcessingBatch(false);
    }
  }, [selectedIds, exitSelectionMode, refreshItems, user]);

  // Batch mark as sold handler
  // "Mark as Sold" archives items from inventory (same as soft delete)
  // Uses RPC function to bypass RLS issues caused by location_item_count trigger
  const handleBatchMarkAsSold = useCallback(async () => {
    if (selectedIds.size === 0 || !user) return;

    setIsProcessingBatch(true);
    try {
      const idsToUpdate = Array.from(selectedIds);

      // Use RPC function for each item to bypass RLS issues with triggers
      // "Mark as Sold" archives items from inventory (soft delete)
      const updatePromises = idsToUpdate.map((itemId) =>
        (supabase as any).rpc('soft_delete_item', { item_id: itemId })
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter((r: { error: unknown }) => r.error);

      if (errors.length > 0) {
        console.error('Some items failed to mark as sold:', errors);
        throw new Error(`Failed to mark ${errors.length} item(s) as sold`);
      }

      setToast({ message: `${idsToUpdate.length} item${idsToUpdate.length !== 1 ? 's' : ''} marked as sold`, type: 'success' });
      exitSelectionMode();
      await refreshItems();
    } catch (err) {
      console.error('Batch mark as sold error:', err);
      setToast({ message: 'Failed to mark items as sold', type: 'error' });
    } finally {
      setIsProcessingBatch(false);
    }
  }, [selectedIds, exitSelectionMode, refreshItems, user]);

  // Scroll container ref for scroll position restoration
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute effective view mode: user selection takes precedence over settings
  const viewMode: ViewMode = userSelectedView ?? settings?.default_view ?? 'gallery';

  const handleViewChange = async (mode: ViewMode) => {
    // Update local state immediately for responsive UI
    setUserSelectedView(mode);

    // Persist to user settings
    setIsUpdatingView(true);
    await updateSettings({ default_view: mode });
    setIsUpdatingView(false);
  };

  const handleSortChange = (sort: InventorySortOption) => {
    // Update URL param using replaceState (no history push)
    const newParams = new URLSearchParams(searchParams);
    if (sort === 'newest') {
      // Remove param if default
      newParams.delete('sort');
    } else {
      newParams.set('sort', getUrlParamFromSort(sort));
    }
    setSearchParams(newParams, { replace: true });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('categories');
    newParams.delete('location');
    // Note: We keep sort as it's not considered a "filter"
    setSearchParams(newParams, { replace: true });
  };

  // Chip click handlers - open respective bottom sheets
  const onCategoryChipClick = () => {
    setIsCategorySheetOpen(true);
  };

  const onLocationChipClick = () => {
    setIsLocationSheetOpen(true);
  };

  // Handle location filter apply
  const handleLocationFilterApply = (locationId: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (locationId) {
      newParams.set('location', locationId);
    } else {
      newParams.delete('location');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Handle category filter apply
  const handleCategoryFilterApply = (categoryIds: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (categoryIds.length > 0) {
      newParams.set('categories', categoryIds.join(','));
    } else {
      newParams.delete('categories');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Compute chip labels
  const categoryChipLabel = hasActiveCategories
    ? selectedCategoryIds.length === 1
      ? '1 Category'
      : `${selectedCategoryIds.length} Categories`
    : 'All Categories';

  // Get selected location name for chip label
  const selectedLocation = locationIdFromUrl
    ? locations.find((l) => l.id === locationIdFromUrl)
    : null;
  const locationChipLabel = selectedLocation
    ? selectedLocation.name
    : 'All Locations';

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await refreshItems();
    } catch {
      setToast({ message: 'Refresh failed', type: 'error' });
    }
  }, [refreshItems, setToast]);

  // Pull-to-refresh hook
  const {
    pullDistance,
    isPulling,
    isRefreshing: isPullRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold: pullThreshold,
  } = usePullToRefresh({ onRefresh: handleRefresh });

  // Save scroll position before navigating away
  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(SCROLL_POSITION_KEY, String(window.scrollY));
      }
    };

    // Save scroll on navigation
    window.addEventListener('beforeunload', saveScrollPosition);

    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition);
      // Save position when component unmounts (navigation away)
      saveScrollPosition();
    };
  }, []);

  // Restore scroll position when coming back from item detail
  useEffect(() => {
    if (!itemsLoading && items.length > 0 && shouldRestoreScrollRef.current && !hasRestoredScrollRef.current) {
      const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (savedPosition) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedPosition, 10));
          hasRestoredScrollRef.current = true;
        });
      }
    }
  }, [itemsLoading, items.length]);

  // Reset scroll restore flag when navigating to item detail
  useEffect(() => {
    // Check if navigation is going to an item detail page
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button');
      if (link) {
        // Items are navigated via onClick, so we check if we're currently on inventory page
        // The scroll position is saved on unmount
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Clear scroll position when sort/filter changes
  useEffect(() => {
    sessionStorage.removeItem(SCROLL_POSITION_KEY);
    shouldRestoreScrollRef.current = false;
    hasRestoredScrollRef.current = false;
  }, [sortFromUrl, locationIdFromUrl, categoriesFromUrl]);

  return (
    <div className="min-h-full bg-[#fdf8f2] pb-32">
      {/* Header - Ownly style */}
      <div className="sticky top-0 z-30 glass border-b border-[#f5ebe0]/40 px-6 py-6 space-y-5">
        {/* Top row: Title and item count with view toggle */}
        <div className="flex items-center justify-between">
          {/* Title and count */}
          <div className="cursor-pointer group" onClick={() => navigate('/dashboard')}>
            <h1 className="text-[11px] font-black text-[#b9a99b] tracking-[0.3em] uppercase group-hover:text-[#4a3f35] transition-colors">
              MY INVENTORY
            </h1>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="w-2 h-2 bg-[#e3ead3] rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-[#8d7b6d] uppercase tracking-[0.25em]">
                {itemsLoading ? 'Loading...' : `${totalCount} ${totalCount === 1 ? 'Item' : 'Items'} Added`}
              </p>
            </div>
          </div>

          {/* Right side: Search, Select, View Toggle */}
          <div className="flex items-center gap-2.5">
            {!isSelectionMode && items.length > 0 && (
              <button
                onClick={enterSelectionMode}
                className="p-4 bg-white/60 rounded-3xl text-[#8d7b6d] active:scale-95 transition-all soft-shadow border border-white/50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </button>
            )}
            <button
              onClick={() => navigate('/search')}
              className="p-4 bg-white/60 rounded-3xl text-[#8d7b6d] active:scale-95 transition-all soft-shadow border border-white/50"
            >
              <SearchIcon />
            </button>
            <div className="bg-white/40 p-1.5 rounded-[2rem] border border-white/50 soft-shadow flex items-center gap-1.5">
              <button
                onClick={() => handleViewChange('gallery')}
                className={`p-2.5 rounded-full transition-all ${viewMode === 'gallery' ? 'bg-[#d6ccc2] text-white' : 'text-[#d6ccc2]'}`}
              >
                <GridIcon filled={viewMode === 'gallery'} />
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`p-2.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-[#d6ccc2] text-white' : 'text-[#d6ccc2]'}`}
              >
                <ListIcon filled={viewMode === 'list'} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar with chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-2 px-2 no-scrollbar">
          <button
            onClick={onCategoryChipClick}
            className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${hasActiveCategories
              ? 'bg-[#fbc4ab] text-white soft-shadow'
              : 'bg-white/60 border border-white/50 text-[#8d7b6d] hover:bg-white'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span>{categoryChipLabel}</span>
          </button>

          <button
            onClick={onLocationChipClick}
            className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${hasActiveLocation
              ? 'bg-[#e3ead3] text-[#4a3f35] soft-shadow'
              : 'bg-white/60 border border-white/50 text-[#8d7b6d] hover:bg-white'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            <span>{locationChipLabel}</span>
          </button>

          <button
            onClick={() => setIsSortSheetOpen(true)}
            className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${sortFromUrl !== 'newest'
              ? 'bg-[#d6ccc2] text-white soft-shadow'
              : 'bg-white/60 border border-white/50 text-[#8d7b6d] hover:bg-white'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21l3.75-3.75" /></svg>
            <span>{getSortLabel(sortFromUrl)}</span>
          </button>

          {hasAnyActiveFilter && (
            <button
              onClick={handleClearAllFilters}
              className="ml-auto text-[9px] font-black text-[#4a3f35] uppercase tracking-widest hover:underline decoration-2 underline-offset-4 pr-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main content area with pull-to-refresh */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={pullThreshold}
          isPulling={isPulling}
          isRefreshing={isPullRefreshing}
        />

        <div className={`p-4 ${isSelectionMode ? 'pb-36' : ''}`}>
          {viewMode === 'gallery' ? (
            <GalleryGrid
              items={items}
              isLoading={itemsLoading}
              isRefreshing={isRefreshing}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              totalCount={totalCount}
              onRefresh={handleRefresh}
              onLoadMore={loadMore}
              error={itemsError}
              hasActiveFilters={hasAnyActiveFilter}
              onClearFilters={handleClearAllFilters}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <ItemList
              items={items}
              isLoading={itemsLoading}
              isRefreshing={isRefreshing}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              totalCount={totalCount}
              onRefresh={handleRefresh}
              onLoadMore={loadMore}
              error={itemsError}
              hasActiveFilters={hasAnyActiveFilter}
              onClearFilters={handleClearAllFilters}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>
      </div>

      {/* Sort Bottom Sheet */}
      <SortBottomSheet
        isOpen={isSortSheetOpen}
        onClose={() => setIsSortSheetOpen(false)}
        currentSort={sortFromUrl}
        onSortChange={handleSortChange}
      />

      {/* Location Filter Bottom Sheet */}
      <LocationFilterBottomSheet
        isOpen={isLocationSheetOpen}
        onClose={() => setIsLocationSheetOpen(false)}
        selectedLocationId={locationIdFromUrl}
        onApplyFilter={handleLocationFilterApply}
      />

      {/* Category Filter Bottom Sheet */}
      <CategoryFilterBottomSheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        selectedCategoryIds={selectedCategoryIds}
        onApplyFilter={handleCategoryFilterApply}
      />

      {/* Selection Toolbar - shown when in selection mode */}
      {isSelectionMode && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          totalCount={items.length}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDelete={handleBatchDelete}
          onMarkAsSold={handleBatchMarkAsSold}
          onCancel={exitSelectionMode}
          isProcessing={isProcessingBatch}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
