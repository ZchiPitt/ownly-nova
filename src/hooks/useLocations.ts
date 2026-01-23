/**
 * Hook for fetching and managing locations
 *
 * Provides:
 * - Fetching user's locations with hierarchical structure
 * - Creating new locations with optional parent
 * - Building location tree for display
 * - Getting full location path
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Location } from '@/types';

/**
 * Location with children for tree structure
 */
export interface LocationNode extends Location {
  children: LocationNode[];
}

/**
 * Request to create a new location
 */
export interface CreateLocationRequest {
  name: string;
  parent_id?: string | null;
  icon?: string;
}

interface UseLocationsResult {
  /** All locations (flat list) */
  locations: Location[];
  /** Locations as hierarchical tree */
  locationTree: LocationNode[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Refetch locations */
  refetch: () => Promise<void>;
  /** Create a new location */
  createLocation: (request: CreateLocationRequest) => Promise<Location | null>;
  /** Get location by ID */
  getLocationById: (id: string) => Location | undefined;
  /** Get full path for a location */
  getLocationPath: (id: string) => string;
  /** Get parent locations (for parent selector) */
  getPotentialParents: (excludeId?: string) => Location[];
}

/**
 * Build hierarchical tree from flat locations list
 */
function buildLocationTree(locations: Location[]): LocationNode[] {
  // Create map of id -> node
  const nodeMap = new Map<string, LocationNode>();

  // First pass: create all nodes
  for (const loc of locations) {
    nodeMap.set(loc.id, { ...loc, children: [] });
  }

  // Second pass: build parent-child relationships
  const rootNodes: LocationNode[] = [];

  for (const loc of locations) {
    const node = nodeMap.get(loc.id)!;

    if (loc.parent_id && nodeMap.has(loc.parent_id)) {
      // Has parent - add to parent's children
      const parent = nodeMap.get(loc.parent_id)!;
      parent.children.push(node);
    } else {
      // Root node
      rootNodes.push(node);
    }
  }

  // Sort children by name at each level
  const sortChildren = (nodes: LocationNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  };

  sortChildren(rootNodes);

  return rootNodes;
}

/**
 * Hook to fetch and manage locations
 */
export function useLocations(): UseLocationsResult {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all locations for the user
   */
  const fetchLocations = useCallback(async () => {
    if (!user) {
      setLocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('path', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Create a new location
   */
  const createLocation = useCallback(
    async (request: CreateLocationRequest): Promise<Location | null> => {
      if (!user) {
        setError('You must be logged in to create a location');
        return null;
      }

      try {
        const insertData = {
          name: request.name,
          parent_id: request.parent_id || null,
          icon: request.icon || '📍',
          user_id: user.id,
        };

        const { data, error: createError } = await (supabase
          .from('locations') as ReturnType<typeof supabase.from>)
          .insert(insertData as Record<string, unknown>)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        // Refetch to get updated path and depth from trigger
        await fetchLocations();

        return data;
      } catch (err) {
        console.error('Error creating location:', err);
        setError(err instanceof Error ? err.message : 'Failed to create location');
        return null;
      }
    },
    [user, fetchLocations]
  );

  /**
   * Get location by ID
   */
  const getLocationById = useCallback(
    (id: string): Location | undefined => {
      return locations.find((loc) => loc.id === id);
    },
    [locations]
  );

  /**
   * Get full path for a location (from the stored path field)
   */
  const getLocationPath = useCallback(
    (id: string): string => {
      const location = locations.find((loc) => loc.id === id);
      return location?.path || '';
    },
    [locations]
  );

  /**
   * Get potential parent locations for location creation
   * Excludes the specified location and its descendants
   */
  const getPotentialParents = useCallback(
    (excludeId?: string): Location[] => {
      if (!excludeId) {
        return locations;
      }

      // Get the location to exclude
      const excludeLocation = locations.find((loc) => loc.id === excludeId);
      if (!excludeLocation) {
        return locations;
      }

      // Filter out the excluded location and any that have it as an ancestor
      // (can't make a parent a child of itself)
      return locations.filter((loc) => {
        if (loc.id === excludeId) return false;
        // Check if this location is a descendant of excludeId
        // by looking at the path
        if (excludeLocation.path && loc.path?.startsWith(excludeLocation.path + ' > ')) {
          return false;
        }
        return true;
      });
    },
    [locations]
  );

  // Build hierarchical tree
  const locationTree = useMemo(
    () => buildLocationTree(locations),
    [locations]
  );

  // Fetch locations on mount and when user changes
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return {
    locations,
    locationTree,
    isLoading,
    error,
    refetch: fetchLocations,
    createLocation,
    getLocationById,
    getLocationPath,
    getPotentialParents,
  };
}
