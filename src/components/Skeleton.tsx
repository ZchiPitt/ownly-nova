/**
 * Reusable Skeleton Components
 * Building blocks for loading placeholders across the app
 * All components use pulse animation for consistent loading UX
 */

import { type CSSProperties, type ReactNode } from 'react';

interface SkeletonBaseProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Base skeleton component with pulse animation
 */
function SkeletonBase({ className = '', style }: SkeletonBaseProps) {
  return (
    <div
      className={`bg-[#f5ebe0] animate-pulse ${className}`}
      style={style}
    />
  );
}

/**
 * SkeletonLine - Text placeholder (single line)
 * Use for text content like names, descriptions, labels
 */
interface SkeletonLineProps extends SkeletonBaseProps {
  /** Width of the line (default: '100%') */
  width?: string | number;
  /** Height of the line (default: '1rem' / 16px) */
  height?: string | number;
}

export function SkeletonLine({
  width = '100%',
  height = '1rem',
  className = '',
  style
}: SkeletonLineProps) {
  return (
    <SkeletonBase
      className={`rounded ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    />
  );
}

/**
 * SkeletonCircle - Circular placeholder
 * Use for avatars, icons, badges
 */
interface SkeletonCircleProps extends SkeletonBaseProps {
  /** Diameter of the circle (default: 40) */
  size?: number;
}

export function SkeletonCircle({
  size = 40,
  className = '',
  style
}: SkeletonCircleProps) {
  return (
    <SkeletonBase
      className={`rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    />
  );
}

/**
 * SkeletonRect - Rectangular placeholder
 * Use for images, thumbnails, cards
 */
interface SkeletonRectProps extends SkeletonBaseProps {
  /** Width of the rectangle */
  width?: string | number;
  /** Height of the rectangle */
  height?: string | number;
  /** Border radius (default: 'rounded-lg') */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Aspect ratio (if set, height is ignored) */
  aspectRatio?: '1/1' | '4/3' | '16/9' | '3/4';
}

export function SkeletonRect({
  width = '100%',
  height = '100px',
  rounded = 'lg',
  aspectRatio,
  className = '',
  style
}: SkeletonRectProps) {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <SkeletonBase
      className={`${roundedClasses[rounded]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: aspectRatio ? undefined : (typeof height === 'number' ? `${height}px` : height),
        aspectRatio: aspectRatio,
        ...style,
      }}
    />
  );
}

/**
 * SkeletonCard - Card placeholder with content area
 * Use for item cards, stat cards, preview cards
 */
interface SkeletonCardProps extends SkeletonBaseProps {
  /** Show image placeholder at top */
  showImage?: boolean;
  /** Image aspect ratio */
  imageAspectRatio?: '1/1' | '4/3' | '16/9';
  /** Number of text lines to show */
  lines?: number;
  /** Show badge/chip placeholder */
  showBadge?: boolean;
}

export function SkeletonCard({
  showImage = true,
  imageAspectRatio = '1/1',
  lines = 2,
  showBadge = false,
  className = '',
  style,
}: SkeletonCardProps) {
  return (
    <div
      className={`bg-white rounded-lg overflow-hidden ${className}`}
      style={style}
    >
      {showImage && (
        <SkeletonRect
          width="100%"
          aspectRatio={imageAspectRatio}
          rounded="none"
        />
      )}
      <div className="p-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? '60%' : '100%'}
            height={i === 0 ? '1rem' : '0.75rem'}
          />
        ))}
        {showBadge && (
          <SkeletonLine width="5rem" height="1.25rem" className="rounded-full" />
        )}
      </div>
    </div>
  );
}

/**
 * SkeletonListRow - List row placeholder
 * Use for list view items, search results
 */
interface SkeletonListRowProps extends SkeletonBaseProps {
  /** Show thumbnail on left */
  showThumbnail?: boolean;
  /** Thumbnail size (default: 60) */
  thumbnailSize?: number;
  /** Number of text lines */
  lines?: number;
  /** Show action/chevron on right */
  showAction?: boolean;
  /** Row height (default: 72) */
  height?: number;
}

export function SkeletonListRow({
  showThumbnail = true,
  thumbnailSize = 60,
  lines = 2,
  showAction = true,
  height = 72,
  className = '',
  style,
}: SkeletonListRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white ${className}`}
      style={{ height, ...style }}
    >
      {showThumbnail && (
        <SkeletonRect
          width={thumbnailSize}
          height={thumbnailSize}
          rounded="lg"
          className="flex-shrink-0"
        />
      )}
      <div className="flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === 0 ? '75%' : '50%'}
            height={i === 0 ? '1rem' : '0.75rem'}
          />
        ))}
      </div>
      {showAction && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <SkeletonLine width="4rem" height="1.25rem" className="rounded-full" />
          <SkeletonRect width={20} height={20} rounded="sm" />
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonGrid - Grid of card skeletons
 * Use for gallery view inventory
 */
interface SkeletonGridProps extends SkeletonBaseProps {
  /** Number of items */
  count?: number;
  /** Grid columns (responsive default) */
  columns?: 2 | 3 | 4;
  /** Gap between items */
  gap?: number;
  /** Card props to pass to each skeleton card */
  cardProps?: Omit<SkeletonCardProps, 'className' | 'style'>;
}

export function SkeletonGrid({
  count = 6,
  columns,
  gap = 4,
  cardProps = {},
  className = '',
  style,
}: SkeletonGridProps) {
  const gridCols = columns
    ? `grid-cols-${columns}`
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div
      className={`grid ${gridCols} gap-${gap} ${className}`}
      style={style}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} {...cardProps} />
      ))}
    </div>
  );
}

/**
 * SkeletonList - List of row skeletons
 * Use for list view inventory, notifications
 */
interface SkeletonListProps extends SkeletonBaseProps {
  /** Number of items */
  count?: number;
  /** Row props to pass to each skeleton row */
  rowProps?: Omit<SkeletonListRowProps, 'className' | 'style'>;
  /** Show dividers between rows */
  showDividers?: boolean;
}

export function SkeletonList({
  count = 5,
  rowProps = {},
  showDividers = true,
  className = '',
  style,
}: SkeletonListProps) {
  return (
    <div className={className} style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <SkeletonListRow {...rowProps} />
          {showDividers && i < count - 1 && (
            <div className="border-b border-[#f5ebe0]" />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonStatCard - Stat card placeholder
 * Use for dashboard stat cards
 */
interface SkeletonStatCardProps extends SkeletonBaseProps {
  /** Width of the card */
  width?: string | number;
}

export function SkeletonStatCard({
  width = 100,
  className = '',
  style,
}: SkeletonStatCardProps) {
  return (
    <div
      className={`flex-shrink-0 bg-white rounded-xl p-4 shadow-sm ${className}`}
      style={{ width, ...style }}
    >
      <SkeletonCircle size={40} className="mb-2" />
      <SkeletonLine width="80%" height="0.75rem" className="mb-1" />
      <SkeletonLine width="60%" height="1.5rem" />
    </div>
  );
}

/**
 * SkeletonSection - Section with header and content
 * Use for dashboard sections
 */
interface SkeletonSectionProps extends SkeletonBaseProps {
  /** Section title width */
  titleWidth?: string | number;
  /** Content to render */
  children?: ReactNode;
}

export function SkeletonSection({
  titleWidth = '8rem',
  children,
  className = '',
  style,
}: SkeletonSectionProps) {
  return (
    <div className={className} style={style}>
      <div className="flex items-center justify-between mb-3">
        <SkeletonLine width={titleWidth} height="1.25rem" />
        <SkeletonLine width="3rem" height="0.875rem" />
      </div>
      {children}
    </div>
  );
}

/**
 * SkeletonItemDetail - Full item detail page skeleton
 * Use for item detail loading state
 */
export function SkeletonItemDetail({ className = '' }: SkeletonBaseProps) {
  return (
    <div className={`min-h-screen bg-[#fdf8f2] pb-safe-area-pb ${className}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]">
        <div className="flex items-center justify-between px-4 py-3">
          <SkeletonCircle size={40} />
          <SkeletonLine width="6rem" height="1.5rem" />
          <SkeletonCircle size={40} />
        </div>
      </div>

      {/* Hero image */}
      <SkeletonRect width="100%" height={300} rounded="none" />

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name */}
        <SkeletonLine width="75%" height="2rem" />

        {/* Category and location */}
        <div className="flex items-center gap-2">
          <SkeletonLine width="5rem" height="1.5rem" className="rounded-full" />
          <SkeletonLine width="8rem" height="1rem" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <SkeletonLine width="100%" height="0.875rem" />
          <SkeletonLine width="90%" height="0.875rem" />
          <SkeletonLine width="70%" height="0.875rem" />
        </div>

        {/* Details section */}
        <div className="pt-4 space-y-3">
          <SkeletonLine width="4rem" height="1rem" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SkeletonLine width="3rem" height="0.75rem" className="mb-1" />
              <SkeletonLine width="5rem" height="1rem" />
            </div>
            <div>
              <SkeletonLine width="4rem" height="0.75rem" className="mb-1" />
              <SkeletonLine width="6rem" height="1rem" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#fdf8f2] border-t border-[#f5ebe0] p-4 pb-safe-area-pb">
        <div className="flex gap-3">
          <SkeletonLine width="100%" height="2.75rem" className="rounded-lg" />
          <SkeletonLine width="100%" height="2.75rem" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonSearchResult - Search result row skeleton
 * Use for search results loading state
 */
export function SkeletonSearchResult({ className = '' }: SkeletonBaseProps) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-white border-b border-[#f5ebe0] ${className}`}>
      <SkeletonRect width={56} height={56} rounded="lg" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <SkeletonLine width="75%" height="1rem" className="mb-2" />
        <SkeletonLine width="50%" height="0.75rem" className="mb-2" />
        <SkeletonLine width="5rem" height="1.25rem" className="rounded-full" />
      </div>
      <SkeletonRect width={20} height={20} rounded="sm" className="flex-shrink-0" />
    </div>
  );
}

/**
 * SkeletonDashboard - Full dashboard page skeleton
 * Use for dashboard initial loading state
 */
export function SkeletonDashboard({ className = '' }: SkeletonBaseProps) {
  return (
    <div className={`space-y-6 p-4 ${className}`}>
      {/* Greeting and avatar */}
      <div className="flex items-center justify-between">
        <div>
          <SkeletonLine width="10rem" height="1.5rem" className="mb-1" />
          <SkeletonLine width="6rem" height="1rem" />
        </div>
        <SkeletonCircle size={48} />
      </div>

      {/* Search bar */}
      <SkeletonLine width="100%" height="3rem" className="rounded-lg" />

      {/* Stat cards */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <SkeletonStatCard width={100} />
        <SkeletonStatCard width={100} />
        <SkeletonStatCard width={100} />
      </div>

      {/* Expiring Soon section */}
      <SkeletonSection titleWidth="8rem">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="w-40 flex-shrink-0" lines={2} showBadge />
          ))}
        </div>
      </SkeletonSection>

      {/* Recently Added section */}
      <SkeletonSection titleWidth="7rem">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} className="w-32 flex-shrink-0" imageAspectRatio="1/1" lines={2} />
          ))}
        </div>
      </SkeletonSection>
    </div>
  );
}

/**
 * SkeletonInventory - Inventory page skeleton (adapts to view mode)
 * Use for inventory initial loading state
 */
interface SkeletonInventoryProps extends SkeletonBaseProps {
  /** View mode */
  viewMode?: 'gallery' | 'list';
  /** Number of items */
  count?: number;
}

export function SkeletonInventory({
  viewMode = 'gallery',
  count = 8,
  className = ''
}: SkeletonInventoryProps) {
  return (
    <div className={className}>
      {/* Header with title and view toggle */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-[#f5ebe0]">
        <div>
          <SkeletonLine width="8rem" height="1.5rem" className="mb-1" />
          <SkeletonLine width="4rem" height="0.875rem" />
        </div>
        <div className="flex gap-2">
          <SkeletonRect width={32} height={32} rounded="md" />
          <SkeletonRect width={32} height={32} rounded="md" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 p-3 bg-white border-b border-[#f5ebe0] overflow-x-auto">
        <SkeletonLine width="5rem" height="2rem" className="rounded-full flex-shrink-0" />
        <SkeletonLine width="6rem" height="2rem" className="rounded-full flex-shrink-0" />
        <SkeletonLine width="5rem" height="2rem" className="rounded-full flex-shrink-0" />
      </div>

      {/* Content */}
      {viewMode === 'gallery' ? (
        <SkeletonGrid count={count} className="p-4" cardProps={{ lines: 1 }} />
      ) : (
        <SkeletonList count={count} rowProps={{ lines: 2 }} />
      )}
    </div>
  );
}
