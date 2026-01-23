/**
 * Hook for searching inventory items with debouncing and highlighting
 * Features:
 * - 300ms debounce on search input
 * - Search across: name, description, tags, category.name, location.path, brand
 * - Returns results with matched fields for highlighting
 * - Aborts previous requests when new search initiated
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  generateQueryEmbedding,
  searchItemsByEmbedding,
  type SemanticSearchResult,
} from '@/lib/embeddingUtils';

/**
 * Search result item with category and location info
 */
export interface SearchResultItem {
  id: string;
  name: string | null;
  description: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  tags: string[];
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  location_id: string | null;
  location_name: string | null;
  location_path: string | null;
  similarity?: number; // Semantic search similarity score (0-1)
  matchType?: 'text' | 'semantic' | 'both'; // How the item was matched
}

/**
 * Raw item type from Supabase query
 */
interface RawSearchItem {
  id: string;
  name: string | null;
  description: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  tags: string[];
  brand: string | null;
  category_id: string | null;
  location_id: string | null;
  categories: {
    name: string;
    color: string;
    icon: string;
  } | null;
  locations: {
    name: string;
    path: string;
  } | null;
}

/**
 * Transform raw Supabase data to SearchResultItem format
 */
function transformRawItem(item: RawSearchItem): SearchResultItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    photo_url: item.photo_url,
    thumbnail_url: item.thumbnail_url,
    tags: item.tags || [],
    brand: item.brand,
    category_id: item.category_id,
    category_name: item.categories?.name || null,
    category_color: item.categories?.color || null,
    category_icon: item.categories?.icon || null,
    location_id: item.location_id,
    location_name: item.locations?.name || null,
    location_path: item.locations?.path || null,
  };
}

interface UseSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  onSuccessfulSearch?: (query: string) => void;
}

interface UseSearchResult {
  results: SearchResultItem[];
  isLoading: boolean;
  error: string | null;
  query: string;
  setQuery: (query: string) => void;
  hasSearched: boolean;
}

/**
 * Custom hook for searching inventory items
 * @param options - Search configuration options
 * @returns Search state and control functions
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { debounceMs = 300, minQueryLength = 1, onSuccessfulSearch } = options;
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // AbortController reference for cancelling previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  /**
   * Common stop words to filter out from search queries
   * These words are too common to be meaningful in search
   */
  const STOP_WORDS = new Set([
    // English
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which',
    'who', 'whom', 'where', 'when', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'also', 'now', 'here', 'there', 'then', 'if', 'about', 'after', 'before',
    'search', 'find', 'look', 'looking', 'show', 'get', 'need', 'want',
    // Chinese common words
    '的', '是', '在', '了', '和', '与', '或', '这', '那', '个', '一',
    '有', '我', '你', '他', '她', '它', '们', '什么', '哪', '哪里',
    '怎么', '为什么', '找', '搜索', '查找', '看看', '给我',
  ]);

  /**
   * Split search query into meaningful words
   * Filters out stop words and short words
   */
  const splitSearchQuery = useCallback((query: string): string[] => {
    // Split by whitespace and common punctuation
    const words = query
      .toLowerCase()
      .split(/[\s,;.!?，。！？、；：]+/)
      .map((word) => word.trim())
      .filter((word) => {
        // Keep words that are:
        // - At least 2 characters (or 1 Chinese character)
        // - Not in stop words list
        const isChinese = /[\u4e00-\u9fa5]/.test(word);
        const minLength = isChinese ? 1 : 2;
        return word.length >= minLength && !STOP_WORDS.has(word);
      });

    // Remove duplicates
    return [...new Set(words)];
  }, []);

  /**
   * Build OR condition for multiple words
   * Each word can match name, description, brand, or tags
   */
  const buildMultiWordOrCondition = useCallback((words: string[]): string => {
    if (words.length === 0) return '';

    const conditions: string[] = [];

    for (const word of words) {
      const term = `%${word}%`;
      conditions.push(
        `name.ilike.${term}`,
        `description.ilike.${term}`,
        `brand.ilike.${term}`,
        `tags.cs.{${word}}`
      );
    }

    return conditions.join(',');
  }, []);

  /**
   * Perform text-based search (ILIKE matching)
   * Supports multi-word queries - matches if ANY word matches
   */
  const performTextSearch = useCallback(
    async (searchQuery: string, signal: AbortSignal): Promise<RawSearchItem[]> => {
      if (!user) return [];

      // Split query into meaningful words
      const words = splitSearchQuery(searchQuery);

      // If no meaningful words after filtering, use original query
      const searchTerms = words.length > 0 ? words : [searchQuery.toLowerCase().trim()];

      // Build OR condition for all words
      const orCondition = buildMultiWordOrCondition(searchTerms);

      if (!orCondition) return [];

      // Main text search
      const { data, error: searchError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          description,
          photo_url,
          thumbnail_url,
          tags,
          brand,
          category_id,
          location_id,
          categories (
            name,
            color,
            icon
          ),
          locations (
            name,
            path
          )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(orCondition)
        .order('updated_at', { ascending: false })
        .limit(50)
        .abortSignal(signal)
        .returns<RawSearchItem[]>();

      if (searchError && !searchError.message?.includes('abort')) {
        throw searchError;
      }

      // Category name search - match any word
      const categoryOrConditions = searchTerms.map((word) => `name.ilike.%${word}%`).join(',');

      const { data: categoryMatchData, error: categoryError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          description,
          photo_url,
          thumbnail_url,
          tags,
          brand,
          category_id,
          location_id,
          categories!inner (
            name,
            color,
            icon
          ),
          locations (
            name,
            path
          )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(categoryOrConditions, { referencedTable: 'categories' })
        .order('updated_at', { ascending: false })
        .limit(50)
        .abortSignal(signal)
        .returns<RawSearchItem[]>();

      if (categoryError && !categoryError.message?.includes('abort')) {
        console.warn('Category search failed:', categoryError);
      }

      // Location path search - match any word
      const locationOrConditions = searchTerms.map((word) => `path.ilike.%${word}%`).join(',');

      const { data: locationMatchData, error: locationError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          description,
          photo_url,
          thumbnail_url,
          tags,
          brand,
          category_id,
          location_id,
          categories (
            name,
            color,
            icon
          ),
          locations!inner (
            name,
            path
          )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(locationOrConditions, { referencedTable: 'locations' })
        .order('updated_at', { ascending: false })
        .limit(50)
        .abortSignal(signal)
        .returns<RawSearchItem[]>();

      if (locationError && !locationError.message?.includes('abort')) {
        console.warn('Location search failed:', locationError);
      }

      return [...(data || []), ...(categoryMatchData || []), ...(locationMatchData || [])];
    },
    [user, splitSearchQuery, buildMultiWordOrCondition]
  );

  /**
   * Perform semantic search using embeddings
   */
  const performSemanticSearch = useCallback(
    async (searchQuery: string): Promise<SemanticSearchResult[]> => {
      // Only do semantic search for queries >= 2 chars
      if (searchQuery.length < 2) return [];

      try {
        // Generate embedding for the search query
        const embedding = await generateQueryEmbedding(searchQuery);
        if (!embedding) {
          console.warn('Failed to generate query embedding');
          return [];
        }

        // Search by embedding similarity
        const results = await searchItemsByEmbedding(embedding, 0.5, 30);
        return results;
      } catch (error) {
        console.warn('Semantic search failed:', error);
        return [];
      }
    },
    []
  );

  /**
   * Fetch full item details for semantic search results
   */
  const enrichSemanticResults = useCallback(
    async (
      semanticResults: SemanticSearchResult[],
      signal: AbortSignal
    ): Promise<Map<string, { raw: RawSearchItem; similarity: number }>> => {
      if (semanticResults.length === 0 || !user) {
        return new Map();
      }

      const ids = semanticResults.map((r) => r.id);
      const similarityMap = new Map(semanticResults.map((r) => [r.id, r.similarity]));

      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          description,
          photo_url,
          thumbnail_url,
          tags,
          brand,
          category_id,
          location_id,
          categories (
            name,
            color,
            icon
          ),
          locations (
            name,
            path
          )
        `)
        .in('id', ids)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .abortSignal(signal)
        .returns<RawSearchItem[]>();

      if (error && !error.message?.includes('abort')) {
        console.warn('Failed to enrich semantic results:', error);
        return new Map();
      }

      const resultMap = new Map<string, { raw: RawSearchItem; similarity: number }>();
      for (const item of data || []) {
        resultMap.set(item.id, {
          raw: item,
          similarity: similarityMap.get(item.id) || 0,
        });
      }

      return resultMap;
    },
    [user]
  );

  /**
   * Perform the search query against the database
   * Combines text search (ILIKE) and semantic search (embeddings)
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!user) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Validate minimum query length
    if (searchQuery.length < minQueryLength) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Run text search and semantic search in parallel
      const [textResults, semanticResults] = await Promise.all([
        performTextSearch(searchQuery, signal),
        performSemanticSearch(searchQuery),
      ]);

      // Check if aborted
      if (signal.aborted) return;

      // Enrich semantic results with full item data
      const enrichedSemanticResults = await enrichSemanticResults(semanticResults, signal);

      // Check if aborted
      if (signal.aborted) return;

      // Combine and deduplicate results
      const combinedResults: SearchResultItem[] = [];
      const seenIds = new Set<string>();

      // First, add text matches (they take priority)
      for (const item of textResults) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          const semanticMatch = enrichedSemanticResults.get(item.id);
          combinedResults.push({
            ...transformRawItem(item),
            similarity: semanticMatch?.similarity,
            matchType: semanticMatch ? 'both' : 'text',
          });
        }
      }

      // Then, add semantic-only matches (not found by text search)
      for (const [id, { raw, similarity }] of enrichedSemanticResults) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          combinedResults.push({
            ...transformRawItem(raw),
            similarity,
            matchType: 'semantic',
          });
        }
      }

      // Sort: text matches first, then by similarity for semantic-only matches
      combinedResults.sort((a, b) => {
        // Both matches and text matches come first
        if (a.matchType !== 'semantic' && b.matchType === 'semantic') return -1;
        if (a.matchType === 'semantic' && b.matchType !== 'semantic') return 1;
        // For semantic-only matches, sort by similarity
        if (a.matchType === 'semantic' && b.matchType === 'semantic') {
          return (b.similarity || 0) - (a.similarity || 0);
        }
        return 0;
      });

      setResults(combinedResults);

      // Call onSuccessfulSearch callback when we have results
      if (combinedResults.length > 0 && searchQuery.length >= 2 && onSuccessfulSearch) {
        onSuccessfulSearch(searchQuery);
      }
    } catch (err) {
      // Don't set error if request was aborted
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('abort'))) {
        return;
      }
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, minQueryLength, onSuccessfulSearch, performTextSearch, performSemanticSearch, enrichSemanticResults]);

  // Trigger search when debounced query changes
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    isLoading,
    error,
    query,
    setQuery,
    hasSearched,
  };
}
