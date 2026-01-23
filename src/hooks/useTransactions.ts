/**
 * Hook for creating and managing marketplace transactions
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { createMarketplaceNotification } from '@/lib/notifications';
import { useAuth } from '@/hooks/useAuth';
import type { PriceType, Transaction, ListingStatus } from '@/types/database';

export interface TransactionWithBuyer extends Transaction {
  buyer: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    user_id?: string | null;
  } | null;
}

export interface TransactionWithListing extends Transaction {
  listing: {
    id: string;
    price: number | null;
    price_type: PriceType;
    status: ListingStatus;
    item: {
      id: string;
      name: string | null;
      photo_url: string;
      thumbnail_url: string | null;
    } | null;
    seller: {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

interface CreateTransactionInput {
  listing_id: string;
  seller_id: string;
  agreed_price: number | null;
  message: string;
}

export function useTransactions() {
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

  const getUserIdByProfileId = useCallback(async (profileId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('user_id')
      .eq('id', profileId)
      .single();

    const profile = data as { user_id: string } | null;

    if (error || !profile?.user_id) {
      console.warn('Unable to resolve profile user_id:', error?.message);
      return null;
    }

    return profile.user_id;
  }, []);

  const getProfileDisplayName = useCallback(async (profileId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('display_name')
      .eq('id', profileId)
      .single();

    const profile = data as { display_name: string | null } | null;

    if (error) {
      console.warn('Unable to resolve profile display name:', error.message);
      return null;
    }

    return profile?.display_name ?? null;
  }, []);

  const getListingItemName = useCallback(async (listingId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select('item:items(name)')
      .eq('id', listingId)
      .single();

    const listing = data as { item: { name: string | null } | null } | null;

    if (error) {
      console.warn('Unable to resolve listing item name:', error.message);
      return null;
    }

    return listing?.item?.name ?? null;
  }, []);

  const createTransaction = useCallback(async (data: CreateTransactionInput) => {
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    try {
      const buyerId = await getProfileId();
      const payload = {
        listing_id: data.listing_id,
        buyer_id: buyerId,
        seller_id: data.seller_id,
        status: 'pending',
        agreed_price: data.agreed_price,
        message: data.message.trim() || null,
      } as Record<string, unknown>;

      const { data: transaction, error } = await (supabase
        .from('transactions') as ReturnType<typeof supabase.from>)
        .insert(payload)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      const resolvedTransaction = (transaction as Transaction | null) ?? null;

      if (resolvedTransaction) {
        const sellerUserId = await getUserIdByProfileId(data.seller_id);
        if (sellerUserId) {
          try {
            const buyerName =
              (await getProfileDisplayName(buyerId)) ??
              user?.user_metadata?.display_name ??
              'Someone';
            const itemName = await getListingItemName(data.listing_id);

            await createMarketplaceNotification(sellerUserId, 'purchase_request', {
              listing_id: data.listing_id,
              transaction_id: resolvedTransaction.id,
              sender_id: buyerId,
              sender_name: buyerName,
              item_name: itemName ?? undefined,
            });
          } catch (notificationError) {
            console.warn('Failed to create purchase request notification:', notificationError);
          }
        }
      }

      return { data: resolvedTransaction, error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Failed to create transaction'),
      };
    }
  }, [getListingItemName, getProfileDisplayName, getProfileId, getUserIdByProfileId, user]);

  const getTransactionsForListing = useCallback(async (listingId: string): Promise<TransactionWithBuyer[]> => {
    if (!listingId) return [];

    const { data, error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .select('*, buyer:profiles!buyer_id(id, display_name, avatar_url, user_id)')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions for listing:', error);
      throw new Error(error.message);
    }

    return (data as TransactionWithBuyer[]) ?? [];
  }, []);

  const getMyTransactions = useCallback(async (): Promise<TransactionWithListing[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const buyerId = await getProfileId();

    const { data, error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .select(`
        *,
        listing:listings(
          id,
          price,
          price_type,
          status,
          item:items(id, name, photo_url, thumbnail_url),
          seller:profiles(id, display_name, avatar_url)
        )
      `)
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching buyer transactions:', error);
      throw new Error(error.message);
    }

    return (data as TransactionWithListing[]) ?? [];
  }, [getProfileId, user]);

  const acceptTransaction = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { data: transaction, error: fetchError } = await (supabase
      .from('transactions') as ReturnType<typeof supabase.from>)
      .select('id, listing_id, buyer_id, seller_id')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      console.error('Error fetching transaction:', fetchError);
      return false;
    }

    const { error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .update({ status: 'accepted' } as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      console.error('Error accepting transaction:', error);
      return false;
    }

    const { error: listingError } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .update({ status: 'reserved' } as Record<string, unknown>)
      .eq('id', transaction.listing_id as string);

    if (listingError) {
      console.error('Error reserving listing:', listingError);
      return false;
    }

    const buyerUserId = await getUserIdByProfileId(transaction.buyer_id as string);
    if (buyerUserId) {
      try {
        const sellerName =
          (await getProfileDisplayName(transaction.seller_id as string)) ?? 'Seller';
        const itemName = await getListingItemName(transaction.listing_id as string);

        await createMarketplaceNotification(buyerUserId, 'request_accepted', {
          listing_id: transaction.listing_id as string,
          transaction_id: transaction.id as string,
          sender_id: transaction.seller_id as string,
          sender_name: sellerName,
          item_name: itemName ?? undefined,
        });
      } catch (notificationError) {
        console.warn('Failed to create acceptance notification:', notificationError);
      }
    }

    return true;
  }, [getListingItemName, getProfileDisplayName, getUserIdByProfileId, user]);

  const declineTransaction = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { data: transaction, error: fetchError } = await (supabase
      .from('transactions') as ReturnType<typeof supabase.from>)
      .select('id, listing_id, buyer_id, seller_id')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      console.error('Error fetching transaction:', fetchError);
      return false;
    }

    const { error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .update({ status: 'cancelled' } as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      console.error('Error declining transaction:', error);
      return false;
    }

    const buyerUserId = await getUserIdByProfileId(transaction.buyer_id as string);
    if (buyerUserId) {
      try {
        const sellerName =
          (await getProfileDisplayName(transaction.seller_id as string)) ?? 'Seller';
        const itemName = await getListingItemName(transaction.listing_id as string);

        await createMarketplaceNotification(buyerUserId, 'request_declined', {
          listing_id: transaction.listing_id as string,
          transaction_id: transaction.id as string,
          sender_id: transaction.seller_id as string,
          sender_name: sellerName,
          item_name: itemName ?? undefined,
        });
      } catch (notificationError) {
        console.warn('Failed to create decline notification:', notificationError);
      }
    }

    return true;
  }, [getListingItemName, getProfileDisplayName, getUserIdByProfileId, user]);

  const completeTransaction = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { data: transaction, error: fetchError } = await (supabase
      .from('transactions') as ReturnType<typeof supabase.from>)
      .select('listing_id, buyer_id, seller_id')
      .eq('id', id)
      .single();

    if (fetchError || !transaction) {
      console.error('Error fetching transaction:', fetchError);
      return false;
    }

    const { error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .update({ status: 'completed' } as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      console.error('Error completing transaction:', error);
      return false;
    }

    const { error: listingError } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .update({ status: 'sold' } as Record<string, unknown>)
      .eq('id', transaction.listing_id as string);

    if (listingError) {
      console.error('Error marking listing as sold:', listingError);
      return false;
    }

    const buyerUserId = await getUserIdByProfileId(transaction.buyer_id as string);
    if (buyerUserId) {
      try {
        const sellerName =
          (await getProfileDisplayName(transaction.seller_id as string)) ?? 'Seller';
        const itemName = await getListingItemName(transaction.listing_id as string);

        await createMarketplaceNotification(buyerUserId, 'transaction_complete', {
          listing_id: transaction.listing_id as string,
          transaction_id: id,
          sender_id: transaction.seller_id as string,
          sender_name: sellerName,
          item_name: itemName ?? undefined,
        });
      } catch (notificationError) {
        console.warn('Failed to create completion notification:', notificationError);
      }
    }

    return true;
  }, [getListingItemName, getProfileDisplayName, getUserIdByProfileId, user]);

  const getPendingCountsForListings = useCallback(async (listingIds: string[]): Promise<Record<string, number>> => {
    if (listingIds.length === 0) return {};

    const { data, error } = await (supabase.from('transactions') as ReturnType<typeof supabase.from>)
      .select('listing_id')
      .in('listing_id', listingIds)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending transaction counts:', error);
      throw new Error(error.message);
    }

    const counts: Record<string, number> = {};
    (data as Array<{ listing_id: string }> | null)?.forEach((row) => {
      counts[row.listing_id] = (counts[row.listing_id] ?? 0) + 1;
    });

    return counts;
  }, []);

  return {
    createTransaction,
    getTransactionsForListing,
    getMyTransactions,
    acceptTransaction,
    declineTransaction,
    completeTransaction,
    getPendingCountsForListings,
  };
}
