/**
 * Hook for fetching dashboard statistics
 * Provides counts for items, locations, and expiring items
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface DashboardStats {
  totalItems: number;
  totalLocations: number;
  expiringItems: number;
}

export interface UseDashboardStatsReturn {
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Get dashboard statistics (items, locations, expiring)
 */
export function useDashboardStats(): UseDashboardStatsReturn {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalLocations: 0,
    expiringItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all stats in parallel for better performance
      const [itemsResult, locationsResult, expiringResult] = await Promise.all([
        // Total items count (excluding soft-deleted)
        supabase
          .from('items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('deleted_at', null),

        // Total locations count (excluding soft-deleted)
        supabase
          .from('locations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('deleted_at', null),

        // Expiring items count (within 30 days, excluding soft-deleted)
        (() => {
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          return supabase
            .from('items')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .not('expiration_date', 'is', null)
            .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0]);
        })(),
      ]);

      // Check for errors
      if (itemsResult.error) {
        throw new Error(itemsResult.error.message);
      }
      if (locationsResult.error) {
        throw new Error(locationsResult.error.message);
      }
      if (expiringResult.error) {
        throw new Error(expiringResult.error.message);
      }

      setStats({
        totalItems: itemsResult.count ?? 0,
        totalLocations: locationsResult.count ?? 0,
        expiringItems: expiringResult.count ?? 0,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
