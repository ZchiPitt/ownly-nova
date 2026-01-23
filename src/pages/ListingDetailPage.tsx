/**
 * Listing Detail Page
 *
 * Displays full details of a marketplace listing.
 * Route: /marketplace/:listingId
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace, type MarketplaceListing } from '@/hooks/useMarketplace';
import { useToast } from '@/hooks/useToast';
import { PurchaseRequestModal } from '@/components/PurchaseRequestModal';
import { SaveButton } from '@/components/SaveButton';
import { StarRating } from '@/components/StarRating';
import type { ItemCondition, PriceType } from '@/types/database';

const conditionLabels: Record<ItemCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

const conditionStyles: Record<ItemCondition, string> = {
  new: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  like_new: 'bg-[#e3ead3] text-[#4a3f35] border-[#d7e1c2]',
  good: 'bg-[#fdf8f2] text-[#4a3f35] border-[#f5ebe0]',
  fair: 'bg-amber-50 text-amber-700 border-amber-200',
  poor: 'bg-[#f3ece4] text-[#8d7b6d] border-[#f5ebe0]/60',
};

function formatPrice(price: number | null, priceType: PriceType): string {
  if (priceType === 'free' || price === null) {
    return 'Free';
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

function formatMemberSince(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function BackIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M12 16V4m0 0l-4 4m4-4l4 4"
      />
    </svg>
  );
}

function PhotoViewer({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const lastTapRef = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((prev) => (prev > 1 ? 1 : 2));
    } else if (scale === 1) {
      onClose();
    }
    lastTapRef.current = now;
  }, [lastTapRef, onClose, scale]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" role="dialog" aria-label="Full screen photo viewer">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close photo viewer"
        >
          <span className="text-lg">✕</span>
        </button>
        <div className="w-10" />
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={handleTap}>
        <img
          src={imageUrl}
          alt="Listing full view"
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>
      <div className="text-center text-white/60 text-sm py-4 bg-black/80">
        {scale === 1 ? 'Tap to close • Double-tap to zoom in' : 'Double-tap to reset'}
      </div>
    </div>
  );
}

function ListingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#fdf8f2] pb-safe-area-pb">
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse" />
          <div className="w-32 h-6 rounded bg-[#efe6dc] animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse" />
        </div>
      </div>
      <div className="w-full h-[300px] bg-[#efe6dc] animate-pulse" />
      <div className="p-4 space-y-4">
        <div className="h-8 w-3/4 bg-[#efe6dc] rounded animate-pulse" />
        <div className="h-6 w-1/2 bg-[#efe6dc] rounded animate-pulse" />
        <div className="h-20 bg-[#efe6dc] rounded animate-pulse" />
      </div>
    </div>
  );
}

function ListingDetailError({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry?: () => void }) {
  return (
    <div className="min-h-screen bg-[#fdf8f2] flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-[#4a3f35]">Listing Details</h1>
          <div className="w-10" />
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">!</span>
        </div>
        <p className="text-[#8d7b6d] text-center mb-6">{message}</p>
        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-[#8d7b6d] text-white font-medium rounded-lg hover:bg-[#7c6b5d] transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onBack}
            className="px-6 py-2 border border-[#f5ebe0] text-[#6f5f52] font-medium rounded-lg hover:bg-[#fdf8f2] transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getListingById } = useMarketplace();
  const { success, error: showError } = useToast();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  const fetchListing = useCallback(async () => {
    if (!listingId) {
      setError('Listing not found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getListingById(listingId);
      if (!data) {
        setError('Listing not found.');
      } else {
        setListing(data);
      }
    } catch (err) {
      console.error('Failed to load listing:', err);
      setError('Unable to load listing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [getListingById, listingId]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  // Memoize the primary action label - must be before early returns to respect hooks rules
  const primaryActionLabel = useMemo(() => {
    if (!listing) return 'Request Item';
    return listing.price_type === 'free' || listing.price === null ? 'Request Item' : 'Buy Now';
  }, [listing]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        success('Link copied to clipboard.');
        return;
      }
      const fallback = document.createElement('textarea');
      fallback.value = url;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.focus();
      fallback.select();
      document.execCommand('copy');
      document.body.removeChild(fallback);
      success('Link copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showError('Unable to copy link.');
    }
  }, [success, showError]);

  const handleMessageSeller = useCallback(() => {
    if (!user) {
      showError('Please sign in to message the seller.');
      return;
    }
    if (!listingId) {
      showError('Listing not found.');
      return;
    }
    navigate(`/messages/${listingId}`);
  }, [listingId, navigate, showError, user]);

  const handlePrimaryAction = useCallback(() => {
    if (!user) {
      showError('Please sign in to send a purchase request.');
      return;
    }
    setIsRequestOpen(true);
  }, [showError, user]);

  if (isLoading) {
    return <ListingDetailSkeleton />;
  }

  if (error || !listing) {
    return (
      <ListingDetailError
        message={error ?? 'Listing not found.'}
        onBack={() => navigate(-1)}
        onRetry={fetchListing}
      />
    );
  }

  const imageUrl = listing.item.photo_url || listing.item.thumbnail_url || '';
  const displayName = listing.item.name || 'Untitled listing';
  const priceLabel = formatPrice(listing.price, listing.price_type);
  const priceTypeLabel = getPriceTypeLabel(listing.price_type);
  const conditionLabel = conditionLabels[listing.condition];
  const conditionStyle = conditionStyles[listing.condition];
  const isOwner = listing.seller.user_id === user?.id;
  const isUnavailable = listing.status !== 'active';
  const rating = listing.seller.seller_rating ?? 0;
  const reviewCount = listing.seller.review_count ?? 0;
  const ratingLabel = reviewCount > 0 ? rating.toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-[#fdf8f2] pb-safe-area-pb">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-[#4a3f35]">Listing Details</h1>
          <div className="flex items-center gap-2 -mr-2">
            <SaveButton listingId={listing.id} size="md" />
            <button
              onClick={handleShare}
              className="p-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
              aria-label="Share listing"
            >
              <ShareIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Hero image */}
      <div className="relative w-full max-h-[300px] bg-[#f3ece4] overflow-hidden">
        {imageUrl ? (
          <button type="button" className="w-full" onClick={() => setIsPhotoOpen(true)}>
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full h-[300px] object-cover"
            />
          </button>
        ) : (
          <div className="w-full h-[300px] flex items-center justify-center text-[#b9a99b]">
            No photo available
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {isUnavailable && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            This item is no longer available.
          </div>
        )}

        {isOwner && (
          <div className="bg-[#e3ead3] border border-[#d7e1c2] text-[#4a3f35] px-4 py-3 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">This is your listing</p>
              <p className="text-xs text-[#4a3f35]">Manage pricing or status changes.</p>
            </div>
            <button
              onClick={() => navigate('/marketplace/my-listings')}
              className="px-3 py-2 text-sm font-semibold text-[#4a3f35] bg-white border border-[#d7e1c2] rounded-lg hover:bg-teal-100 transition-colors"
            >
              Edit
            </button>
          </div>
        )}

        {/* Info section */}
        <div>
          <h2 className="text-2xl font-semibold text-[#4a3f35]">{displayName}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-[#8d7b6d]">
            <span className="text-lg font-semibold text-[#6f5f52]">{priceLabel}</span>
            {priceTypeLabel !== 'Free' && <span>· {priceTypeLabel}</span>}
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${conditionStyle}`}>
              {conditionLabel}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold text-[#4a3f35] mb-2">Description</h3>
          <p className="text-sm text-[#8d7b6d] whitespace-pre-line">
            {listing.description?.trim() || 'No description provided.'}
          </p>
        </div>

        {/* Seller section */}
        <div>
          <h3 className="text-sm font-semibold text-[#4a3f35] mb-3">Seller</h3>
          <button
            onClick={() => navigate(`/marketplace/seller/${listing.seller.id}`)}
            className="w-full text-left bg-white border border-[#f5ebe0]/60 rounded-2xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              {listing.seller.avatar_url ? (
                <img
                  src={listing.seller.avatar_url}
                  alt={listing.seller.display_name || 'Seller avatar'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#efe6dc] flex items-center justify-center text-[#8d7b6d] font-semibold">
                  {(listing.seller.display_name || 'S').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#4a3f35]">
                    {listing.seller.display_name || 'Seller'}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-[#8d7b6d]">
                    <StarRating rating={rating} size="sm" />
                    <span>{ratingLabel}</span>
                    <span>({reviewCount} review{reviewCount === 1 ? '' : 's'})</span>
                  </div>
                </div>
                <div className="text-xs text-[#8d7b6d] mt-1">
                  {listing.seller.location_city && (
                    <span>📍 {listing.seller.location_city}</span>
                  )}
                  {listing.seller.location_city && <span className="mx-1">·</span>}
                  <span>Member since {formatMemberSince(listing.seller.created_at)}</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Sticky actions */}
      {!isUnavailable && !isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#f5ebe0]/60 px-4 py-3 pb-safe z-20">
          <div className="flex gap-3">
            <button
              onClick={handleMessageSeller}
              className="flex-1 px-4 py-3 border border-teal-600 text-[#6f5f52] font-semibold rounded-xl hover:bg-[#e3ead3] transition-colors"
            >
              Message Seller
            </button>
            <button
              onClick={handlePrimaryAction}
              className="flex-1 px-4 py-3 bg-[#8d7b6d] text-white font-semibold rounded-xl hover:bg-[#7c6b5d] transition-colors"
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>
      )}

      {isPhotoOpen && imageUrl && (
        <PhotoViewer imageUrl={imageUrl} onClose={() => setIsPhotoOpen(false)} />
      )}

      {listing && (
        <PurchaseRequestModal
          isOpen={isRequestOpen}
          onClose={() => setIsRequestOpen(false)}
          listing={{
            id: listing.id,
            price: listing.price,
            price_type: listing.price_type,
            item: {
              name: displayName,
              photo_url: imageUrl,
            },
            seller_id: listing.seller.id,
          }}
          onSuccess={() => {
            success('Purchase request sent.');
          }}
        />
      )}
    </div>
  );
}
