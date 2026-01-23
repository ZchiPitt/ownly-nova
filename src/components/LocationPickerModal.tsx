/**
 * Location Picker Modal Component
 *
 * Modal for selecting a storage location for an item.
 * Features:
 * - Hierarchical tree of user locations with expand/collapse
 * - Each location shows item count badge
 * - "No location assigned" option at top
 * - "Add New Location" button at bottom
 * - Adding location with optional parent selector
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocations, type LocationNode, type CreateLocationRequest } from '@/hooks/useLocations';
import type { Location } from '@/types';

/**
 * Props for the LocationPickerModal component
 */
export interface LocationPickerModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Currently selected location ID (null for no location) */
  selectedLocationId: string | null;
  /** Callback when location is selected */
  onSelect: (locationId: string | null) => void;
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
}: LocationTreeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          isSelected
            ? 'bg-[#e3ead3]/20 border-l-4 border-[#4a3f35]'
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

        {/* Location name */}
        <span className={`flex-1 truncate ${isSelected ? 'font-medium text-[#4a3f35]' : ''}`}>
          {node.name}
        </span>

        {/* Item count badge */}
        {node.item_count > 0 && (
          <span className="flex-shrink-0 text-xs bg-[#fdf8f2] text-[#8d7b6d] px-2 py-0.5 rounded-full">
            {node.item_count}
          </span>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <svg
            className="w-5 h-5 text-[#4a3f35] flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Add new location form component
 */
interface AddLocationFormProps {
  locations: Location[];
  onSave: (request: CreateLocationRequest) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function AddLocationForm({ locations, onSave, onCancel, isSaving }: AddLocationFormProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [isParentSelectorOpen, setIsParentSelectorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parentSelectorRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close parent selector on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (parentSelectorRef.current && !parentSelectorRef.current.contains(event.target as Node)) {
        setIsParentSelectorOpen(false);
      }
    }

    if (isParentSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isParentSelectorOpen]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Location name is required');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Location name must be 100 characters or less');
      return;
    }

    setError(null);
    await onSave({
      name: trimmedName,
      parent_id: parentId,
    });
  }, [name, parentId, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  // Get selected parent name
  const selectedParent = parentId ? locations.find((l) => l.id === parentId) : null;

  return (
    <div className="p-4 border-t border-[#f5ebe0] bg-[#fdf8f2]">
      <div className="space-y-3">
        {/* Name input */}
        <div>
          <label htmlFor="new-location-name" className="block text-sm font-medium text-[#4a3f35] mb-1">
            Location Name
          </label>
          <input
            ref={inputRef}
            id="new-location-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 100));
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Living Room Shelf"
            maxLength={100}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-[#f5ebe0] rounded-lg focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <p className="mt-1 text-xs text-[#d6ccc2]">{name.length}/100</p>
        </div>

        {/* Parent selector */}
        <div className="relative" ref={parentSelectorRef}>
          <label className="block text-sm font-medium text-[#4a3f35] mb-1">
            Parent Location (optional)
          </label>
          <button
            type="button"
            onClick={() => setIsParentSelectorOpen(!isParentSelectorOpen)}
            disabled={isSaving}
            className="w-full flex items-center justify-between px-3 py-2 border border-[#f5ebe0] rounded-lg bg-white text-sm text-left hover:bg-[#fdf8f2] disabled:opacity-50"
          >
            <span className={selectedParent ? '' : 'text-[#d6ccc2]'}>
              {selectedParent ? (
                <span className="flex items-center gap-2">
                  <span>{selectedParent.icon}</span>
                  <span>{selectedParent.path || selectedParent.name}</span>
                </span>
              ) : (
                'None (root level)'
              )}
            </span>
            <svg
              className={`w-4 h-4 text-[#d6ccc2] transition-transform ${isParentSelectorOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Parent dropdown */}
          {isParentSelectorOpen && (
            <div className="absolute z-30 mt-1 w-full bg-white border border-[#f5ebe0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setParentId(null);
                  setIsParentSelectorOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#fdf8f2] ${
                  !parentId ? 'bg-[#e3ead3]/20 text-[#4a3f35]' : ''
                }`}
              >
                None (root level)
              </button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setParentId(loc.id);
                    setIsParentSelectorOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[#fdf8f2] flex items-center gap-2 ${
                    parentId === loc.id ? 'bg-[#e3ead3]/20 text-[#4a3f35]' : ''
                  }`}
                >
                  <span>{loc.icon}</span>
                  <span className="truncate">{loc.path || loc.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isSaving || !name.trim()
                ? 'bg-[#fdf8f2] text-[#d6ccc2] cursor-not-allowed'
                : 'bg-[#4a3f35] text-white hover:bg-[#3d332b]'
            }`}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                Saving...
              </span>
            ) : (
              'Add Location'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-[#4a3f35] hover:bg-[#fdf8f2] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
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
 * Inner modal content component - gets reset via key when modal opens
 */
interface LocationPickerContentProps {
  locations: Location[];
  locationTree: LocationNode[];
  isLoading: boolean;
  createLocation: (request: CreateLocationRequest) => Promise<Location | null>;
  selectedLocationId: string | null;
  onSelect: (locationId: string | null) => void;
  onClose: () => void;
}

function LocationPickerContent({
  locations,
  locationTree,
  isLoading,
  createLocation,
  selectedLocationId,
  onSelect,
  onClose,
}: LocationPickerContentProps) {
  // Initialize expanded IDs from selected location's ancestors
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => getAncestorIds(selectedLocationId, locations)
  );
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Toggle expand/collapse for a location
   */
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
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
   * Handle location selection
   */
  const handleSelect = useCallback((id: string | null) => {
    onSelect(id);
    onClose();
  }, [onSelect, onClose]);

  /**
   * Handle creating a new location
   */
  const handleSaveLocation = useCallback(
    async (request: CreateLocationRequest) => {
      setIsSaving(true);
      const newLocation = await createLocation(request);
      setIsSaving(false);

      if (newLocation) {
        // Select the newly created location
        onSelect(newLocation.id);
        onClose();
      }
    },
    [createLocation, onSelect, onClose]
  );

  /**
   * Handle close - also cancel adding
   */
  const handleClose = useCallback(() => {
    setIsAddingLocation(false);
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-xl rounded-t-xl shadow-xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5ebe0] flex-shrink-0">
          <h2 className="text-lg font-semibold text-[#4a3f35]">Select Location</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -m-2 text-[#d6ccc2] hover:text-[#8d7b6d]"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              {/* No location option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#fdf8f2] ${
                  selectedLocationId === null
                    ? 'bg-[#e3ead3]/20 border-l-4 border-l-[#4a3f35]'
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
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                <span className={`flex-1 ${selectedLocationId === null ? 'font-medium text-[#4a3f35]' : 'text-[#8d7b6d]'}`}>
                  No location assigned
                </span>
                {selectedLocationId === null && (
                  <svg
                    className="w-5 h-5 text-[#4a3f35] flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Location tree */}
              {locationTree.length > 0 ? (
                <div className="py-1">
                  {locationTree.map((node) => (
                    <LocationTreeItem
                      key={node.id}
                      node={node}
                      selectedId={selectedLocationId}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                      onSelect={handleSelect}
                      level={0}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-[#a89887]">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-[#f5ebe0]"
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
                  <p className="text-xs text-[#d6ccc2] mt-1">Add your first location below</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add new location section */}
        {isAddingLocation ? (
          <AddLocationForm
            locations={locations}
            onSave={handleSaveLocation}
            onCancel={() => setIsAddingLocation(false)}
            isSaving={isSaving}
          />
        ) : (
          <div className="flex-shrink-0 p-4 border-t border-[#f5ebe0]">
            <button
              type="button"
              onClick={() => setIsAddingLocation(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[#4a3f35] font-medium rounded-lg border border-[#f5ebe0] hover:bg-[#e3ead3]/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Location
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Location Picker Modal Component
 *
 * Wrapper that handles open/close state. The inner content component
 * is unmounted when modal closes, which naturally resets its state.
 */
export function LocationPickerModal({
  isOpen,
  onClose,
  selectedLocationId,
  onSelect,
}: LocationPickerModalProps) {
  const { locations, locationTree, isLoading, createLocation } = useLocations();

  // Don't render anything when closed - this unmounts the inner component
  // and naturally resets all its state when reopened
  if (!isOpen) {
    return null;
  }

  return (
    <LocationPickerContent
      locations={locations}
      locationTree={locationTree}
      isLoading={isLoading}
      createLocation={createLocation}
      selectedLocationId={selectedLocationId}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
