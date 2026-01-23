/**
 * Hook for managing PWA install prompt for Android/Chrome
 * US-070: Create install prompt for Android/Chrome
 *
 * Captures the beforeinstallprompt event and provides:
 * - Deferred prompt for triggering native install dialog
 * - Tracking for engagement criteria (pages viewed, time spent)
 * - Dismiss state persisted in localStorage
 * - Detection of already installed state
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Storage keys
const STORAGE_KEY_DISMISS_TIME = 'ownly_install_dismissed_at';
const STORAGE_KEY_PAGES_VIEWED = 'ownly_pages_viewed';
const STORAGE_KEY_FIRST_VISIT = 'ownly_first_visit_at';
const STORAGE_KEY_INSTALLED = 'ownly_app_installed';

// Configuration
const MIN_PAGES_VIEWED = 2;
const MIN_TIME_SPENT_SECONDS = 30;
const DISMISS_COOLDOWN_DAYS = 7;

// Type for the beforeinstallprompt event (not in standard TypeScript DOM types)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Extend Window interface
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export interface UseInstallPromptReturn {
  /** Whether the install prompt is available */
  isPromptAvailable: boolean;
  /** Whether the banner should be shown (meets all criteria) */
  shouldShowBanner: boolean;
  /** Whether the app is already installed */
  isInstalled: boolean;
  /** Whether install is in progress */
  isInstalling: boolean;
  /** Trigger the native install prompt */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Dismiss the banner (stores timestamp for cooldown) */
  dismissBanner: () => void;
  /** Number of pages viewed in this session */
  pagesViewed: number;
  /** Whether enough time has been spent (30s+) */
  hasSpentEnoughTime: boolean;
}

/**
 * Check if running in standalone mode (already installed)
 */
function isRunningStandalone(): boolean {
  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS standalone mode
  if ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return true;
  }

  // Check localStorage flag (set after install)
  if (localStorage.getItem(STORAGE_KEY_INSTALLED) === 'true') {
    return true;
  }

  return false;
}

/**
 * Check if banner was dismissed within cooldown period
 */
function isDismissedRecently(): boolean {
  const dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISS_TIME);
  if (!dismissedAt) return false;

  const dismissedTime = parseInt(dismissedAt, 10);
  const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - dismissedTime < cooldownMs;
}

/**
 * Get or initialize the pages viewed count
 */
function getPagesViewed(): number {
  const count = localStorage.getItem(STORAGE_KEY_PAGES_VIEWED);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Increment and save pages viewed count
 */
function incrementPagesViewed(): number {
  const newCount = getPagesViewed() + 1;
  localStorage.setItem(STORAGE_KEY_PAGES_VIEWED, String(newCount));
  return newCount;
}

/**
 * Get or set first visit timestamp, returns time spent in seconds
 */
function getTimeSpentSeconds(): number {
  let firstVisit = localStorage.getItem(STORAGE_KEY_FIRST_VISIT);

  if (!firstVisit) {
    firstVisit = String(Date.now());
    localStorage.setItem(STORAGE_KEY_FIRST_VISIT, firstVisit);
    return 0;
  }

  return Math.floor((Date.now() - parseInt(firstVisit, 10)) / 1000);
}

export function useInstallPrompt(): UseInstallPromptReturn {
  // Deferred prompt event
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // State
  const [isPromptAvailable, setIsPromptAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(isDismissedRecently);
  const [pagesViewed, setPagesViewed] = useState(getPagesViewed);
  const [hasSpentEnoughTime, setHasSpentEnoughTime] = useState(
    getTimeSpentSeconds() >= MIN_TIME_SPENT_SECONDS
  );

  // Listen for beforeinstallprompt event
  useEffect(() => {
    // Don't capture if already installed
    if (isRunningStandalone()) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();

      // Stash the event for later use
      deferredPromptRef.current = event;
      setIsPromptAvailable(true);
    };

    // Listen for the event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsPromptAvailable(false);
      deferredPromptRef.current = null;
      localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Track page views (increment on mount)
  useEffect(() => {
    const newCount = incrementPagesViewed();
    setPagesViewed(newCount);
  }, []);

  // Track time spent (check periodically)
  useEffect(() => {
    // Initial check
    if (getTimeSpentSeconds() >= MIN_TIME_SPENT_SECONDS) {
      setHasSpentEnoughTime(true);
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
        setIsInstalled(true);
        setIsPromptAvailable(false);
        localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  /**
   * Trigger the native install prompt
   */
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPromptRef.current) {
      return 'unavailable';
    }

    setIsInstalling(true);

    try {
      // Show the install prompt
      await deferredPromptRef.current.prompt();

      // Wait for the user to respond
      const choiceResult = await deferredPromptRef.current.userChoice;

      if (choiceResult.outcome === 'accepted') {
        // User accepted - mark as installed
        setIsInstalled(true);
        setIsPromptAvailable(false);
        localStorage.setItem(STORAGE_KEY_INSTALLED, 'true');
        deferredPromptRef.current = null;
      }

      return choiceResult.outcome;
    } catch (error) {
      console.error('Error prompting install:', error);
      return 'unavailable';
    } finally {
      setIsInstalling(false);
    }
  }, []);

  /**
   * Dismiss the banner and store timestamp
   */
  const dismissBanner = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_DISMISS_TIME, String(Date.now()));
    setIsDismissed(true);
  }, []);

  // Calculate if banner should show
  const shouldShowBanner =
    isPromptAvailable &&
    !isInstalled &&
    !isDismissed &&
    pagesViewed >= MIN_PAGES_VIEWED &&
    hasSpentEnoughTime;

  return {
    isPromptAvailable,
    shouldShowBanner,
    isInstalled,
    isInstalling,
    promptInstall,
    dismissBanner,
    pagesViewed,
    hasSpentEnoughTime,
  };
}
