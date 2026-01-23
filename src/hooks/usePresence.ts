/**
 * Hook for managing user presence tracking
 * US-003: Add user presence tracking for smart push suppression
 * US-005: Clear pending batches when user views conversation
 *
 * Tracks which listing conversation a user is currently viewing
 * to suppress redundant push notifications and clear pending batches.
 */

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/types/database';

/** Interval for updating presence while active (20 seconds) */
const PRESENCE_UPDATE_INTERVAL = 20 * 1000;

export interface UsePresenceReturn {
  /** Set the active listing conversation the user is viewing */
  setActiveConversation: (listingId: string) => Promise<void>;
  /** Clear presence (user left the conversation) */
  clearPresence: () => Promise<void>;
  /** Clear pending push notification batches for a specific listing */
  clearPendingBatch: (listingId: string) => Promise<void>;
}

export function usePresence(): UsePresenceReturn {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const activeListingRef = useRef<string | null>(null);

  /**
   * Update presence in the database
   */
  const updatePresence = useCallback(async (listingId: string | null): Promise<void> => {
    if (!user) return;

    try {
      type PresenceInsert = Database['public']['Tables']['user_presence']['Insert'];
      const presenceData: PresenceInsert = {
        user_id: user.id,
        active_listing_id: listingId,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase
        .from('user_presence') as ReturnType<typeof supabase.from>)
        .upsert(presenceData as Record<string, unknown>, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (err) {
      console.error('Error updating presence:', err);
    }
  }, [user]);

  /**
   * Start periodic presence updates
   */
  const startPresenceUpdates = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }

    // Update presence periodically while user is active
    intervalRef.current = window.setInterval(() => {
      if (activeListingRef.current) {
        updatePresence(activeListingRef.current);
      }
    }, PRESENCE_UPDATE_INTERVAL);
  }, [updatePresence]);

  /**
   * Stop periodic presence updates
   */
  const stopPresenceUpdates = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Clear pending push notification batches when user views a conversation
   * This ensures users don't receive batched notifications for messages
   * they're already viewing.
   */
  const clearPendingBatch = useCallback(async (listingId: string): Promise<void> => {
    if (!user) return;

    try {
      // Delete any pending batches for this user/listing combination
      const { error } = await (supabase
        .from('pending_push_notifications') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);

      if (error) {
        console.error('Error clearing pending batch:', error);
      }
    } catch (err) {
      console.error('Error clearing pending batch:', err);
    }
  }, [user]);

  /**
   * Set the active listing conversation the user is viewing
   */
  const setActiveConversation = useCallback(async (listingId: string): Promise<void> => {
    activeListingRef.current = listingId;
    await updatePresence(listingId);
    // Clear any pending batches for this conversation since user is now viewing it
    await clearPendingBatch(listingId);
    startPresenceUpdates();
  }, [updatePresence, clearPendingBatch, startPresenceUpdates]);

  /**
   * Clear presence (user left the conversation)
   */
  const clearPresence = useCallback(async (): Promise<void> => {
    activeListingRef.current = null;
    stopPresenceUpdates();
    await updatePresence(null);
  }, [updatePresence, stopPresenceUpdates]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPresenceUpdates();
    };
  }, [stopPresenceUpdates]);

  // Clean up presence when user logs out
  useEffect(() => {
    if (!user && activeListingRef.current) {
      activeListingRef.current = null;
      stopPresenceUpdates();
    }
  }, [user, stopPresenceUpdates]);

  return {
    setActiveConversation,
    clearPresence,
    clearPendingBatch,
  };
}
