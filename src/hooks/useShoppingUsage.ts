/**
 * useShoppingUsage - Hook for managing shopping assistant usage limits
 *
 * Tracks daily usage of the shopping assistant feature and provides
 * helper functions for checking remaining usage and displaying warnings.
 *
 * Usage limits (resets at midnight UTC):
 * - Photo analyses: 20 per day
 * - Text questions: 50 per day
 */

import { useState, useCallback, useMemo } from 'react';
import type { ShoppingUsage } from '@/types/api';

// Constants matching Edge Function limits
export const DAILY_PHOTO_LIMIT = 20;
export const DAILY_TEXT_LIMIT = 50;

// Warning threshold (show warning when remaining <= this number)
export const PHOTO_WARNING_THRESHOLD = 5;
export const TEXT_WARNING_THRESHOLD = 10;

interface UseShoppingUsageReturn {
  /** Current usage state */
  usage: ShoppingUsage;
  /** Update usage from API response */
  updateUsage: (newUsage: Partial<ShoppingUsage>) => void;
  /** Number of photo analyses remaining today */
  photoRemaining: number;
  /** Number of text questions remaining today */
  textRemaining: number;
  /** Whether to show warning for approaching photo limit */
  showPhotoWarning: boolean;
  /** Whether to show warning for approaching text limit */
  showTextWarning: boolean;
  /** Whether photo limit has been reached */
  photoLimitReached: boolean;
  /** Whether text limit has been reached */
  textLimitReached: boolean;
  /** Get warning message for photo usage */
  getPhotoWarningMessage: () => string | null;
  /** Get warning message for text usage */
  getTextWarningMessage: () => string | null;
  /** Reset usage (for testing or when day changes) */
  resetUsage: () => void;
}

/**
 * Hook for managing shopping assistant usage limits
 */
export function useShoppingUsage(): UseShoppingUsageReturn {
  const [usage, setUsage] = useState<ShoppingUsage>({
    photo_count: 0,
    photo_limit: DAILY_PHOTO_LIMIT,
    text_count: 0,
    text_limit: DAILY_TEXT_LIMIT,
  });

  /**
   * Update usage from API response
   */
  const updateUsage = useCallback((newUsage: Partial<ShoppingUsage>) => {
    setUsage((prev) => ({
      ...prev,
      ...newUsage,
    }));
  }, []);

  /**
   * Reset usage to default values
   */
  const resetUsage = useCallback(() => {
    setUsage({
      photo_count: 0,
      photo_limit: DAILY_PHOTO_LIMIT,
      text_count: 0,
      text_limit: DAILY_TEXT_LIMIT,
    });
  }, []);

  /**
   * Calculate remaining photo analyses
   */
  const photoRemaining = useMemo(() => {
    return Math.max(0, usage.photo_limit - usage.photo_count);
  }, [usage.photo_count, usage.photo_limit]);

  /**
   * Calculate remaining text questions
   */
  const textRemaining = useMemo(() => {
    const textCount = usage.text_count ?? 0;
    const textLimit = usage.text_limit ?? DAILY_TEXT_LIMIT;
    return Math.max(0, textLimit - textCount);
  }, [usage.text_count, usage.text_limit]);

  /**
   * Whether to show photo warning (approaching limit)
   */
  const showPhotoWarning = useMemo(() => {
    return photoRemaining > 0 && photoRemaining <= PHOTO_WARNING_THRESHOLD;
  }, [photoRemaining]);

  /**
   * Whether to show text warning (approaching limit)
   */
  const showTextWarning = useMemo(() => {
    return textRemaining > 0 && textRemaining <= TEXT_WARNING_THRESHOLD;
  }, [textRemaining]);

  /**
   * Whether photo limit has been reached
   */
  const photoLimitReached = useMemo(() => {
    return photoRemaining === 0;
  }, [photoRemaining]);

  /**
   * Whether text limit has been reached
   */
  const textLimitReached = useMemo(() => {
    return textRemaining === 0;
  }, [textRemaining]);

  /**
   * Get warning message for photo usage
   */
  const getPhotoWarningMessage = useCallback((): string | null => {
    if (photoLimitReached) {
      return "You've reached today's limit. Try again tomorrow!";
    }
    if (showPhotoWarning) {
      return `${photoRemaining} ${photoRemaining === 1 ? 'analysis' : 'analyses'} remaining today`;
    }
    return null;
  }, [photoRemaining, photoLimitReached, showPhotoWarning]);

  /**
   * Get warning message for text usage
   */
  const getTextWarningMessage = useCallback((): string | null => {
    if (textLimitReached) {
      return "You've reached today's question limit. Try again tomorrow!";
    }
    if (showTextWarning) {
      return `${textRemaining} ${textRemaining === 1 ? 'question' : 'questions'} remaining today`;
    }
    return null;
  }, [textRemaining, textLimitReached, showTextWarning]);

  return {
    usage,
    updateUsage,
    photoRemaining,
    textRemaining,
    showPhotoWarning,
    showTextWarning,
    photoLimitReached,
    textLimitReached,
    getPhotoWarningMessage,
    getTextWarningMessage,
    resetUsage,
  };
}
