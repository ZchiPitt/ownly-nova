/**
 * Saved Listings Page - wishlist
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketplaceCard, MarketplaceCardSkeleton } from '@/components/MarketplaceCard';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSavedListings } from '@/hooks/useSavedListings';
import { useToast } from '@/hooks/useToast';
import type { MarketplaceListing } from '@/hooks/useMarketplace';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#f8e1d7] border border-white/60 soft-shadow flex items-center justify-center mb-4">
        <span className="text-2xl text-[#8d7b6d]">♡</span>
      </div>
      <h3 className="text-lg font-black text-[#4a3f35] mb-1">No saved items yet</h3>
      <p className="text-sm text-[#8d7b6d] mb-6">
        Start browsing the marketplace and tap the heart to save items.
      </p>
      <Link
        to="/marketplace"
        className="px-4 py-2 bg-[#d6ccc2] text-[#4a3f35] text-sm font-semibold rounded-xl hover:bg-[#c8b9ab] transition-colors"
      >
        Browse marketplace
      </Link>
    </div>
  );
}

export function SavedListingsPage() {
  const navigate = useNavigate();
  const { getSavedListings } = useSavedListings();
  const { error: showError } = useToast();

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSavedListings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await getSavedListings();
      setListings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load saved listings';
      setLoadError(message);
      showError('Failed to load saved listings');
    } finally {
      setIsLoading(false);
    }
  }, [getSavedListings, showError]);

  useEffect(() => {
    fetchSavedListings();
  }, [fetchSavedListings]);

  const handleRefresh = useCallback(async () => {
    await fetchSavedListings();
  }, [fetchSavedListings]);

  const {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold,
  } = usePullToRefresh({ onRefresh: handleRefresh });

  const handleSaveToggle = useCallback((listingId: string, saved: boolean) => {
    if (!saved) {
      setListings((prev) => prev.filter((listing) => listing.id !== listingId));
    }
  }, []);

  return (
    <div className="min-h-full bg-[#fdf8f2] pb-20">
      <div className="sticky top-0 z-10 glass border-b border-[#f5ebe0]/40 px-4 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <h1 className="text-2xl font-black tracking-tight text-[#4a3f35]">Saved Listings</h1>
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="text-xs font-black uppercase tracking-wider text-[#8d7b6d] hover:text-[#4a3f35]"
          >
            Marketplace
          </button>
        </div>
      </div>

      <div
        className="relative px-4 py-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={threshold}
          isPulling={isPulling}
          isRefreshing={isRefreshing}
        />

        {isLoading && listings.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {Array.from({ length: 6 }).map((_, index) => (
              <MarketplaceCardSkeleton key={index} />
            ))}
          </div>
        ) : loadError && listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/80 rounded-[2rem] border border-[#f5ebe0]/60 soft-shadow max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-[#f8e1d7] rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-[#a04d2b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-black text-[#4a3f35] mb-1">
              Couldn't load saved listings
            </h3>
            <p className="text-sm text-[#8d7b6d] text-center mb-4">{loadError}</p>
            <button
              type="button"
              onClick={() => handleRefresh()}
              className="px-4 py-2 bg-[#f3ece4] text-[#6f5f52] text-sm font-semibold rounded-xl hover:bg-[#eadfd4] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {listings.map((listing) => {
              const isUnavailable = listing.status !== 'active';
              return (
                <div key={listing.id} className="relative">
                  <MarketplaceCard
                    listing={listing}
                    onClick={() => navigate(`/marketplace/${listing.id}`)}
                    initialSaved
                    onSaveToggle={(saved) => handleSaveToggle(listing.id, saved)}
                  />
                  {isUnavailable && (
                    <div className="absolute inset-0 bg-[#fdf8f2]/85 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-[#f5ebe0]/60">
                      <span className="text-sm font-semibold text-[#8d7b6d]">No longer available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
