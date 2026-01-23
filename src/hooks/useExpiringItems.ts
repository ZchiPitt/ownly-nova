/**
 * Hook for fetching items expiring within a specified number of days
 * Used for the Dashboard "Expiring Soon" section
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface ExpiringItem {
  id: string;
  name: string | null;
  thumbnail_url: string | null;
  photo_url: string;
  expiration_date: string;
  daysRemaining: number;
}

// Type for the raw item data from Supabase query
interface RawExpiringItem {
  id: string;
  name: string | null;
  thumbnail_url: string | null;
  photo_url: string;
  expiration_date: string | null;
}

export interface UseExpiringItemsReturn {
  items: ExpiringItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Get items expiring within the specified number of days
 * @param days Number of days to look ahead (default: 7)
 * @param limit Maximum number of items to return (default: 3)
 */
export function useExpiringItems(days: number = 7, limit: number = 3): UseExpiringItemsReturn {
  const { user } = useAuth();
  const [items, setItems] = useState<ExpiringItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpiringItems = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Fetch items expiring within the specified days
      // Order by expiration_date ascending (soonest first)
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('id, name, thumbnail_url, photo_url, expiration_date')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('expiration_date', 'is', null)
        .lte('expiration_date', futureDate.toISOString().split('T')[0])
        .order('expiration_date', { ascending: true })
        .limit(limit)
        .returns<RawExpiringItem[]>();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Calculate days remaining for each item
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expiringItems: ExpiringItem[] = (data ?? []).map((item) => {
        const expirationDate = new Date(item.expiration_date!);
        expirationDate.setHours(0, 0, 0, 0);
        const diffTime = expirationDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          name: item.name,
          thumbnail_url: item.thumbnail_url,
          photo_url: item.photo_url,
          expiration_date: item.expiration_date!,
          daysRemaining: diffDays,
        };
      });

      setItems(expiringItems);
    } catch (err) {
      console.error('Error fetching expiring items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expiring items');
    } finally {
      setIsLoading(false);
    }
  }, [user, days, limit]);

  useEffect(() => {
    fetchExpiringItems();
  }, [fetchExpiringItems]);

  return {
    items,
    isLoading,
    error,
    refetch: fetchExpiringItems,
  };
}
