/**
 * Hook for managing recent search queries in localStorage
 * Features:
 * - Store last 10 unique queries
 * - Add new searches (min 2 chars, only when results found)
 * - Remove individual queries
 * - Clear all queries
 * - Persist across sessions via localStorage
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ownly_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export interface UseRecentSearchesResult {
  recentSearches: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearAll: () => void;
}

/**
 * Load recent searches from localStorage
 */
function loadFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Filter to ensure all items are strings and take max 10
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .slice(0, MAX_RECENT_SEARCHES);
      }
    }
  } catch (error) {
    console.warn('Failed to load recent searches:', error);
  }
  return [];
}

/**
 * Save recent searches to localStorage
 */
function saveToStorage(searches: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch (error) {
    console.warn('Failed to save recent searches:', error);
  }
}

/**
 * Custom hook for managing recent search queries
 */
export function useRecentSearches(): UseRecentSearchesResult {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadFromStorage());

  // Sync with localStorage on mount (in case of multiple tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setRecentSearches(loadFromStorage());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Add a search query to recent searches
   * - Adds to the beginning of the list
   * - Removes duplicates
   * - Keeps max 10 searches
   */
  const addSearch = useCallback((query: string) => {
    // Normalize the query
    const normalizedQuery = query.trim().toLowerCase();

    // Don't add if too short
    if (normalizedQuery.length < 2) {
      return;
    }

    setRecentSearches((prev) => {
      // Remove the query if it already exists (to move it to the front)
      const filtered = prev.filter(
        (search) => search.toLowerCase() !== normalizedQuery
      );

      // Add to the beginning and keep only max items
      const updated = [query.trim(), ...filtered].slice(0, MAX_RECENT_SEARCHES);

      // Save to localStorage
      saveToStorage(updated);

      return updated;
    });
  }, []);

  /**
   * Remove a specific search query from recent searches
   */
  const removeSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter(
        (search) => search.toLowerCase() !== query.toLowerCase()
      );

      // Save to localStorage
      saveToStorage(updated);

      return updated;
    });
  }, []);

  /**
   * Clear all recent searches
   */
  const clearAll = useCallback(() => {
    setRecentSearches([]);
    saveToStorage([]);
  }, []);

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearAll,
  };
}
