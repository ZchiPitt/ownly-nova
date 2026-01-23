/**
 * Hook for fetching and managing categories
 *
 * Provides:
 * - Fetching all categories (system + user)
 * - Creating new user categories
 * - Sorting categories: AI suggestion first, then user categories, then system categories
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Category } from '@/types';
import type { CreateCategoryRequest } from '@/types/api';

interface UseCategoriesResult {
  /** All categories (system + user) */
  categories: Category[];
  /** System categories only */
  systemCategories: Category[];
  /** User categories only */
  userCategories: Category[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Refetch categories */
  refetch: () => Promise<void>;
  /** Create a new user category */
  createCategory: (request: CreateCategoryRequest) => Promise<Category | null>;
  /** Get sorted categories with optional AI suggestion at top */
  getSortedCategories: (aiSuggestion: string | null) => Category[];
}

/**
 * Hook to fetch and manage categories
 */
export function useCategories(): UseCategoriesResult {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all categories
   */
  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all categories the user can see (system + their own)
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_system.eq.true`)
        .order('is_system', { ascending: false }) // System first, then user
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Create a new user category
   */
  const createCategory = useCallback(
    async (request: CreateCategoryRequest): Promise<Category | null> => {
      if (!user) {
        setError('You must be logged in to create a category');
        return null;
      }

      try {
        const insertData = {
          name: request.name,
          icon: request.icon || '📦',
          color: request.color || '#6B7280',
          user_id: user.id,
          is_system: false,
          sort_order: 0,
        };
        // Type assertion needed because Database type definition may not be fully compatible
        // with the Supabase client's generic inference
        const { data, error: createError } = await (supabase
          .from('categories') as ReturnType<typeof supabase.from>)
          .insert(insertData as Record<string, unknown>)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        // Add to local state
        setCategories((prev) => [data, ...prev]);

        return data;
      } catch (err) {
        console.error('Error creating category:', err);
        setError(err instanceof Error ? err.message : 'Failed to create category');
        return null;
      }
    },
    [user]
  );

  /**
   * Get sorted categories with AI suggestion at top
   */
  const getSortedCategories = useCallback(
    (aiSuggestion: string | null): Category[] => {
      if (!aiSuggestion) {
        // Return user categories first, then system categories
        const userCats = categories.filter((c) => !c.is_system);
        const systemCats = categories.filter((c) => c.is_system);
        return [...userCats, ...systemCats];
      }

      // Find the AI-suggested category
      const suggestionLower = aiSuggestion.toLowerCase();
      const suggestedCategory = categories.find(
        (c) => c.name.toLowerCase() === suggestionLower
      );

      if (suggestedCategory) {
        // Put AI suggestion first, then the rest
        const rest = categories.filter((c) => c.id !== suggestedCategory.id);
        const userCats = rest.filter((c) => !c.is_system);
        const systemCats = rest.filter((c) => c.is_system);
        return [suggestedCategory, ...userCats, ...systemCats];
      }

      // AI suggestion doesn't match any category, return sorted normally
      const userCats = categories.filter((c) => !c.is_system);
      const systemCats = categories.filter((c) => c.is_system);
      return [...userCats, ...systemCats];
    },
    [categories]
  );

  // Split into system and user categories
  const systemCategories = useMemo(
    () => categories.filter((c) => c.is_system),
    [categories]
  );

  const userCategories = useMemo(
    () => categories.filter((c) => !c.is_system),
    [categories]
  );

  // Fetch categories on mount and when user changes
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    systemCategories,
    userCategories,
    isLoading,
    error,
    refetch: fetchCategories,
    createCategory,
    getSortedCategories,
  };
}
