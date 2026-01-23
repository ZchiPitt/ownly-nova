/**
 * LocationFilterBottomSheet - Bottom sheet modal for filtering items by location
 *
 * Features:
 * - Search input at top for filtering long lists
 * - All Locations option at top (clears filter)
 * - Hierarchical tree with expand/collapse
 * - Each location shows item count badge
 * - Single-select: selecting location includes all children
 * - Apply Filter button at bottom
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocations, type LocationNode } from '@/hooks/useLocations';
import type { Location } from '@/types';

interface LocationFilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocationId: string | null;
  onApplyFilter: (locationId: string | null) => void;
}

/**
 * Calculate ancestors of a location for expanding the tree
 */
function getAncestorIds(locationId: string | null, locations: Location[]): Set<string> {
  if (!locationId) return new Set();

  const selectedLocation = locations.find((l) => l.id === locationId);
  if (!selectedLocation?.parent_id) return new Set();

  const ancestors = new Set<string>();
  let currentId: string | null = selectedLocation.parent_id;

  while (currentId) {
    ancestors.add(currentId);
    const parent = locations.find((l) => l.id === currentId);
    currentId = parent?.parent_id || null;
  }

  return ancestors;
}

/**
 * Filter location tree by search query
 * Keeps parent nodes visible if any descendant matches
 */
function filterLocationTree(
  nodes: LocationNode[],
  query: string
): LocationNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase().trim();

  const filterNode = (node: LocationNode): LocationNode | null => {
    const matchesQuery = node.name.toLowerCase().includes(lowerQuery);
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is LocationNode => n !== null);

    // Keep this node if it matches or any children match
    if (matchesQuery || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  return nodes
    .map(filterNode)
    .filter((n): n is LocationNode => n !== null);
}

/**
 * Get all location IDs that match the search query (for auto-expansion)
 */
function getMatchingLocationIds(
  locations: Location[],
  query: string
): Set<string> {
  if (!query.trim()) return new Set();

  const lowerQuery = query.toLowerCase().trim();
  const matchingIds = new Set<string>();

  for (const loc of locations) {
    if (loc.name.toLowerCase().includes(lowerQuery)) {
      matchingIds.add(loc.id);
    }
  }

  return matchingIds;
}

/**
 * Get all ancestor IDs for a set of location IDs
 */
function getAllAncestorIds(
  locationIds: Set<string>,
  locations: Location[]
): Set<string> {
  const ancestors = new Set<string>();

  for (const id of locationIds) {
    const location = locations.find((l) => l.id === id);
    let currentId = location?.parent_id;

    while (currentId) {
      ancestors.add(currentId);
      const parent = locations.find((l) => l.id === currentId);
      currentId = parent?.parent_id || null;
    }
  }

  return ancestors;
}

/**
 * Props for a location tree item
 */
interface LocationTreeItemProps {
  node: LocationNode;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  level: number;
  searchQuery: string;
}

/**
 * Recursive tree item component
 */
function LocationTreeItem({
  node,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  level,
  searchQuery,
}: LocationTreeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase().trim();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + searchQuery.length);
    const after = text.slice(index + searchQuery.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-200 text-[#4a3f35]">{match}</mark>
        {after}
      </>
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          isSelected
            ? 'bg-[#fdf8f2] border-l-4 border-[#4a3f35]'
            : 'hover:bg-[#fdf8f2] border-l-4 border-transparent'
        }`}
        style={{ paddingLeft: `${level * 20 + 16}px` }}
      >
        {/* Expand/collapse button for items with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="p-1 -m-1 text-[#d6ccc2] hover:text-[#8d7b6d]"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-4" /> // Spacer to align with items that have children
        )}

        {/* Location icon */}
        <span className="text-lg flex-shrink-0">{node.icon}</span>

        {/* Location name with search highlighting */}
        <span className={`flex-1 truncate ${isSelected ? 'font-medium text-[#4a3f35]' : ''}`}>
          {highlightText(node.name)}
        </span>

        {/* Item count badge */}
        {node.item_count > 0 && (
          <span className="flex-shrink-0 text-xs bg-[#f5ebe0] text-[#8d7b6d] px-2 py-0.5 rounded-full">
            {node.item_count}
          </span>
        )}

        {/* Selected radio indicator */}
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'border-[#4a3f35] bg-[#4a3f35]' : 'border-[#d6ccc2]'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </button>

      {/* Children (if expanded) */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LocationTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              level={level + 1}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inner content component - gets reset when modal opens
 */
interface LocationFilterContentProps {
  locations: Location[];
  locationTree: LocationNode[];
  isLoading: boolean;
  selectedLocationId: string | null;
  onApplyFilter: (locationId: string | null) => void;
  onClose: () => void;
}

function LocationFilterContent({
  locations,
  locationTree,
  isLoading,
  selectedLocationId,
  onApplyFilter,
  onClose,
}: LocationFilterContentProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedLocationId);

  // Track manually toggled expansions
  const [manualExpandedIds, setManualExpandedIds] = useState<Set<string>>(
    () => getAncestorIds(selectedLocationId, locations)
  );

  // Auto-expand ancestors of matching locations when searching
  const searchExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const matchingIds = getMatchingLocationIds(locations, searchQuery);
    return getAllAncestorIds(matchingIds, locations);
  }, [searchQuery, locations]);

  // Combine manual and search-based expansions
  const expandedIds = useMemo(() => {
    const combined = new Set(manualExpandedIds);
    for (const id of searchExpandedIds) {
      combined.add(id);
    }
    return combined;
  }, [manualExpandedIds, searchExpandedIds]);

  // Filter the location tree based on search query
  const filteredTree = useMemo(
    () => filterLocationTree(locationTree, searchQuery),
    [locationTree, searchQuery]
  );

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  /**
   * Toggle expand/collapse for a location
   */
  const handleToggleExpand = useCallback((id: string) => {
    setManualExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Handle location selection (single-select)
   */
  const handleSelect = useCallback((id: string | null) => {
    setLocalSelectedId(id);
  }, []);

  /**
   * Handle apply filter
   */
  const handleApply = useCallback(() => {
    onApplyFilter(localSelectedId);
    onClose();
  }, [localSelectedId, onApplyFilter, onClose]);

  // Get selected location name for display
  const selectedLocation = localSelectedId
    ? locations.find((l) => l.id === localSelectedId)
    : null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-[#4a3f35]/20 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#fdf8f2] rounded-t-[3rem] soft-shadow animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[80vh] border-t border-white/50">
        {/* Handle bar */}
        <div className="flex justify-center pt-5 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-[#4a3f35]/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0">
          <h2 className="text-2xl font-black text-[#4a3f35] tracking-tight">Filter by Location</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl text-[#d6ccc2] hover:text-[#4a3f35] soft-shadow transition-all active:scale-95"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-[#f5ebe0] flex-shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d6ccc2]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search locations..."
              className="w-full pl-9 pr-3 py-2 border border-[#f5ebe0] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#d6ccc2] hover:text-[#8d7b6d]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 text-[#4a3f35] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : (
            <div>
              {/* All Locations option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#f5ebe0] ${
                  localSelectedId === null
                    ? 'bg-[#fdf8f2] border-l-4 border-l-[#4a3f35]'
                    : 'hover:bg-[#fdf8f2] border-l-4 border-l-transparent'
                }`}
              >
                <div className="w-4" /> {/* Spacer for alignment */}
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <span className={`flex-1 ${localSelectedId === null ? 'font-medium text-[#4a3f35]' : 'text-[#8d7b6d]'}`}>
                  All Locations
                </span>
                {/* Radio indicator */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    localSelectedId === null ? 'border-[#4a3f35] bg-[#4a3f35]' : 'border-[#d6ccc2]'
                  }`}
                >
                  {localSelectedId === null && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>

              {/* Location tree */}
              {filteredTree.length > 0 ? (
                <div className="py-1">
                  {filteredTree.map((node) => (
                    <LocationTreeItem
                      key={node.id}
                      node={node}
                      selectedId={localSelectedId}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                      onSelect={handleSelect}
                      level={0}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="px-4 py-8 text-center text-[#a89887]">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-[#d6ccc2]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm">No locations match "{searchQuery}"</p>
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-[#a89887]">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-[#d6ccc2]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <p className="text-sm">No locations yet</p>
                  <p className="text-xs text-[#d6ccc2] mt-1">Create locations from item editor</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Apply button */}
        <div className="flex-shrink-0 px-8 py-6 bg-white/40 border-t border-[#f5ebe0]/60 rounded-t-[2rem]">
          {/* Selection indicator */}
          {selectedLocation && (
            <p className="text-xs text-[#a89887] mb-2 text-center">
              Filtering by: <span className="font-medium">{selectedLocation.path || selectedLocation.name}</span>
            </p>
          )}
          <button
            onClick={handleApply}
            className="w-full py-3.5 bg-[#4a3f35] text-white font-black rounded-2xl hover:bg-[#3d332b] transition-colors active:scale-[0.98]"
          >
            Apply Filter
          </button>
        </div>

        {/* Safe area padding for iPhone */}
        <div className="h-6 bg-[#fdf8f2] flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Location Filter Bottom Sheet Component
 *
 * Wrapper that handles open/close state. The inner content component
 * is unmounted when modal closes, which naturally resets its state.
 */
export function LocationFilterBottomSheet({
  isOpen,
  onClose,
  selectedLocationId,
  onApplyFilter,
}: LocationFilterBottomSheetProps) {
  const { locations, locationTree, isLoading } = useLocations();

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  return (
    <LocationFilterContent
      locations={locations}
      locationTree={locationTree}
      isLoading={isLoading}
      selectedLocationId={selectedLocationId}
      onApplyFilter={onApplyFilter}
      onClose={onClose}
    />
  );
}
