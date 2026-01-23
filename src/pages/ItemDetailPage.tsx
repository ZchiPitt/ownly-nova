/**
 * Item Detail Page
 *
 * Displays detailed view of a single inventory item.
 * Route: /item/:id
 *
 * Features (US-052):
 * - Header with back arrow, 'Item Details' title, overflow menu
 * - Full-width hero image (max 300px height)
 * - Tap photo opens full-screen viewer with pinch-to-zoom
 * - Updates last_viewed_at on page load (fire-and-forget)
 *
 * Features (US-053):
 * - Expiration banner below photo with color-coded status
 * - Primary info section with name, category badge, location, tags
 * - Category and location are tappable for filtering
 *
 * Features (US-054):
 * - Collapsible details section (default expanded)
 * - Only shows fields with values
 * - Fields: Description, Quantity (if >1), Brand, Model, Price, Purchase Date, Expiration Date, Notes
 * - Date formatting: 'Jan 15, 2024'
 * - Smooth collapse animation (200ms)
 *
 * Features (US-055):
 * - Metadata section with gray background, smaller text
 * - Show: 'Added {date} at {time}', 'Modified {date}' (if different), 'Last viewed {relative}'
 * - Sticky bottom action bar with Edit Item and Delete buttons
 * - Edit button (primary) -> /item/{id}/edit
 * - Delete button (red outline) -> triggers delete confirmation
 *
 * Features (US-056):
 * - Overflow menu (three dots) with Share, Favorites, and Keep Forever options
 * - Share: uses Web Share API, fallback to copy URL
 * - Add to Favorites / Remove from Favorites: toggle is_favorite, heart icon changes
 * - Mark as Keep Forever / Unmark: toggle keep_forever, toast explains effect
 *
 * Features (US-058):
 * - Delete confirmation dialog with thumbnail, item name, and warning
 * - Soft delete: sets deleted_at timestamp (not hard delete)
 * - Undo toast with 5-second countdown timer
 * - Undo: clears deleted_at, navigates back to item, shows 'Item restored' toast
 * - Auto-dismiss toast after 5 seconds
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { TagChip } from '@/components/TagChip';
import { ListingFormModal } from '@/components/ListingFormModal';
import { BoundingBoxImage } from '@/components/BoundingBoxImage';
import { useAuth } from '@/hooks/useAuth';
import { useListings } from '@/hooks/useListings';
import { getColorHex } from '@/lib/colorUtils';
import type { Item, Category, Location } from '@/types';
import type { Listing } from '@/types/database';
import type { ItemAIMetadata } from '@/types/database';

/**
 * Full item data with category and location info
 */
interface ItemDetails extends Omit<Item, 'category_id' | 'location_id'> {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  location: Pick<Location, 'id' | 'name' | 'path' | 'icon'> | null;
}

/**
 * Raw item type from Supabase query (with nested objects using table names)
 */
interface RawItemDetails {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  tags: string[];
  location_id: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  purchase_date: string | null;
  expiration_date: string | null;
  warranty_expiry_date: string | null;
  reminder_date: string | null;
  reminder_note: string | null;
  reminder_sent: boolean;
  brand: string | null;
  model: string | null;
  notes: string | null;
  is_favorite: boolean;
  keep_forever: boolean;
  ai_metadata: unknown | null;
  source_batch_id: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Nested objects use table name (plural) from Supabase
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  locations: {
    id: string;
    name: string;
    path: string;
    icon: string;
  } | null;
}

type RawItemBase = Omit<RawItemDetails, 'categories' | 'locations'>;

/**
 * Transform raw Supabase data to ItemDetails format
 */
function transformRawItem(raw: RawItemDetails): ItemDetails {
  return {
    id: raw.id,
    user_id: raw.user_id,
    photo_url: raw.photo_url,
    thumbnail_url: raw.thumbnail_url,
    name: raw.name,
    description: raw.description,
    tags: raw.tags || [],
    quantity: raw.quantity,
    price: raw.price,
    currency: raw.currency,
    purchase_date: raw.purchase_date,
    expiration_date: raw.expiration_date,
    warranty_expiry_date: raw.warranty_expiry_date,
    reminder_date: raw.reminder_date,
    reminder_note: raw.reminder_note,
    reminder_sent: raw.reminder_sent,
    brand: raw.brand,
    model: raw.model,
    notes: raw.notes,
    is_favorite: raw.is_favorite,
    keep_forever: raw.keep_forever,
    ai_metadata: raw.ai_metadata as ItemDetails['ai_metadata'],
    source_batch_id: raw.source_batch_id,
    last_viewed_at: raw.last_viewed_at,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: raw.deleted_at,
    category: raw.categories ? {
      id: raw.categories.id,
      name: raw.categories.name,
      icon: raw.categories.icon,
      color: raw.categories.color,
    } : null,
    location: raw.locations ? {
      id: raw.locations.id,
      name: raw.locations.name,
      path: raw.locations.path,
      icon: raw.locations.icon,
    } : null,
  };
}

/**
 * Back arrow icon
 */
function BackIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Overflow menu icon (three dots)
 */
function OverflowIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/**
 * Close icon for the photo viewer
 */
function CloseIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * Warning icon for expiration banner
 */
function WarningIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

/**
 * Chevron right icon for location path
 */
function ChevronRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Chevron down icon for collapsible sections
 */
function ChevronDownIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Edit/Pencil icon for edit button
 */
function EditIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

/**
 * Trash icon for delete button
 */
function TrashIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

/**
 * Clock icon for metadata section
 */
function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/**
 * Share icon for overflow menu (US-056)
 */
function ShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

/**
 * Heart icon for favorites (US-056)
 * Supports outline (not favorited) and filled (favorited) variants
 */
function HeartIcon({ className = 'w-5 h-5', filled = false }: { className?: string; filled?: boolean }) {
  if (filled) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

/**
 * Infinity icon for Keep Forever (US-056)
 */
function InfinityIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.5 6.5c2-2 5.5-2 7.5 0s2 5.5 0 7.5c-2 2-5.5 2-7.5 0m-1 0c-2 2-5.5 2-7.5 0s-2-5.5 0-7.5c2-2 5.5-2 7.5 0" transform="translate(0, 2)" />
    </svg>
  );
}

/**
 * Checkmark icon for success toast (US-056)
 */
function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Calculate expiration status
 */
function getExpirationStatus(expirationDate: string): {
  type: 'expired' | 'warning' | 'caution' | 'ok';
  text: string;
  daysAway: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      type: 'expired',
      text: daysAgo === 1 ? 'Expired 1 day ago' : `Expired ${daysAgo} days ago`,
      daysAway: diffDays,
    };
  } else if (diffDays === 0) {
    return {
      type: 'expired',
      text: 'Expires today',
      daysAway: 0,
    };
  } else if (diffDays <= 7) {
    return {
      type: 'warning',
      text: diffDays === 1 ? 'Expires in 1 day' : `Expires in ${diffDays} days`,
      daysAway: diffDays,
    };
  } else if (diffDays <= 30) {
    return {
      type: 'caution',
      text: `Expires in ${diffDays} days`,
      daysAway: diffDays,
    };
  }

  return {
    type: 'ok',
    text: `Expires in ${diffDays} days`,
    daysAway: diffDays,
  };
}

/**
 * Format a date string as 'Jan 15, 2024'
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format price with currency symbol
 */
function formatPrice(price: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  const symbol = currencySymbols[currency] || currency + ' ';
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Format a date string as 'Jan 15, 2024 at 2:30 PM'
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const dateFormatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatted = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateFormatted} at ${timeFormatted}`;
}

/**
 * Format relative time (e.g., 'Just now', '2 hours ago', 'Yesterday')
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}

/**
 * Check if two dates are on different days
 */
function areDifferentDays(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

/**
 * Expiration banner component
 */
function ExpirationBanner({ expirationDate }: { expirationDate: string }) {
  const status = getExpirationStatus(expirationDate);

  // Only show banner for expired, warning (<=7 days), or caution (8-30 days)
  if (status.type === 'ok') {
    return null;
  }

  const bannerStyles = {
    expired: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-red-50 border-red-200 text-red-700',
    caution: 'bg-orange-50 border-orange-200 text-orange-700',
    ok: '',
  };

  const iconStyles = {
    expired: 'text-red-500',
    warning: 'text-red-500',
    caution: 'text-orange-500',
    ok: '',
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-b ${bannerStyles[status.type]}`}>
      <WarningIcon className={`flex-shrink-0 ${iconStyles[status.type]}`} />
      <span className="font-medium">{status.text}</span>
    </div>
  );
}

/**
 * Detail row component for individual fields
 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 border-b border-[#f5ebe0]/50 last:border-b-0">
      <dt className="text-sm text-[#8d7b6d] mb-1">{label}</dt>
      <dd className="text-[#4a3f35] whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

/**
 * Collapsible details section component (US-054)
 */
function DetailsSection({
  item,
}: {
  item: ItemDetails;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Collect fields that have values
  const details: { label: string; value: string }[] = [];

  if (item.description) {
    details.push({ label: 'Description', value: item.description });
  }

  if (item.quantity && item.quantity > 1) {
    details.push({ label: 'Quantity', value: item.quantity.toString() });
  }

  if (item.brand) {
    details.push({ label: 'Brand', value: item.brand });
  }

  if (item.model) {
    details.push({ label: 'Model', value: item.model });
  }

  if (item.price !== null && item.price !== undefined) {
    details.push({ label: 'Price', value: formatPrice(Number(item.price), item.currency || 'CNY') });
  }

  if (item.purchase_date) {
    details.push({ label: 'Purchase Date', value: formatDate(item.purchase_date) });
  }

  if (item.expiration_date) {
    details.push({ label: 'Expiration Date', value: formatDate(item.expiration_date) });
  }

  if (item.notes) {
    details.push({ label: 'Notes', value: item.notes });
  }

  // Don't render section if no details to show
  if (details.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-t border-[#f5ebe0]/60">
      {/* Header with expand/collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#fdf8f2] transition-colors"
        aria-expanded={isExpanded}
        aria-controls="details-content"
      >
        <h3 className="text-base font-semibold text-[#4a3f35]">Details</h3>
        <ChevronDownIcon
          className={`w-5 h-5 text-[#8d7b6d] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
            }`}
        />
      </button>

      {/* Collapsible content with smooth animation */}
      <div
        id="details-content"
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${details.length * 100}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <dl className="px-4 pb-4">
          {details.map((detail, index) => (
            <DetailRow key={index} label={detail.label} value={detail.value} />
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * Metadata section component (US-055)
 * Shows timestamps: Added date/time, Modified date (if different), Last viewed (relative)
 */
function MetadataSection({
  createdAt,
  updatedAt,
  lastViewedAt,
}: {
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
}) {
  const showModified = areDifferentDays(createdAt, updatedAt);

  return (
    <div className="bg-[#f3ece4] px-4 py-3 mt-4">
      <div className="flex items-start gap-2 text-sm text-[#8d7b6d]">
        <ClockIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          {/* Added date/time */}
          <p>Added {formatDateTime(createdAt)}</p>

          {/* Modified date (only if different from created) */}
          {showModified && (
            <p>Modified {formatDate(updatedAt)}</p>
          )}

          {/* Last viewed (relative time) */}
          {lastViewedAt && (
            <p>Last viewed {formatRelativeTime(lastViewedAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-screen photo viewer with pinch-to-zoom
 */
function PhotoViewer({
  imageUrl,
  bbox,
  onClose,
}: {
  imageUrl: string;
  bbox?: [number, number, number, number] | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [overlayRect, setOverlayRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  const hasBbox = bbox && !(bbox[0] === 0 && bbox[1] === 0 && bbox[2] >= 95 && bbox[3] >= 95);

  const calculateOverlay = useCallback(() => {
    if (!hasBbox || !bbox || !imgRef.current || !containerRef.current) {
      setOverlayRect(null);
      return;
    }

    const container = containerRef.current;
    const img = imgRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      setOverlayRect(null);
      return;
    }

    // Calculate rendered image dimensions within object-contain
    const imgScale = Math.min(
      containerWidth / naturalWidth,
      containerHeight / naturalHeight
    );
    const renderedWidth = naturalWidth * imgScale;
    const renderedHeight = naturalHeight * imgScale;
    const offsetX = (containerWidth - renderedWidth) / 2;
    const offsetY = (containerHeight - renderedHeight) / 2;

    setOverlayRect({
      left: offsetX + (bbox[0] / 100) * renderedWidth,
      top: offsetY + (bbox[1] / 100) * renderedHeight,
      width: (bbox[2] / 100) * renderedWidth,
      height: (bbox[3] / 100) * renderedHeight,
    });
  }, [hasBbox, bbox]);

  const handleImageLoad = useCallback(() => {
    calculateOverlay();
  }, [calculateOverlay]);

  // Recalculate overlay on container resize
  useEffect(() => {
    if (!hasBbox || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      calculateOverlay();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasBbox, calculateOverlay]);

  // Handle pinch to zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistanceRef.current = distance;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistanceRef.current;
      setScale((prev) => Math.max(1, Math.min(5, prev * delta)));
      lastTouchDistanceRef.current = distance;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = null;
  }, []);

  // Handle double-tap to toggle zoom
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      // Double tap - toggle between 1x and 2x
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2);
      }
    } else if (scale === 1) {
      // Single tap when not zoomed - close
      if ((e.target as HTMLElement).tagName !== 'BUTTON') {
        onClose();
      }
    }

    lastTapRef.current = now;
  }, [scale, onClose]);

  // Handle panning when zoomed
  const handleDrag = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      // Simple panning logic
      const touch = e.touches[0];
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width - 0.5) * (scale - 1) * -100;
        const y = ((touch.clientY - rect.top) / rect.height - 0.5) * (scale - 1) * -100;
        setPosition({ x, y });
      }
    }
  }, [scale]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      role="dialog"
      aria-label="Full screen photo viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close photo viewer"
        >
          <CloseIcon />
        </button>
        {scale > 1 && (
          <span className="text-white/80 text-sm">
            {Math.round(scale * 100)}%
          </span>
        )}
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          handleTouchMove(e);
          handleDrag(e);
        }}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        <div
          className="relative w-full h-full transition-transform duration-100"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}%, ${position.y / scale}%)`,
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Item photo full view"
            className="w-full h-full object-contain"
            onLoad={handleImageLoad}
            draggable={false}
          />
          {overlayRect && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${overlayRect.left}px`,
                top: `${overlayRect.top}px`,
                width: `${overlayRect.width}px`,
                height: `${overlayRect.height}px`,
                border: '2px dashed #ef4444',
                borderRadius: '4px',
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Helper text */}
      <div className="text-center text-white/60 text-sm py-4 bg-black/80">
        {scale === 1 ? 'Pinch to zoom • Double-tap to zoom in • Tap to close' : 'Double-tap to reset'}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the item detail page
 */
function ItemDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#fdf8f2] pb-safe-area-pb">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse" />
          <div className="w-24 h-6 rounded bg-[#efe6dc] animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse" />
        </div>
      </div>

      {/* Hero image skeleton */}
      <div className="w-full h-[300px] bg-[#efe6dc] animate-pulse" />

      {/* Content skeleton */}
      <div className="p-4 space-y-4">
        <div className="h-8 w-3/4 bg-[#efe6dc] rounded animate-pulse" />
        <div className="h-6 w-1/2 bg-[#efe6dc] rounded animate-pulse" />
        <div className="h-20 bg-[#efe6dc] rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ItemDetailError({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#fdf8f2] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-[#4a3f35]">Item Details</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Error content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[#8d7b6d] text-center mb-6">{message}</p>
        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-[#4a3f35] text-white font-medium rounded-2xl hover:bg-[#3d332b] transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onBack}
            className="px-6 py-2 border border-[#f5ebe0] text-[#6f5f52] font-medium rounded-2xl hover:bg-[#fdf8f2] transition-colors"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Item Detail Page Component
 */
export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getListingByItemId } = useListings();
  const normalizedItemId = useMemo(() => {
    if (!id) return '';
    try {
      return decodeURIComponent(id).trim();
    } catch {
      return id.trim();
    }
  }, [id]);

  const [item, setItem] = useState<ItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [existingListing, setExistingListing] = useState<Listing | null>(null);
  const [isListingLoading, setIsListingLoading] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [relatedItems, setRelatedItems] = useState<Array<{ id: string; name: string | null }>>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Toast state for overflow menu actions (US-056)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state (US-058)
  const [isDeleting, setIsDeleting] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    itemId: string;
    itemName: string;
    countdown: number;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch item details
  const fetchItem = useCallback(async () => {
    if (!normalizedItemId) {
      setError('Item ID is missing');
      setIsLoading(false);
      return;
    }
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('items')
        .select(`
          id,
          user_id,
          photo_url,
          thumbnail_url,
          name,
          description,
          category_id,
          tags,
          location_id,
          quantity,
          price,
          currency,
          purchase_date,
          expiration_date,
          warranty_expiry_date,
          reminder_date,
          reminder_note,
          reminder_sent,
          brand,
          model,
          notes,
          is_favorite,
          keep_forever,
          ai_metadata,
          source_batch_id,
          last_viewed_at,
          created_at,
          updated_at,
          deleted_at
        `)
        .eq('id', normalizedItemId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .returns<RawItemBase[]>()
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.code === '22P02') {
          // No rows returned - item doesn't exist or is deleted
          setError('This item no longer exists');
        } else {
          throw fetchError;
        }
        return;
      }

      setItem(transformRawItem({
        ...data,
        categories: null,
        locations: null,
      }));
    } catch (err) {
      console.error('Error fetching item:', err);
      setError("Couldn't load item details");
    } finally {
      setIsLoading(false);
    }
  }, [normalizedItemId, user?.id]);

  // Update last_viewed_at on page load (fire-and-forget)
  useEffect(() => {
    if (!normalizedItemId || !user?.id) return;

    // Fire and forget - don't await
    // Cast is needed to work around Supabase TypeScript inference limitations
    (supabase
      .from('items') as ReturnType<typeof supabase.from>)
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('id', normalizedItemId)
      .eq('user_id', user.id)
      .then(({ error }: { error: Error | null }) => {
        if (error) {
          console.error('Error updating last_viewed_at:', error);
        }
      });
  }, [normalizedItemId, user?.id]);

  // Fetch item on mount
  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const fetchListing = useCallback(async () => {
    if (!normalizedItemId || !user?.id) {
      setExistingListing(null);
      return;
    }
    setIsListingLoading(true);
    const listing = await getListingByItemId(normalizedItemId);
    setExistingListing(listing);
    setIsListingLoading(false);
  }, [getListingByItemId, normalizedItemId, user?.id]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  useEffect(() => {
    const sourceBatchId = item?.source_batch_id;
    if (!sourceBatchId || !user?.id) {
      setRelatedItems([]);
      return;
    }

    let isActive = true;
    const fetchRelatedItems = async () => {
      setIsLoadingRelated(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, name')
          .eq('source_batch_id', sourceBatchId)
          .eq('user_id', user.id)
          .neq('id', item.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (!isActive) return;

        if (error) {
          console.error('Error fetching related items:', error);
          setRelatedItems([]);
          return;
        }

        setRelatedItems((data as Array<{ id: string; name: string | null }>) || []);
      } finally {
        if (isActive) setIsLoadingRelated(false);
      }
    };

    fetchRelatedItems();

    return () => {
      isActive = false;
    };
  }, [item?.id, item?.source_batch_id, user?.id]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setIsOverflowMenuOpen(false);
      }
    };

    if (isOverflowMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOverflowMenuOpen]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/inventory');
    }
  }, [navigate]);

  // Handle edit navigation (US-055)
  const handleEdit = useCallback(() => {
    if (normalizedItemId) {
      navigate(`/item/${normalizedItemId}/edit`);
    }
  }, [navigate, normalizedItemId]);

  // Handle delete confirmation (US-055)
  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  /**
   * Clean up undo timers (US-058)
   */
  const clearUndoTimers = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  /**
   * Start undo countdown timer (US-058)
   */
  const startUndoCountdown = useCallback((itemId: string, itemName: string) => {
    // Clear any existing timers
    clearUndoTimers();

    // Initialize countdown at 5 seconds
    setUndoToast({ itemId, itemName, countdown: 5 });

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      setUndoToast((prev) => {
        if (!prev) return null;
        const newCountdown = prev.countdown - 1;
        if (newCountdown <= 0) {
          clearUndoTimers();
          return null;
        }
        return { ...prev, countdown: newCountdown };
      });
    }, 1000);

    // Auto-dismiss after 5 seconds (backup)
    undoTimeoutRef.current = setTimeout(() => {
      clearUndoTimers();
      setUndoToast(null);
    }, 5000);
  }, [clearUndoTimers]);

  /**
   * Execute soft delete (US-058)
   * Sets deleted_at timestamp and navigates back with undo option
   * Uses SECURITY DEFINER function to bypass RLS issues with location count trigger
   */
  const handleConfirmDelete = useCallback(async () => {
    console.log('[DELETE] handleConfirmDelete called - using RPC');
    if (!normalizedItemId || !item || !user?.id || isDeleting) return;

    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      // Use RPC to call SECURITY DEFINER function
      // This bypasses RLS issues caused by the update_location_item_count_trigger
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('soft_delete_item', { item_id: normalizedItemId });

      if (error) {
        console.error('[DELETE] RPC error:', error);
        throw error;
      }

      console.log('[DELETE] Successfully deleted item');

      // Navigate back first
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/inventory');
      }

      // Start the undo countdown after navigation
      startUndoCountdown(normalizedItemId, item.name || 'Unnamed Item');
    } catch (err) {
      console.error('Error deleting item:', err);
      setToast({ message: 'Failed to delete item', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }, [normalizedItemId, item, user?.id, isDeleting, navigate, startUndoCountdown]);

  /**
   * Undo delete (US-058)
   * Clears deleted_at and navigates back to the item
   * Uses SECURITY DEFINER function to bypass RLS issues with location count trigger
   */
  const handleUndo = useCallback(async () => {
    if (!undoToast || !user?.id) return;

    const { itemId } = undoToast;

    // Clear the undo timers immediately
    clearUndoTimers();
    setUndoToast(null);

    try {
      // Use RPC to call SECURITY DEFINER function
      // This bypasses RLS issues caused by the update_location_item_count_trigger
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: restoreError } = await (supabase as any).rpc('restore_item', { item_id: itemId });

      if (restoreError) {
        throw restoreError;
      }

      // Navigate to the restored item
      navigate(`/item/${itemId}`);

      // Show success toast
      setToast({ message: 'Item restored', type: 'success' });
    } catch (err) {
      console.error('Error restoring item:', err);
      setToast({ message: 'Failed to restore item', type: 'error' });
    }
  }, [undoToast, user?.id, navigate, clearUndoTimers]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearUndoTimers();
    };
  }, [clearUndoTimers]);

  /**
   * Handle Share action (US-056)
   * Uses Web Share API if available, otherwise falls back to clipboard copy
   */
  const handleShare = useCallback(async () => {
    setIsOverflowMenuOpen(false);

    const shareUrl = window.location.href;
    const shareTitle = item?.name || 'Item';
    const shareText = `Check out my item: ${shareTitle}`;

    /**
     * Copy URL to clipboard helper
     */
    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setToast({ message: 'Link copied to clipboard', type: 'success' });
      } catch (err) {
        console.error('Clipboard copy failed:', err);
        setToast({ message: 'Failed to copy link', type: 'error' });
      }
    };

    // Try Web Share API first (supported on mobile and some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setToast({ message: 'Shared successfully', type: 'success' });
      } catch (err) {
        // User cancelled or share failed
        // AbortError means user cancelled, don't show error for that
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Share failed:', err);
          // Fallback to clipboard
          await copyToClipboard(shareUrl);
        }
      }
    } else {
      // Fallback to clipboard copy
      await copyToClipboard(shareUrl);
    }
  }, [item?.name]);

  /**
   * Handle Favorites toggle (US-056)
   * Toggles is_favorite and shows heart icon state change
   */
  const handleToggleFavorite = useCallback(async () => {
    if (!normalizedItemId || !item || !user?.id || isUpdating) return;

    setIsOverflowMenuOpen(false);
    setIsUpdating(true);

    const newFavoriteStatus = !item.is_favorite;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('items') as any)
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', normalizedItemId)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setItem(prev => prev ? { ...prev, is_favorite: newFavoriteStatus } : null);

      setToast({
        message: newFavoriteStatus ? 'Added to favorites' : 'Removed from favorites',
        type: 'success',
      });
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setToast({ message: 'Failed to update favorite status', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  }, [normalizedItemId, item, user?.id, isUpdating]);

  /**
   * Handle Keep Forever toggle (US-056)
   * Toggles keep_forever and shows toast explaining the effect
   */
  const handleToggleKeepForever = useCallback(async () => {
    if (!normalizedItemId || !item || !user?.id || isUpdating) return;

    setIsOverflowMenuOpen(false);
    setIsUpdating(true);

    const newKeepForeverStatus = !item.keep_forever;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('items') as any)
        .update({ keep_forever: newKeepForeverStatus })
        .eq('id', normalizedItemId)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setItem(prev => prev ? { ...prev, keep_forever: newKeepForeverStatus } : null);

      // Show toast with explanation of the effect
      setToast({
        message: newKeepForeverStatus
          ? 'Marked as Keep Forever - won\'t receive unused item reminders'
          : 'Unmarked - will receive unused item reminders',
        type: 'info',
      });
    } catch (err) {
      console.error('Error toggling keep forever:', err);
      setToast({ message: 'Failed to update item', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  }, [normalizedItemId, item, user?.id, isUpdating]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Loading state
  if (isLoading) {
    return <ItemDetailSkeleton />;
  }

  // Error state
  if (error || !item) {
    return (
      <ItemDetailError
        message={error || 'Item not found'}
        onRetry={error === "Couldn't load item details" ? fetchItem : undefined}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf8f2] pb-safe-area-pb">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>

          {/* Title */}
          <h1 className="text-lg font-semibold text-[#4a3f35]">Item Details</h1>

          {/* Overflow menu */}
          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setIsOverflowMenuOpen(!isOverflowMenuOpen)}
              className="p-2 -mr-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
              aria-label="More options"
              aria-expanded={isOverflowMenuOpen}
            >
              <OverflowIcon />
            </button>

            {/* Dropdown menu (US-056) */}
            {isOverflowMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[#f5ebe0]/60 py-1 z-20">
                {/* Share option */}
                <button
                  className="w-full px-4 py-2.5 text-left text-[#6f5f52] hover:bg-[#f3ece4] flex items-center gap-3"
                  onClick={handleShare}
                >
                  <ShareIcon className="w-5 h-5 text-[#8d7b6d]" />
                  <span>Share</span>
                </button>

                {/* Favorites toggle */}
                <button
                  className={`w-full px-4 py-2.5 text-left hover:bg-[#f3ece4] flex items-center gap-3 ${item.is_favorite ? 'text-red-500' : 'text-[#6f5f52]'
                    }`}
                  onClick={handleToggleFavorite}
                  disabled={isUpdating}
                >
                  <HeartIcon
                    className={`w-5 h-5 ${item.is_favorite ? 'text-red-500' : 'text-[#8d7b6d]'}`}
                    filled={item.is_favorite}
                  />
                  <span>{item.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                </button>

                {/* Keep Forever toggle */}
                <button
                  className={`w-full px-4 py-2.5 text-left hover:bg-[#f3ece4] flex items-center gap-3 ${item.keep_forever ? 'text-[#4a3f35]' : 'text-[#6f5f52]'
                    }`}
                  onClick={handleToggleKeepForever}
                  disabled={isUpdating}
                >
                  <InfinityIcon className={`w-5 h-5 ${item.keep_forever ? 'text-[#4a3f35]' : 'text-[#8d7b6d]'}`} />
                  <span>{item.keep_forever ? 'Unmark Keep Forever' : 'Mark as Keep Forever'}</span>
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-[#f5ebe0]/60" />

                {/* Edit Item option */}
                <button
                  className="w-full px-4 py-2.5 text-left text-[#6f5f52] hover:bg-[#f3ece4] flex items-center gap-3"
                  onClick={() => {
                    setIsOverflowMenuOpen(false);
                    handleEdit();
                  }}
                >
                  <EditIcon className="w-5 h-5 text-[#8d7b6d]" />
                  <span>Edit Item</span>
                </button>

                {/* Delete option */}
                <button
                  className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-3"
                  onClick={() => {
                    setIsOverflowMenuOpen(false);
                    handleDelete();
                  }}
                >
                  <TrashIcon className="w-5 h-5 text-red-500" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero Image - use thumbnail (cropped) if available, fallback to full photo */}
      {(() => {
        const aiMeta = item.ai_metadata as ItemAIMetadata | null;
        const detectedBbox = aiMeta?.detected_bbox as [number, number, number, number] | undefined;
        const hasMeaningfulBbox = detectedBbox && !(detectedBbox[0] === 0 && detectedBbox[1] === 0 && detectedBbox[2] >= 95 && detectedBbox[3] >= 95);
        return (
          <div className="relative">
            {hasMeaningfulBbox ? (
              <BoundingBoxImage
                src={item.photo_url}
                alt={item.name || 'Item photo'}
                bbox={detectedBbox}
                className="w-full bg-[#f3ece4]"
                imgClassName="max-h-[300px]"
                onClick={() => setIsPhotoViewerOpen(true)}
              />
            ) : (
              <button
                onClick={() => setIsPhotoViewerOpen(true)}
                className="w-full focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2"
                aria-label="View full size photo"
              >
                <img
                  src={item.thumbnail_url || item.photo_url}
                  alt={item.name || 'Item photo'}
                  className="w-full max-h-[300px] object-contain bg-[#f3ece4]"
                />
              </button>
            )}
          </div>
        );
      })()}

      {/* Expiration Banner (US-053) */}
      {item.expiration_date && (
        <ExpirationBanner expirationDate={item.expiration_date} />
      )}

      {/* Shared Photo Indicator (US-FIX-005) */}
      {item.source_batch_id && (
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-[#f5ebe0]/60 bg-[#fdf8f2] p-3">
            <p className="text-sm font-semibold text-[#4a3f35]">
              This photo contains multiple items
            </p>
            <div className="mt-2">
              <p className="text-xs text-[#8d7b6d] mb-2">Also in photo:</p>
              {isLoadingRelated ? (
                <p className="text-xs text-[#b9a99b]">Loading related items...</p>
              ) : relatedItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {relatedItems.map((related) => (
                    <button
                      key={related.id}
                      onClick={() => navigate(`/item/${related.id}`)}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-sm text-[#6f5f52] border border-[#f5ebe0]/60 hover:border-[#d6ccc2] hover:bg-[#f3ece4] transition-colors"
                    >
                      {related.name || 'Unnamed Item'}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#b9a99b]">No other items found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Primary Info Section (US-053) */}
      <div className="p-4">
        {/* Item name - large */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-2xl font-bold text-[#4a3f35]">
            {item.name || 'Unnamed Item'}
          </h2>
          {existingListing && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
              Listed
            </span>
          )}
        </div>

        {/* Category badge - tappable */}
        {item.category && (
          <button
            onClick={() => navigate(`/inventory?categories=${item.category!.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium mb-3 transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: `${item.category.color}20`, color: item.category.color }}
            aria-label={`Filter by category: ${item.category.name}`}
          >
            <span>{item.category.icon}</span>
            <span>{item.category.name}</span>
            <ChevronRightIcon className="w-3 h-3 ml-0.5" />
          </button>
        )}

        {/* Location path - tappable */}
        {item.location && (
          <button
            onClick={() => navigate(`/inventory?location=${item.location!.id}`)}
            className="flex items-center gap-2 text-[#8d7b6d] mb-4 hover:text-[#4a3f35] transition-colors group"
            aria-label={`Filter by location: ${item.location.path}`}
          >
            <span className="flex-shrink-0">{item.location.icon}</span>
            <span className="group-hover:underline">{item.location.path}</span>
            <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {/* Tags row - horizontal scroll */}
        {item.tags && item.tags.length > 0 && (
          <div className="mb-4 -mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {item.tags.map((tag, index) => {
                const colorHex = getColorHex(tag);
                return (
                  <TagChip
                    key={`${tag}-${index}`}
                    label={tag}
                    prefix="#"
                    isColor={!!colorHex}
                    colorHex={colorHex}
                    className="text-sm px-3 py-1 flex-shrink-0"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Listing actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {existingListing ? (
            <button
              type="button"
              disabled
              className="px-4 py-2.5 rounded-xl border border-[#f5ebe0]/60 bg-[#fdf8f2] text-[#b9a99b] font-semibold text-sm flex flex-col items-center justify-center min-w-[140px]"
              aria-disabled="true"
            >
              <span>Edit Listing</span>
              <span className="text-[11px] font-normal">Already Listed</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowListingModal(true)}
              disabled={isListingLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sell / Share
            </button>
          )}
        </div>
      </div>

      {/* Details Section (US-054) */}
      <DetailsSection item={item} />

      {/* Metadata Section (US-055) */}
      <MetadataSection
        createdAt={item.created_at}
        updatedAt={item.updated_at}
        lastViewedAt={item.last_viewed_at}
      />

      {/* Delete Confirmation Dialog (US-055) */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-xl mx-4 max-w-sm w-full overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Item thumbnail */}
            <div className="flex justify-center pt-6 pb-4">
              <img
                src={item.thumbnail_url || item.photo_url}
                alt={item.name || 'Item photo'}
                className="w-20 h-20 rounded-lg object-cover"
              />
            </div>

            {/* Dialog content */}
            <div className="px-6 pb-4 text-center">
              <h3 className="text-lg font-semibold text-[#4a3f35] mb-2">
                Delete this item?
              </h3>
              <p className="text-[#8d7b6d] mb-1 font-medium">
                {item.name || 'Unnamed Item'}
              </p>
              <p className="text-sm text-[#8d7b6d]">
                Permanently deleted after 30 days
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex border-t border-[#f5ebe0]/60">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 text-[#6f5f52] font-medium hover:bg-[#fdf8f2] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 text-red-600 font-medium hover:bg-red-50 transition-colors border-l border-[#f5ebe0]/60 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen photo viewer */}
      {isPhotoViewerOpen && (() => {
        const aiMeta = item.ai_metadata as ItemAIMetadata | null;
        const detectedBbox = aiMeta?.detected_bbox as [number, number, number, number] | undefined;
        const hasMeaningfulBbox = detectedBbox && !(detectedBbox[0] === 0 && detectedBbox[1] === 0 && detectedBbox[2] >= 95 && detectedBbox[3] >= 95);
        return (
          <PhotoViewer
            imageUrl={item.photo_url}
            bbox={hasMeaningfulBbox ? detectedBbox : null}
            onClose={() => setIsPhotoViewerOpen(false)}
          />
        );
      })()}

      {/* Listing Form Modal */}
      <ListingFormModal
        isOpen={showListingModal}
        onClose={() => setShowListingModal(false)}
        item={{
          id: item.id,
          name: item.name || 'Unnamed Item',
          photo_url: item.thumbnail_url || item.photo_url,
        }}
        onSuccess={() => {
          fetchItem();
          fetchListing();
        }}
      />

      {/* Toast notification (US-056) */}
      {toast && (
        <div
          className={`fixed bottom-24 left-4 right-4 mx-auto max-w-md px-4 py-3 rounded-lg shadow-lg text-white text-center z-50 flex items-center justify-center gap-2 animate-fade-in ${toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-[#4a3f35]'
            }`}
          role="alert"
        >
          {toast.type === 'success' && <CheckIcon className="w-5 h-5 flex-shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Undo delete toast (US-058) */}
      {undoToast && (
        <div
          className="fixed bottom-24 left-4 right-4 mx-auto max-w-md px-4 py-3 rounded-lg shadow-lg bg-[#4a3f35] text-white z-50 animate-fade-in"
          role="alert"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrashIcon className="w-5 h-5 flex-shrink-0 text-[#d6ccc2]" />
              <span>Item deleted</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Countdown indicator */}
              <span className="text-sm text-[#b9a99b] tabular-nums">
                {undoToast.countdown}s
              </span>
              {/* Undo button */}
              <button
                onClick={handleUndo}
                className="px-3 py-1 bg-white text-[#4a3f35] font-medium rounded hover:bg-[#f3ece4] transition-colors"
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
