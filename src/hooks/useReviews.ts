/**
 * Hook for creating and fetching user reviews
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Review, Transaction } from '@/types/database';

export interface ReviewWithReviewer extends Review {
  reviewer: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface PendingReviewTransaction extends Transaction {
  listing: {
    item_name: string | null;
  };
  other_user: {
    id: string;
    display_name: string | null;
  };
}

export function useReviews() {
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

  const createReview = useCallback(async (data: {
    transaction_id: string;
    reviewee_id: string;
    rating: number;
    comment?: string;
  }): Promise<boolean> => {
    if (!user) return false;
    if (data.rating < 1 || data.rating > 5) return false;

    try {
      const reviewerId = await getProfileId();
      const payload = {
        transaction_id: data.transaction_id,
        reviewer_id: reviewerId,
        reviewee_id: data.reviewee_id,
        rating: data.rating,
        comment: data.comment?.trim().slice(0, 500) || null,
      } as Record<string, unknown>;

      const { error } = await (supabase.from('reviews') as ReturnType<typeof supabase.from>)
        .insert(payload);

      if (error) {
        console.error('Failed to create review:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to create review:', err);
      return false;
    }
  }, [getProfileId, user]);

  const getReviewsForUser = useCallback(async (userId: string): Promise<ReviewWithReviewer[]> => {
    if (!userId) return [];

    const { data, error } = await (supabase.from('reviews') as ReturnType<typeof supabase.from>)
      .select(`
        id,
        transaction_id,
        reviewer_id,
        reviewee_id,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviewer_id(id, display_name, avatar_url)
      `)
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error.message);
      return [];
    }

    return (data as ReviewWithReviewer[]) ?? [];
  }, []);

  const canReviewTransaction = useCallback(async (transactionId: string): Promise<boolean> => {
    if (!user || !transactionId) return false;

    try {
      const reviewerId = await getProfileId();

      const { data: transaction, error } = await (supabase
        .from('transactions') as ReturnType<typeof supabase.from>)
        .select('id, status, buyer_id, seller_id')
        .eq('id', transactionId)
        .single();

      const resolvedTransaction = transaction as {
        id: string;
        status: string;
        buyer_id: string;
        seller_id: string;
      } | null;

      if (error || !resolvedTransaction) {
        console.error('Unable to fetch transaction:', error?.message);
        return false;
      }

      if (resolvedTransaction.status !== 'completed') {
        return false;
      }

      const isParticipant = [resolvedTransaction.buyer_id, resolvedTransaction.seller_id].includes(reviewerId);
      if (!isParticipant) {
        return false;
      }

      const { data: existing, error: reviewError } = await (supabase
        .from('reviews') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('reviewer_id', reviewerId)
        .maybeSingle();

      if (reviewError) {
        console.error('Unable to check existing reviews:', reviewError.message);
        return false;
      }

      return !existing;
    } catch (err) {
      console.error('Unable to validate review eligibility:', err);
      return false;
    }
  }, [getProfileId, user]);

  const getPendingReviews = useCallback(async (): Promise<PendingReviewTransaction[]> => {
    if (!user) return [];

    try {
      const reviewerId = await getProfileId();

      const { data: transactions, error } = await (supabase
        .from('transactions') as ReturnType<typeof supabase.from>)
        .select(`
          id,
          listing_id,
          buyer_id,
          seller_id,
          agreed_price,
          message,
          status,
          created_at,
          updated_at,
          listing:listings(id, item:items(name)),
          buyer:profiles!buyer_id(id, display_name),
          seller:profiles!seller_id(id, display_name)
        `)
        .eq('status', 'completed')
        .or(`buyer_id.eq.${reviewerId},seller_id.eq.${reviewerId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed transactions:', error.message);
        return [];
      }

      const resolvedTransactions = (transactions as Array<{
        id: string;
        listing_id: string;
        buyer_id: string;
        seller_id: string;
        status: string;
        created_at: string;
        agreed_price: number | null;
        message: string | null;
        updated_at: string;
        listing: { id: string; item: { name: string | null } | null } | null;
        buyer: { id: string; display_name: string | null } | null;
        seller: { id: string; display_name: string | null } | null;
      }>) ?? [];

      if (resolvedTransactions.length === 0) {
        return [];
      }

      const transactionIds = resolvedTransactions.map((transaction) => transaction.id);
      const { data: existing, error: reviewsError } = await (supabase
        .from('reviews') as ReturnType<typeof supabase.from>)
        .select('transaction_id')
        .eq('reviewer_id', reviewerId)
        .in('transaction_id', transactionIds);

      if (reviewsError) {
        console.error('Error fetching existing reviews:', reviewsError.message);
        return [];
      }

      const reviewed = new Set((existing as Array<{ transaction_id: string }> | null)?.map((row) => row.transaction_id));

      return resolvedTransactions
        .filter((transaction) => !reviewed.has(transaction.id))
        .map((transaction) => {
          const isBuyer = transaction.buyer_id === reviewerId;
          const otherUser = isBuyer ? transaction.seller : transaction.buyer;

          return {
            id: transaction.id,
            listing_id: transaction.listing_id,
            buyer_id: transaction.buyer_id,
            seller_id: transaction.seller_id,
            status: transaction.status as Transaction['status'],
            agreed_price: transaction.agreed_price,
            message: transaction.message,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at ?? transaction.created_at,
            listing: {
              item_name: transaction.listing?.item?.name ?? null,
            },
            other_user: {
              id: otherUser?.id ?? '',
              display_name: otherUser?.display_name ?? null,
            },
          } as PendingReviewTransaction;
        })
        .filter((transaction) => transaction.other_user.id);
    } catch (err) {
      console.error('Failed to get pending reviews:', err);
      return [];
    }
  }, [getProfileId, user]);

  return { createReview, getReviewsForUser, canReviewTransaction, getPendingReviews };
}
