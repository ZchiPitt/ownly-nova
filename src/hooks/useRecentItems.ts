/**
 * Hook for fetching recently added items
 * Used on the Dashboard to show the most recent items added by the user
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/**
 * Recent item data structure
 */
export interface RecentItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  category_name: string | null;
  category_color: string | null;
  created_at: string;
}

/**
 * Hook for fetching recently added items
 * @param limit - Maximum number of items to fetch (default: 5)
 * @returns Object with items, loading state, error, and refetch function
 */
export function useRecentItems(limit: number = 5) {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch most recent items with category info
      const { data, error: fetchError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          photo_url,
          thumbnail_url,
          created_at,
          categories (
            name,
            color
          )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<Array<{
          id: string;
          name: string | null;
          photo_url: string;
          thumbnail_url: string | null;
          created_at: string;
          categories: {
            name: string;
            color: string;
          } | null;
        }>>();

      if (fetchError) {
        throw fetchError;
      }

      // Transform data to RecentItem format
      const recentItems: RecentItem[] = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        photo_url: item.photo_url,
        thumbnail_url: item.thumbnail_url,
        category_name: item.categories?.name || null,
        category_color: item.categories?.color || null,
        created_at: item.created_at,
      }));

      setItems(recentItems);
    } catch (err) {
      console.error('Error fetching recent items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recent items');
    } finally {
      setIsLoading(false);
    }
  }, [limit, user]);

  useEffect(() => {
    fetchRecentItems();
  }, [fetchRecentItems]);

  return {
    items,
    isLoading,
    error,
    refetch: fetchRecentItems,
  };
}
