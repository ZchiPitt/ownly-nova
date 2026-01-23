/**
 * Hook for fetching marketplace listings with filters and pagination
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ItemCondition, ListingStatus, PriceType } from '@/types/database';

export interface MarketplaceFilters {
  categories: string[];
  conditions: string[];
  priceType: 'all' | 'free';
  minPrice: number | null;
  maxPrice: number | null;
  search?: string;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc';

export interface MarketplaceListing {
  id: string;
  item_id: string;
  price: number | null;
  price_type: PriceType;
  condition: ItemCondition;
  status: ListingStatus;
  description: string | null;
  view_count: number;
  created_at: string;
  item: {
    id: string;
    name: string | null;
    photo_url: string;
    thumbnail_url: string | null;
  };
  seller: {
    id: string;
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    location_city: string | null;
    seller_rating: number | null;
    review_count: number | null;
    created_at: string;
  };
}

export interface MarketplaceQueryOptions {
  filters?: MarketplaceFilters;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  excludeUserId?: string;
}

interface RawMarketplaceListing extends Omit<MarketplaceListing, 'item' | 'seller'> {
  item: MarketplaceListing['item'] & {
    category_id: string | null;
    categories?: {
      name: string;
    } | null;
  };
  seller: MarketplaceListing['seller'];
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

export const MARKETPLACE_PAGE_SIZE = 20;

export function useMarketplace() {
  const getListings = useCallback(async (options: MarketplaceQueryOptions) => {
    const {
      filters,
      sort = 'newest',
      page = 0,
      pageSize = MARKETPLACE_PAGE_SIZE,
      excludeUserId,
    } = options;

    const offset = page * pageSize;

    let query = (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select(`
        id,
        item_id,
        price,
        price_type,
        condition,
        status,
        description,
        view_count,
        created_at,
        item:items!inner(id, name, photo_url, thumbnail_url, category_id, categories(name)),
        seller:profiles!listings_seller_id_fkey(id, user_id, display_name, avatar_url, location_city, seller_rating, review_count, created_at)
      `)
      .eq('status', 'active');

    if (excludeUserId) {
      query = query.neq('seller_id', excludeUserId);
    }

    if (filters) {
      if (filters.categories.length > 0) {
        query = query.in('item.category_id', filters.categories);
      }

      if (filters.conditions.length > 0) {
        query = query.in('condition', filters.conditions);
      }

      if (filters.priceType === 'free') {
        query = query.eq('price_type', 'free');
      }

      if (filters.minPrice !== null) {
        query = query.gte('price', filters.minPrice);
      }

      if (filters.maxPrice !== null) {
        query = query.lte('price', filters.maxPrice);
      }

      const searchTerm = filters.search?.trim();
      if (searchTerm && searchTerm.length > 0) {
        const safeSearchTerm = searchTerm.replace(/,/g, ' ');
        // Search on item name using referencedTable for foreign table filtering
        query = query.or(`name.ilike.%${safeSearchTerm}%`, { referencedTable: 'items' });
      }
    }

    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true, nullsFirst: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false, nullsFirst: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const rawListings = (data as RawMarketplaceListing[] | null) ?? [];
    const listings = rawListings.map(normalizeListing);

    return {
      listings,
      hasMore: listings.length === pageSize,
    };
  }, []);

  const getListingById = useCallback(async (id: string) => {
    const { data, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select(`
        id,
        item_id,
        price,
        price_type,
        condition,
        status,
        description,
        view_count,
        created_at,
        item:items!inner(id, name, photo_url, thumbnail_url, category_id, categories(name)),
        seller:profiles!listings_seller_id_fkey(id, user_id, display_name, avatar_url, location_city, seller_rating, review_count, created_at)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return normalizeListing(data as RawMarketplaceListing);
  }, []);

  return { getListings, getListingById };
}
