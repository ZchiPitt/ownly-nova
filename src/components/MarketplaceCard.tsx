/**
 * Marketplace listing card
 */

import type { MarketplaceListing } from '@/hooks/useMarketplace';
import { SaveButton } from '@/components/SaveButton';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  onClick: () => void;
  initialSaved?: boolean;
  onSaveToggle?: (saved: boolean) => void;
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};


function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'Free';

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(price);
}

export function MarketplaceCard({
  listing,
  onClick,
  initialSaved,
  onSaveToggle,
}: MarketplaceCardProps) {
  const imageUrl = listing.item.thumbnail_url || listing.item.photo_url;
  const displayName = listing.item.name || 'Untitled Item';
  const sellerName = listing.seller.display_name || 'Unknown seller';
  const locationCity = listing.seller.location_city;
  const isFree = listing.price_type === 'free' || listing.price === null;
  const conditionLabel = conditionLabels[listing.condition] || listing.condition;

  // Custom condition colors for warm theme
  const conditionDotColor: Record<string, string> = {
    new: '#d0f4de',
    like_new: '#e3ead3',
    good: '#f8e1d7',
    fair: '#fbc4ab',
    poor: '#eecfd4',
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="w-full text-left bg-white rounded-[2.5rem] overflow-hidden soft-shadow border border-[#f5ebe0]/40 transition-all active:scale-95 group cursor-pointer"
    >
      <div className="relative w-full aspect-square bg-[#fdf8f2] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#d6ccc2]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
          </div>
        )}

        {/* Favorite/Save Toggle */}
        <div className="absolute top-4 right-4">
          <SaveButton
            listingId={listing.id}
            initialSaved={initialSaved}
            size="sm"
            onToggle={onSaveToggle}
          />
        </div>

        {/* Status Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
          {isFree && (
            <span className="px-3 py-1 bg-[#e3ead3]/90 backdrop-blur-md rounded-full text-[8px] font-black text-[#4a3f35] uppercase tracking-widest border border-white/50">
              Free
            </span>
          )}
          <span className="px-3 py-1 bg-white/85 backdrop-blur-md rounded-full text-[8px] font-black text-[#4a3f35] uppercase tracking-widest border border-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conditionDotColor[listing.condition] || '#d6ccc2' }} />
            {conditionLabel}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <h3 className="font-black text-[#4a3f35] text-[13px] tracking-tight truncate leading-tight">
          {displayName}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <span className="px-3 py-1 bg-[#fdf8f2] border border-[#f5ebe0] rounded-full text-[11px] font-black text-[#4a3f35]">
            {isFree ? 'Free' : formatPrice(listing.price)}
          </span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-black text-[#8d7b6d] uppercase tracking-wider truncate">
              {sellerName}
            </span>
            {locationCity && <span className="text-[8px] text-[#d6ccc2] uppercase font-black tracking-widest">· {locationCity}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketplaceCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="w-full aspect-square bg-[#f5ebe0] animate-pulse" />
      <div className="p-3">
        <div className="h-4 bg-[#f5ebe0] rounded animate-pulse w-3/4 mb-2" />
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-[#f5ebe0] rounded animate-pulse w-16" />
          <div className="h-4 bg-[#f5ebe0] rounded-full animate-pulse w-14" />
        </div>
        <div className="h-3 bg-[#f5ebe0] rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}
