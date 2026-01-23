/**
 * Hook for managing PWA install instructions for iOS Safari
 * US-071: Create install instructions for iOS Safari
 *
 * Provides:
 * - iOS Safari detection via user agent
 * - Engagement tracking (pages viewed, time spent) - shared with useInstallPrompt
 * - Dismiss state persisted in localStorage (30-day cooldown)
 * - Standalone mode detection to hide when already installed
 *
 * Note: Page view and time tracking are shared with the Android install hook.
 * Both hooks read from the same localStorage keys.
 */

import { useState, useEffect, useCallback } from 'react';

// Storage keys - shared with useInstallPrompt for consistent tracking
const STORAGE_KEY_IOS_DISMISS_TIME = 'ownly_ios_install_dismissed_at';
const STORAGE_KEY_PAGES_VIEWED = 'ownly_pages_viewed';
const STORAGE_KEY_FIRST_VISIT = 'ownly_first_visit_at';

// Configuration
const MIN_PAGES_VIEWED = 2;
const MIN_TIME_SPENT_SECONDS = 30;
const DISMISS_COOLDOWN_DAYS = 30; // iOS uses 30-day cooldown per AC

export interface UseIOSInstallPromptReturn {
  /** Whether the device is iOS Safari (eligible for instructions) */
  isIOSSafari: boolean;
  /** Whether the banner should be shown (meets all criteria) */
  shouldShowBanner: boolean;
  /** Whether the app is running in standalone mode (installed) */
  isStandalone: boolean;
  /** Dismiss the banner (stores timestamp for 30-day cooldown) */
  dismissBanner: () => void;
  /** Number of pages viewed in this session */
  pagesViewed: number;
  /** Whether enough time has been spent (30s+) */
  hasSpentEnoughTime: boolean;
}

/**
 * Detect if running on iOS device
 */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent;

  // Check for iPhone, iPad, iPod
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return true;
  }

  // Check for iPad on iOS 13+ (reports as Mac with touchscreen)
  if (
    /Macintosh/.test(userAgent) &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }

  return false;
}

/**
 * Detect if running in Safari browser (not Chrome, Firefox, etc. on iOS)
 */
function isSafariBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent;

  // Safari includes "Safari" but not "CriOS" (Chrome) or "FxiOS" (Firefox) or "EdgiOS" (Edge)
  const isSafari = /Safari/.test(userAgent);
  const isChrome = /CriOS/.test(userAgent);
  const isFirefox = /FxiOS/.test(userAgent);
  const isEdge = /EdgiOS/.test(userAgent);
  const isOpera = /OPT/.test(userAgent);

  return isSafari && !isChrome && !isFirefox && !isEdge && !isOpera;
}

/**
 * Check if running in standalone mode (PWA already installed)
 */
function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS standalone property (Safari-specific)
  if ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }

  return false;
}

/**
 * Check if this is iOS Safari (combined check for initial state)
 */
function getInitialIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  return isIOS() && isSafariBrowser() && !isRunningStandalone();
}

/**
 * Check if banner was dismissed within cooldown period (30 days for iOS)
 */
function isDismissedRecently(): boolean {
  if (typeof localStorage === 'undefined') return false;

  const dismissedAt = localStorage.getItem(STORAGE_KEY_IOS_DISMISS_TIME);
  if (!dismissedAt) return false;

  const dismissedTime = parseInt(dismissedAt, 10);
  const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - dismissedTime < cooldownMs;
}

/**
 * Get pages viewed count (shared with Android install hook)
 */
function getPagesViewed(): number {
  if (typeof localStorage === 'undefined') return 0;
  const count = localStorage.getItem(STORAGE_KEY_PAGES_VIEWED);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Get or set first visit timestamp, returns time spent in seconds
 */
function getTimeSpentSeconds(): number {
  if (typeof localStorage === 'undefined') return 0;

  let firstVisit = localStorage.getItem(STORAGE_KEY_FIRST_VISIT);

  if (!firstVisit) {
    firstVisit = String(Date.now());
    localStorage.setItem(STORAGE_KEY_FIRST_VISIT, firstVisit);
    return 0;
  }

  return Math.floor((Date.now() - parseInt(firstVisit, 10)) / 1000);
}

export function useIOSInstallPrompt(): UseIOSInstallPromptReturn {
  // Platform detection - use lazy initializers
  const [isIOSSafari] = useState(getInitialIOSSafari);
  const [isStandalone, setIsStandalone] = useState(isRunningStandalone);

  // State - use lazy initializers for functions
  // Note: Page increment is handled by useInstallPrompt hook which also runs
  // We just read the shared localStorage values
  const [isDismissed, setIsDismissed] = useState(isDismissedRecently);
  const [pagesViewed, setPagesViewed] = useState(getPagesViewed);
  const [hasSpentEnoughTime, setHasSpentEnoughTime] = useState(
    () => getTimeSpentSeconds() >= MIN_TIME_SPENT_SECONDS
  );

  // Sync pagesViewed with localStorage changes (in case useInstallPrompt incremented)
  useEffect(() => {
    const checkPagesViewed = () => {
      const current = getPagesViewed();
      setPagesViewed(current);
    };

    // Check immediately
    checkPagesViewed();

    // Also check on storage events (for cross-tab sync)
    window.addEventListener('storage', checkPagesViewed);

    return () => {
      window.removeEventListener('storage', checkPagesViewed);
    };
  }, []);

  // Track time spent (check periodically)
  useEffect(() => {
    // Skip if already met criteria
    if (getTimeSpentSeconds() >= MIN_TIME_SPENT_SECONDS) {
      return;
    }

    // Check every second until criteria is met
    const interval = setInterval(() => {
      if (getTimeSpentSeconds() >= MIN_TIME_SPENT_SECONDS) {
        setHasSpentEnoughTime(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if display mode changes (user installs via browser UI)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  /**
   * Dismiss the banner and store timestamp (30-day cooldown)
   */
  const dismissBanner = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_IOS_DISMISS_TIME, String(Date.now()));
    setIsDismissed(true);
  }, []);

  // Calculate if banner should show
  const shouldShowBanner =
    isIOSSafari &&
    !isStandalone &&
    !isDismissed &&
    pagesViewed >= MIN_PAGES_VIEWED &&
    hasSpentEnoughTime;

  return {
    isIOSSafari,
    shouldShowBanner,
    isStandalone,
    dismissBanner,
    pagesViewed,
    hasSpentEnoughTime,
  };
}
