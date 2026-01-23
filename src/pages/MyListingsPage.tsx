/**
 * My Listings Page - manage user's marketplace listings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useListings, type ListingWithItem } from '@/hooks/useListings';
import { useToast } from '@/hooks/useToast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { EditListingModal } from '@/components/EditListingModal';
import { ReviewModal } from '@/components/ReviewModal';
import { useTransactions } from '@/hooks/useTransactions';
import { useReviews, type PendingReviewTransaction } from '@/hooks/useReviews';
import type { ListingStatus, PriceType } from '@/types/database';

type TabFilter = 'all' | 'active' | 'sold' | 'removed';

const tabs: Array<{ key: TabFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'sold', label: 'Sold' },
  { key: 'removed', label: 'Removed' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPrice(price: number | null, priceType: PriceType): string {
  if (priceType === 'free') {
    return 'Free';
  }
  if (price === null || Number.isNaN(price)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function getPriceTypeLabel(priceType: PriceType): string {
  switch (priceType) {
    case 'negotiable':
      return 'Negotiable';
    case 'free':
      return 'Free';
    case 'fixed':
    default:
      return 'Fixed';
  }
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: ListingStatus }) {
  const styles = (() => {
    switch (status) {
      case 'active':
        return 'bg-[#e3ead3] text-[#516241]';
      case 'sold':
        return 'bg-[#d6ccc2] text-[#5c4c3f]';
      case 'removed':
        return 'bg-[#f3ece4] text-[#8d7b6d]';
      case 'reserved':
        return 'bg-[#fcf6bd] text-[#826a2a]';
      default:
        return 'bg-[#f3ece4] text-[#8d7b6d]';
    }
  })();

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function ListingSkeleton() {
  return (
    <div className="bg-white/90 border border-[#f5ebe0]/60 rounded-2xl p-4 animate-pulse soft-shadow">
      <div className="flex gap-4">
        <div className="w-16 h-16 bg-[#efe6dc] rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 bg-[#efe6dc] rounded" />
          <div className="h-3 w-1/3 bg-[#efe6dc] rounded" />
          <div className="h-3 w-2/3 bg-[#efe6dc] rounded" />
        </div>
      </div>
    </div>
  );
}

export function MyListingsPage() {
  const { getMyListings } = useListings();
  const { getPendingCountsForListings } = useTransactions();
  const { getPendingReviews } = useReviews();
  const { error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [listings, setListings] = useState<ListingWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<ListingWithItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [pendingReviews, setPendingReviews] = useState<PendingReviewTransaction[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PendingReviewTransaction | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const statusFilter = useMemo<ListingStatus | undefined>(() => (
    activeTab === 'all' ? undefined : activeTab
  ), [activeTab]);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await getMyListings(statusFilter);
      setListings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load listings';
      setLoadError(message);
      showError('Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  }, [getMyListings, showError, statusFilter]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const fetchPendingCounts = useCallback(async (currentListings: ListingWithItem[]) => {
    if (currentListings.length === 0) {
      setPendingCounts({});
      return;
    }

    try {
      const counts = await getPendingCountsForListings(currentListings.map((listing) => listing.id));
      setPendingCounts(counts);
    } catch (err) {
      console.error('Failed to load pending request counts:', err);
    }
  }, [getPendingCountsForListings]);

  useEffect(() => {
    if (!isLoading) {
      fetchPendingCounts(listings);
    }
  }, [fetchPendingCounts, isLoading, listings]);

  const fetchPendingReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const data = await getPendingReviews();
      setPendingReviews(data);
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [getPendingReviews]);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  const handleRefresh = useCallback(async () => {
    await fetchListings();
  }, [fetchListings]);

  const {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold,
  } = usePullToRefresh({ onRefresh: handleRefresh });

  const handleListingClick = (listing: ListingWithItem) => {
    setSelectedListing(listing);
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedListing(null);
  };

  const handleListingUpdated = useCallback(() => {
    fetchListings();
    fetchPendingReviews();
  }, [fetchListings, fetchPendingReviews]);

  const handleOpenReview = (review: PendingReviewTransaction) => {
    setSelectedReview(review);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    fetchPendingReviews();
  };

  return (
    <div
      className="min-h-full bg-[#fdf8f2]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={threshold}
          isPulling={isPulling}
          isRefreshing={isRefreshing}
        />

        {/* Header */}
        <div className="glass border-b border-[#f5ebe0]/40 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black tracking-tight text-[#4a3f35]">My Listings</h1>
            <p className="text-sm text-[#8d7b6d] mt-1">Manage prices, status, and details</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/70 border-b border-[#f5ebe0]/50 backdrop-blur">
          <div className="flex gap-2 px-4 py-3 overflow-x-auto max-w-3xl mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#d6ccc2] text-[#4a3f35]'
                    : 'bg-[#f3ece4] text-[#8d7b6d] hover:bg-[#eadfd4]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          <div className="bg-white/90 border border-[#f5ebe0]/60 rounded-[1.75rem] p-4 soft-shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black uppercase tracking-[0.15em] text-[#4a3f35]">Pending Reviews</h2>
              {isLoadingReviews && <span className="text-xs text-[#8d7b6d]">Loading...</span>}
            </div>
            {pendingReviews.length === 0 ? (
              <p className="text-sm text-[#8d7b6d]">You're all caught up.</p>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-[#f5ebe0]/60 rounded-2xl p-4 flex items-start justify-between gap-3 bg-[#fdf8f2]/70"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#4a3f35]">
                        How was your experience with {review.other_user.display_name ?? 'this member'}?
                      </p>
                      <p className="text-xs text-[#8d7b6d] mt-1">
                        {review.listing.item_name ?? 'Transaction'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReview(review)}
                      className="px-3 py-2 text-xs font-semibold text-[#4a3f35] bg-[#e3ead3] border border-[#d7e1c2] rounded-xl hover:bg-[#d8e2c6] transition-colors"
                    >
                      Leave Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <>
              <ListingSkeleton />
              <ListingSkeleton />
              <ListingSkeleton />
            </>
          ) : listings.length === 0 ? (
            <div className="bg-white/90 border border-[#f5ebe0]/60 rounded-[1.75rem] p-8 text-center soft-shadow">
              <h2 className="text-lg font-black text-[#4a3f35]">No listings yet.</h2>
              <p className="text-sm text-[#8d7b6d] mt-1">List your first item!</p>
              <Link
                to="/inventory"
                className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-xl bg-[#d6ccc2] text-[#4a3f35] text-sm font-semibold hover:bg-[#c8b9ab]"
              >
                Go to inventory
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => handleListingClick(listing)}
                  className="w-full text-left bg-white/90 border border-[#f5ebe0]/60 rounded-2xl p-4 hover:bg-white transition-all soft-shadow"
                >
                  <div className="flex gap-4">
                    <img
                      src={listing.item.thumbnail_url || listing.item.photo_url}
                      alt={listing.item.name || 'Listing'}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#f3ece4]"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-[#4a3f35] font-black">
                            {listing.item.name || 'Untitled item'}
                          </p>
                          <p className="text-sm text-[#6f5f52] mt-1">
                            {formatPrice(listing.price, listing.price_type)}
                            <span className="text-[#b9a99b]"> · </span>
                            {getPriceTypeLabel(listing.price_type)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={listing.status} />
                          {(pendingCounts[listing.id] ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fcf6bd] text-[#826a2a]">
                              {pendingCounts[listing.id]} pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#8d7b6d] mt-2">
                        <div className="flex items-center gap-1">
                          <EyeIcon />
                          <span>{listing.view_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarIcon />
                          <span>{formatDate(listing.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loadError && (
            <div className="text-sm text-[#a04d2b] bg-[#f8e1d7] border border-[#f0d0be] rounded-xl px-3 py-2">{loadError}</div>
          )}
        </div>
      </div>

      <EditListingModal
        isOpen={showEditModal}
        onClose={handleCloseModal}
        listing={selectedListing}
        onSuccess={handleListingUpdated}
      />

      {selectedReview && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          transaction={{
            id: selectedReview.id,
            listing: { item_name: selectedReview.listing.item_name },
            other_user: {
              id: selectedReview.other_user.id,
              display_name: selectedReview.other_user.display_name,
            },
          }}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
