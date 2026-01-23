/**
 * Hook for managing saved marketplace listings (wishlist)
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { MarketplaceListing } from '@/hooks/useMarketplace';

interface RawMarketplaceListing extends Omit<MarketplaceListing, 'item' | 'seller'> {
  item: MarketplaceListing['item'] & { category_id: string | null };
  seller: MarketplaceListing['seller'];
}

interface SavedListingRow {
  created_at: string;
  listing: RawMarketplaceListing | null;
}

function normalizeListing(raw: RawMarketplaceListing): MarketplaceListing {
  return {
    ...raw,
    item: {
      id: raw.item.id,
      name: raw.item.name,
      photo_url: raw.item.photo_url,
      thumbnail_url: raw.item.thumbnail_url,
    },
    seller: {
      id: raw.seller.id,
      user_id: raw.seller.user_id,
      display_name: raw.seller.display_name,
      avatar_url: raw.seller.avatar_url,
      location_city: raw.seller.location_city,
      seller_rating: raw.seller.seller_rating,
      review_count: raw.seller.review_count,
      created_at: raw.seller.created_at,
    },
  };
}

export function useSavedListings() {
  const { user } = useAuth();

  const getProfileId = useCallback(async (): Promise<string> => {
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

  const getSavedListings = useCallback(async (): Promise<MarketplaceListing[]> => {
    if (!user) return [];

    const profileId = await getProfileId();

    const { data, error } = await (supabase.from('saved_listings') as ReturnType<typeof supabase.from>)
      .select(`
        created_at,
        listing:listings(
          id,
          item_id,
          price,
          price_type,
          condition,
          status,
          description,
          view_count,
          created_at,
          item:items!inner(id, name, photo_url, thumbnail_url, category_id),
          seller:profiles!listings_seller_id_fkey(id, user_id, display_name, avatar_url, location_city, seller_rating, review_count, created_at)
        )
      `)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = (data as SavedListingRow[] | null) ?? [];

    return rows
      .map((row) => row.listing)
      .filter((listing): listing is RawMarketplaceListing => Boolean(listing))
      .map(normalizeListing);
  }, [getProfileId, user]);

  const isListingSaved = useCallback(async (listingId: string): Promise<boolean> => {
    if (!user || !listingId) return false;

    try {
      const profileId = await getProfileId();

      const { data, error } = await (supabase.from('saved_listings') as ReturnType<typeof supabase.from>)
        .select('listing_id')
        .eq('user_id', profileId)
        .eq('listing_id', listingId)
        .maybeSingle();

      if (error) {
        console.error('Error checking saved listing:', error.message);
        return false;
      }

      return Boolean(data);
    } catch (err) {
      console.error('Error checking saved listing:', err);
      return false;
    }
  }, [getProfileId, user]);

  const saveListing = useCallback(async (listingId: string): Promise<boolean> => {
    if (!user || !listingId) return false;

    try {
      const profileId = await getProfileId();
      const { error } = await (supabase.from('saved_listings') as ReturnType<typeof supabase.from>)
        .upsert(
          {
            user_id: profileId,
            listing_id: listingId,
          },
          { onConflict: 'user_id,listing_id' }
        );

      if (error) {
        console.error('Error saving listing:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving listing:', err);
      return false;
    }
  }, [getProfileId, user]);

  const unsaveListing = useCallback(async (listingId: string): Promise<boolean> => {
    if (!user || !listingId) return false;

    try {
      const profileId = await getProfileId();
      const { error } = await (supabase.from('saved_listings') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('user_id', profileId)
        .eq('listing_id', listingId);

      if (error) {
        console.error('Error removing saved listing:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error removing saved listing:', err);
      return false;
    }
  }, [getProfileId, user]);

  const toggleSave = useCallback(async (listingId: string): Promise<boolean> => {
    const saved = await isListingSaved(listingId);
    return saved ? unsaveListing(listingId) : saveListing(listingId);
  }, [isListingSaved, saveListing, unsaveListing]);

  return { getSavedListings, isListingSaved, saveListing, unsaveListing, toggleSave };
}
