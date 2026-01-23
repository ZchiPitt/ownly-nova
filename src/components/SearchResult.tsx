/**
 * Search Result Item Component
 * Displays a search result with highlighted matching text
 * Features:
 * - Thumbnail on left
 * - Name with highlighted match
 * - Location path
 * - Category badge
 * - Click navigates to item detail
 */

import { useNavigate } from 'react-router-dom';
import { TagChip } from '@/components/TagChip';
import type { SearchResultItem } from '@/hooks/useSearch';
import { getColorHex } from '@/lib/colorUtils';

interface SearchResultProps {
  item: SearchResultItem;
  query: string;
}

/**
 * Highlight matching text in a string
 * Uses <mark> element for yellow background highlighting
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) {
    return <>{text}</>;
  }

  // Escape special regex characters in query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create case-insensitive regex
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  // Split text by matches
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part matches (case-insensitive)
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <mark
            key={index}
            className="bg-yellow-200 text-[#4a3f35] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

/**
 * Chevron right icon for navigation indication
 */
function ChevronRightIcon() {
  return (
    <svg
      className="w-5 h-5 text-[#d6ccc2]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

/**
 * Location pin icon
 */
function LocationIcon() {
  return (
    <svg
      className="w-4 h-4 text-[#d6ccc2] flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function SearchResult({ item, query }: SearchResultProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/item/${item.id}`);
  };

  const displayName = item.name || 'Unnamed Item';
  const imageUrl = item.thumbnail_url || item.photo_url;
  const displayTags = item.tags ? item.tags.slice(0, 3) : [];

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 p-3 bg-white hover:bg-[#fdf8f2] transition-colors border-b border-[#f5ebe0] last:border-b-0 text-left"
      aria-label={`View ${displayName}`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0">
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#f5ebe0]">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Item name with highlighting */}
        <h3 className="font-medium text-[#4a3f35] truncate">
          <HighlightText text={displayName} query={query} />
        </h3>

        {/* Location path */}
        {item.location_path && (
          <div className="flex items-center gap-1 mt-0.5">
            <LocationIcon />
            <span className="text-sm text-[#a89887] truncate">
              <HighlightText text={item.location_path} query={query} />
            </span>
          </div>
        )}

        {/* Category badge */}
        {item.category_name && (
          <div className="mt-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: item.category_color ? `${item.category_color}20` : '#6b728020',
                color: item.category_color || '#6b7280',
              }}
            >
              {item.category_icon && (
                <span className="text-xs">{item.category_icon}</span>
              )}
              <HighlightText text={item.category_name} query={query} />
            </span>
          </div>
        )}

        {displayTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {displayTags.map((tag, index) => {
              const colorHex = getColorHex(tag);
              return (
                <TagChip
                  key={`${tag}-${index}`}
                  label={tag}
                  prefix="#"
                  isColor={!!colorHex}
                  colorHex={colorHex}
                  className="text-[11px] px-2 py-0.5"
                />
              );
            })}
            {item.tags.length > displayTags.length && (
              <span className="text-[10px] text-[#d6ccc2] px-1">
                +{item.tags.length - displayTags.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chevron */}
      <div className="flex-shrink-0">
        <ChevronRightIcon />
      </div>
    </button>
  );
}

/**
 * Skeleton loader for search results
 */
export function SearchResultSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border-b border-[#f5ebe0] animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="flex-shrink-0">
        <div className="w-14 h-14 rounded-lg bg-[#f5ebe0]" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        {/* Name skeleton */}
        <div className="h-4 bg-[#f5ebe0] rounded w-3/4 mb-2" />

        {/* Location skeleton */}
        <div className="h-3 bg-[#f5ebe0] rounded w-1/2 mb-2" />

        {/* Category badge skeleton */}
        <div className="h-5 bg-[#f5ebe0] rounded-full w-20" />
      </div>

      {/* Chevron skeleton */}
      <div className="flex-shrink-0">
        <div className="w-5 h-5 rounded bg-[#f5ebe0]" />
      </div>
    </div>
  );
}
