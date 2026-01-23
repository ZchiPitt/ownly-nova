/**
 * Hook for creating and retrieving marketplace listings
 */

import { useCallback } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Listing, ItemCondition, PriceType, ListingStatus } from '@/types/database';

interface CreateListingInput {
  item_id: string;
  price: number | null;
  price_type: PriceType;
  condition: ItemCondition;
  description: string;
}

export interface ListingWithItem extends Listing {
  item: {
    id: string;
    name: string | null;
    photo_url: string;
    thumbnail_url: string | null;
  };
}

export function useListings() {
  const { user } = useAuth();

  const getSellerProfileId = useCallback(async (): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('user_id', user.id)
      .single();

    const profile = data as { id: string } | null;

    if (error || !profile) {
      throw new Error(error?.message || 'Profile not found');
    }

    return profile.id;
  }, [user]);

  const createListing = useCallback(
    async (data: CreateListingInput): Promise<{ data: Listing | null; error: Error | null }> => {
      if (!user) {
        return { data: null, error: new Error('User not authenticated') };
      }

      try {
        const sellerId = await getSellerProfileId();

        const { data: listing, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
          .insert({
            item_id: data.item_id,
            seller_id: sellerId,
            price: data.price_type === 'free' ? null : data.price,
            price_type: data.price_type,
            condition: data.condition,
            description: data.description || null,
            status: 'active',
          } as Record<string, unknown>)
          .select()
          .single();

        if (error) {
          return { data: null, error: new Error(error.message) };
        }

        return { data: (listing as Listing | null) ?? null, error: null };
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err : new Error('Failed to create listing'),
        };
      }
    },
    [getSellerProfileId, user]
  );

  const getListingByItemId = useCallback(async (itemId: string): Promise<Listing | null> => {
    if (!user || !itemId) return null;

    const { data, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('item_id', itemId)
      .eq('status', 'active')
      .single();

    if (error) {
      const pgError = error as PostgrestError;
      if (pgError.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching listing:', error);
      return null;
    }

    return (data as Listing | null) ?? null;
  }, [user]);

  const getMyListings = useCallback(async (status?: ListingStatus): Promise<ListingWithItem[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const sellerId = await getSellerProfileId();

    let query = (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select('*, item:items(id, name, photo_url, thumbnail_url)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      throw new Error(error.message);
    }

    return (data as ListingWithItem[]) ?? [];
  }, [getSellerProfileId, user]);

  const updateListing = useCallback(async (id: string, data: Partial<Listing>): Promise<boolean> => {
    if (!user) {
      return false;
    }

    const { error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .update(data as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      console.error('Error updating listing:', error);
      return false;
    }

    return true;
  }, [user]);

  const markAsSold = useCallback(async (id: string): Promise<boolean> => (
    updateListing(id, { status: 'sold' })
  ), [updateListing]);

  const removeListing = useCallback(async (id: string): Promise<boolean> => (
    updateListing(id, { status: 'removed' })
  ), [updateListing]);

  return {
    createListing,
    getListingByItemId,
    getMyListings,
    updateListing,
    markAsSold,
    removeListing,
  };
}
