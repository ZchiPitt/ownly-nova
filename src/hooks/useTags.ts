/**
 * Hook for fetching user's existing tags for autocomplete
 *
 * Provides:
 * - Fetching all unique tags from user's items
 * - Filtering tags for autocomplete suggestions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface UseTagsResult {
  /** All unique tags from user's items */
  tags: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Refetch tags */
  refetch: () => Promise<void>;
  /** Get tag suggestions based on input */
  getSuggestions: (input: string, excludeTags: string[]) => string[];
}

/**
 * Hook to fetch and manage user's tags
 */
export function useTags(): UseTagsResult {
  const { user } = useAuth();
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all unique tags from user's items
   */
  const fetchTags = useCallback(async () => {
    if (!user) {
      setTags([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all items with their tags
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('tags')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (fetchError) {
        throw fetchError;
      }

      // Extract all unique tags from items
      const allTags = new Set<string>();
      for (const item of (data || []) as { tags: string[] }[]) {
        if (item.tags && Array.isArray(item.tags)) {
          for (const tag of item.tags) {
            if (tag && typeof tag === 'string') {
              allTags.add(tag);
            }
          }
        }
      }

      // Sort tags alphabetically
      setTags(Array.from(allTags).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Get tag suggestions based on input text
   * Filters existing tags that match the input and excludes already selected tags
   */
  const getSuggestions = useCallback(
    (input: string, excludeTags: string[]): string[] => {
      if (!input.trim()) {
        return [];
      }

      const searchTerm = input.toLowerCase().trim();
      const excludeSet = new Set(excludeTags.map((t) => t.toLowerCase()));

      return tags.filter((tag) => {
        const lowerTag = tag.toLowerCase();
        // Don't suggest already selected tags
        if (excludeSet.has(lowerTag)) {
          return false;
        }
        // Match tags that start with or contain the search term
        return lowerTag.includes(searchTerm);
      });
    },
    [tags]
  );

  // Fetch tags on mount and when user changes
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return useMemo(
    () => ({
      tags,
      isLoading,
      error,
      refetch: fetchTags,
      getSuggestions,
    }),
    [tags, isLoading, error, fetchTags, getSuggestions]
  );
}
