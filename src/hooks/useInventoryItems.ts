/**
 * Hook for fetching all inventory items with pagination support
 * Used on the Inventory page to display items in gallery or list view
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/**
 * Default page size for pagination
 */
export const PAGE_SIZE = 20;

/**
 * Inventory item data structure for display
 */
export interface InventoryItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  source_batch_id: string | null;
  shared_photo_count: number;
  tags: string[];
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  location_id: string | null;
  location_name: string | null;
  location_path: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  expiration_date: string | null;
  is_favorite: boolean;
  has_active_listing: boolean;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
}

/**
 * Sort options for inventory items
 */
export type InventorySortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'expiring' | 'viewed';

/**
 * Sort option configuration for display
 */
export interface SortOptionConfig {
  key: InventorySortOption;
  label: string;
  urlParam: string;
}

/**
 * All available sort options with display labels and URL params
 */
export const SORT_OPTIONS: SortOptionConfig[] = [
  { key: 'newest', label: 'Newest First', urlParam: 'newest' },
  { key: 'oldest', label: 'Oldest First', urlParam: 'oldest' },
  { key: 'name_asc', label: 'Name A-Z', urlParam: 'az' },
  { key: 'name_desc', label: 'Name Z-A', urlParam: 'za' },
  { key: 'expiring', label: 'Expiring Soon', urlParam: 'expiring' },
  { key: 'viewed', label: 'Recently Viewed', urlParam: 'viewed' },
];

/**
 * Get sort option from URL param
 */
export function getSortFromUrlParam(param: string | null): InventorySortOption {
  if (!param) return 'newest';
  const option = SORT_OPTIONS.find(opt => opt.urlParam === param);
  return option?.key ?? 'newest';
}

/**
 * Get URL param from sort option
 */
export function getUrlParamFromSort(sort: InventorySortOption): string {
  const option = SORT_OPTIONS.find(opt => opt.key === sort);
  return option?.urlParam ?? 'newest';
}

/**
 * Get display label from sort option
 */
export function getSortLabel(sort: InventorySortOption): string {
  const option = SORT_OPTIONS.find(opt => opt.key === sort);
  return option?.label ?? 'Newest First';
}

interface UseInventoryItemsOptions {
  sortBy?: InventorySortOption;
  categoryId?: string | null;
  categoryIds?: string[]; // Support multiple category IDs for multi-select filter
  locationId?: string | null;
  showExpiringSoon?: boolean;
}

/**
 * Raw item type from Supabase query
 */
interface RawInventoryItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  source_batch_id: string | null;
  tags: string[];
  category_id: string | null;
  location_id: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  expiration_date: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
  categories: {
    name: string;
    color: string;
    icon: string;
  } | null;
  locations: {
    name: string;
    path: string;
  } | null;
}

/**
 * Transform raw Supabase data to InventoryItem format
 */
function transformRawItem(
  item: RawInventoryItem,
  sharedPhotoCount: number,
  hasActiveListing: boolean
): InventoryItem {
  return {
    id: item.id,
    name: item.name,
    photo_url: item.photo_url,
    thumbnail_url: item.thumbnail_url,
    source_batch_id: item.source_batch_id,
    shared_photo_count: sharedPhotoCount,
    tags: item.tags || [],
    category_id: item.category_id,
    category_name: item.categories?.name || null,
    category_color: item.categories?.color || null,
    category_icon: item.categories?.icon || null,
    location_id: item.location_id,
    location_name: item.locations?.name || null,
    location_path: item.locations?.path || null,
    quantity: item.quantity,
    price: item.price,
    currency: item.currency,
    expiration_date: item.expiration_date,
    is_favorite: item.is_favorite,
    has_active_listing: hasActiveListing,
    created_at: item.created_at,
    updated_at: item.updated_at,
    last_viewed_at: item.last_viewed_at,
  };
}

async function fetchSharedPhotoCounts(
  batchIds: string[],
  userId: string
): Promise<Record<string, number>> {
  const uniqueBatchIds = Array.from(new Set(batchIds.filter(Boolean)));
  if (uniqueBatchIds.length === 0) return {};

  const { data, error } = await supabase
    .from('items')
    .select('id, source_batch_id')
    .in('source_batch_id', uniqueBatchIds)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .returns<{ id: string; source_batch_id: string | null }[]>();

  if (error || !data) {
    console.error('Error fetching shared photo counts:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  data.forEach((row) => {
    if (!row.source_batch_id) return;
    counts[row.source_batch_id] = (counts[row.source_batch_id] ?? 0) + 1;
  });

  return counts;
}

async function fetchActiveListingIds(itemIds: string[]): Promise<Set<string>> {
  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
  if (uniqueItemIds.length === 0) return new Set();

  const { data, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
    .select('item_id')
    .in('item_id', uniqueItemIds)
    .eq('status', 'active');

  const listingRows = data as { item_id: string }[] | null;

  if (error || !listingRows) {
    console.error('Error fetching active listings:', error);
    return new Set();
  }

  return new Set(listingRows.map((row) => row.item_id));
}

/**
 * Hook for fetching inventory items with filtering, sorting, and pagination
 * @param options - Filtering and sorting options
 * @returns Object with items, loading state, error, pagination, and control functions
 */
export function useInventoryItems(options: UseInventoryItemsOptions = {}) {
  const { user } = useAuth();
  const { sortBy = 'newest', categoryId, categoryIds, locationId, showExpiringSoon } = options;
  const categoryIdsKey = categoryIds ? [...categoryIds].sort().join(',') : '';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Track the last sort/filter options to detect changes
  const lastOptionsRef = useRef({ userId: user?.id ?? null, sortBy, categoryId, categoryIdsKey, locationId, showExpiringSoon });
  const hasFetchedOnceRef = useRef(false);

  /**
   * Build the base query with filters applied
   */
  const buildQuery = useCallback(() => {
    let query = supabase
      .from('items')
      .select(`
        id,
        name,
        photo_url,
        thumbnail_url,
        source_batch_id,
        tags,
        category_id,
        location_id,
        quantity,
        price,
        currency,
        expiration_date,
        is_favorite,
        created_at,
        updated_at,
        last_viewed_at,
        categories (
          name,
          color,
          icon
        ),
        locations (
          name,
          path
        )
      `)
      .eq('user_id', user?.id ?? '')
      .is('deleted_at', null);

    // Apply filters
    // Support both single categoryId and multiple categoryIds (multi-select filter)
    if (categoryIds && categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    } else if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (showExpiringSoon) {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      query = query
        .not('expiration_date', 'is', null)
        .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('expiration_date', today.toISOString().split('T')[0]);
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true, nullsFirst: false });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false, nullsFirst: false });
        break;
      case 'expiring':
        query = query.order('expiration_date', { ascending: true, nullsFirst: false });
        break;
      case 'viewed':
        query = query.order('last_viewed_at', { ascending: false, nullsFirst: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    return query;
  }, [user?.id, sortBy, categoryId, categoryIds, locationId, showExpiringSoon]);

  /**
   * Fetch total count for the current filters
   */
  const fetchTotalCount = useCallback(async () => {
    if (!user) return 0;

    let query = supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    // Support both single categoryId and multiple categoryIds
    if (categoryIds && categoryIds.length > 0) {
      query = query.in('category_id', categoryIds);
    } else if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (showExpiringSoon) {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      query = query
        .not('expiration_date', 'is', null)
        .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('expiration_date', today.toISOString().split('T')[0]);
    }

    const { count } = await query;
    return count ?? 0;
  }, [user, categoryId, categoryIds, locationId, showExpiringSoon]);

  /**
   * Fetch initial page of items
   */
  const fetchItems = useCallback(async (isRefresh: boolean = false) => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Fetch count and first page in parallel
      const [count, { data, error: fetchError }] = await Promise.all([
        fetchTotalCount(),
        buildQuery()
          .range(0, PAGE_SIZE - 1)
          .returns<RawInventoryItem[]>()
      ]);

      if (fetchError) {
        throw fetchError;
      }

      const rawItems = data || [];
      const [sharedCounts, activeListingIds] = await Promise.all([
        fetchSharedPhotoCounts(
          rawItems.map((item) => item.source_batch_id || '').filter(Boolean),
          user.id
        ),
        fetchActiveListingIds(rawItems.map((item) => item.id)),
      ]);
      const inventoryItems = rawItems.map((item) => {
        const batchId = item.source_batch_id;
        const totalShared = batchId ? sharedCounts[batchId] ?? 1 : 1;
        const sharedPhotoCount = batchId ? Math.max(totalShared - 1, 0) : 0;
        const hasActiveListing = activeListingIds.has(item.id);
        return transformRawItem(item, sharedPhotoCount, hasActiveListing);
      });

      setItems(inventoryItems);
      setTotalCount(count);
      setHasMore(inventoryItems.length >= PAGE_SIZE && inventoryItems.length < count);

      // Update the last options ref
      lastOptionsRef.current = { userId: user.id, sortBy, categoryId, categoryIdsKey, locationId, showExpiringSoon };
      hasFetchedOnceRef.current = true;
    } catch (err) {
      console.error('Error fetching inventory items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, sortBy, categoryId, categoryIdsKey, locationId, showExpiringSoon, buildQuery, fetchTotalCount]);

  /**
   * Load more items (next page)
   */
  const loadMore = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore || isLoading || isRefreshing) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const currentOffset = items.length;
      const { data, error: fetchError } = await buildQuery()
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)
        .returns<RawInventoryItem[]>();

      if (fetchError) {
        throw fetchError;
      }

      const rawItems = data || [];
      const [sharedCounts, activeListingIds] = await Promise.all([
        fetchSharedPhotoCounts(
          rawItems.map((item) => item.source_batch_id || '').filter(Boolean),
          user.id
        ),
        fetchActiveListingIds(rawItems.map((item) => item.id)),
      ]);
      const newItems = rawItems.map((item) => {
        const batchId = item.source_batch_id;
        const totalShared = batchId ? sharedCounts[batchId] ?? 1 : 1;
        const sharedPhotoCount = batchId ? Math.max(totalShared - 1, 0) : 0;
        const hasActiveListing = activeListingIds.has(item.id);
        return transformRawItem(item, sharedPhotoCount, hasActiveListing);
      });

      setItems((prevItems) => [...prevItems, ...newItems]);
      setHasMore(newItems.length >= PAGE_SIZE && (items.length + newItems.length) < totalCount);
    } catch (err) {
      console.error('Error loading more items:', err);
      // Don't set error state for pagination errors - just log and stop
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, isLoadingMore, hasMore, isLoading, isRefreshing, items.length, totalCount, buildQuery]);

  // Initial fetch and refetch on option changes
  useEffect(() => {
    if (!user) return;

    const optionsChanged =
      lastOptionsRef.current.userId !== user.id ||
      lastOptionsRef.current.sortBy !== sortBy ||
      lastOptionsRef.current.categoryId !== categoryId ||
      lastOptionsRef.current.categoryIdsKey !== categoryIdsKey ||
      lastOptionsRef.current.locationId !== locationId ||
      lastOptionsRef.current.showExpiringSoon !== showExpiringSoon;

    if (!hasFetchedOnceRef.current || optionsChanged) {
      fetchItems();
    }
  }, [user, fetchItems, sortBy, categoryId, categoryIdsKey, locationId, showExpiringSoon]);

  const refetch = useCallback(() => fetchItems(false), [fetchItems]);
  const refresh = useCallback(() => fetchItems(true), [fetchItems]);

  return {
    items,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    totalCount,
    error,
    refetch,
    refresh,
    loadMore,
  };
}
