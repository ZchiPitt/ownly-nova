/**
 * Hook for fetching the user's most recently used location
 * Used to pre-populate the location field when adding new items
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook for fetching the most recently used location
 * @returns Object with locationId, loading state, and refetch function
 */
export function useRecentLocation() {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentLocation = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch the most recent item that has a location
      const { data, error } = await supabase
        .from('items')
        .select('location_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('location_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<{ location_id: string }[]>();

      if (error) {
        console.error('Error fetching recent location:', error);
      }

      setLocationId(data?.[0]?.location_id || null);
    } catch (err) {
      console.error('Error fetching recent location:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecentLocation();
  }, [fetchRecentLocation]);

  return {
    locationId,
    isLoading,
    refetch: fetchRecentLocation,
  };
}
