/**
 * Marketplace Page - Browse community listings
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace, MARKETPLACE_PAGE_SIZE } from '@/hooks/useMarketplace';
import type { MarketplaceListing, MarketplaceFilters, SortOption } from '@/hooks/useMarketplace';
import { MarketplaceCard, MarketplaceCardSkeleton } from '@/components/MarketplaceCard';
import { MarketplaceFilterSheet } from '@/components/MarketplaceFilterSheet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { supabase } from '@/lib/supabase';

/**
 * Type declarations for Web Speech API
 */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Check if the Web Speech API is available
 */
function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const defaultFilters: MarketplaceFilters = {
  categories: [],
  conditions: [],
  priceType: 'all',
  minPrice: null,
  maxPrice: null,
  search: '',
};

const RECENT_SEARCHES_KEY = 'marketplace_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES);
    }
  } catch (error) {
    console.warn('Failed to load marketplace recent searches:', error);
  }

  return [];
}

function persistRecentSearches(searches: string[]) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    console.warn('Failed to save marketplace recent searches:', error);
  }
}

function saveRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return loadRecentSearches();

  const recent = loadRecentSearches();
  const updated = [
    trimmed,
    ...recent.filter((search) => search.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);

  persistRecentSearches(updated);
  return updated;
}

function clearRecentSearches(): void {
  persistRecentSearches([]);
}

function SearchIcon() {
  return (
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
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
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.586L3.293 6.707A1 1 0 013 6V4z"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="w-4 h-4"
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
  );
}

function MicrophoneIcon() {
  return (
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
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function PulsingMicIcon() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-24 h-24 bg-red-500/20 rounded-full animate-ping" />
        <div className="absolute w-20 h-20 bg-red-500/30 rounded-full animate-pulse" />
      </div>
      <div className="relative w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <div className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-full animate-pulse border-2 border-white" />
      </div>
    </div>
  );
}

interface VoiceSearchOverlayProps {
  isListening: boolean;
  transcript: string;
  onCancel: () => void;
}

function VoiceSearchOverlay({ isListening, transcript, onCancel }: VoiceSearchOverlayProps) {
  if (!isListening) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#fdf8f2]/95 backdrop-blur-sm flex flex-col items-center justify-center px-6"
      onClick={onCancel}
    >
      <div className="mb-8">
        <PulsingMicIcon />
      </div>
      <p className="text-xl font-black text-[#4a3f35] mb-4 tracking-tight">
        Listening...
      </p>
      <div className="min-h-[48px] w-full max-w-sm">
        {transcript ? (
          <p className="text-lg text-[#4a3f35] text-center px-4 py-2 bg-white/90 rounded-2xl border border-[#f5ebe0]/60 soft-shadow">
            {transcript}
          </p>
        ) : (
          <p className="text-sm text-[#8d7b6d] text-center uppercase tracking-wider">
            Speak now...
          </p>
        )}
      </div>
      <p className="mt-8 text-xs text-[#b9a99b] uppercase tracking-wider">
        Tap anywhere to cancel
      </p>
    </div>
  );
}

function LoadingMoreSpinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <svg
        className="w-5 h-5 text-[#8d7b6d] animate-spin"
        fill="none"
        viewBox="0 0 24 24"
      >
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
      <span className="ml-2 text-sm text-[#8d7b6d]">Loading more...</span>
    </div>
  );
}

function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/75 rounded-[2rem] border border-[#f5ebe0]/60 soft-shadow max-w-2xl mx-auto">
      <div className="w-16 h-16 bg-[#f3ece4] rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-[#b9a99b]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-black text-[#4a3f35]">No listings found</h2>
      <p className="text-sm text-[#8d7b6d] text-center mt-1">
        Try adjusting your filters or search.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-4 px-4 py-2 bg-[#f3ece4] text-[#6f5f52] text-sm font-semibold rounded-xl hover:bg-[#eadfd4] transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getListings } = useMarketplace();

  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [sort, setSort] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Voice search state
  const [speechSupported] = useState(() => isSpeechRecognitionSupported());
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const noSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    setFilters((prev) => {
      if (prev.search === debouncedSearch) return prev;
      return { ...prev, search: debouncedSearch };
    });
  }, [debouncedSearch]);

  useEffect(() => {
    if (!debouncedSearch) return;
    const updated = saveRecentSearch(debouncedSearch);
    setRecentSearches(updated);
  }, [debouncedSearch]);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileId = async () => {
      if (!user) {
        if (isMounted) {
          setProfileId(null);
          setIsProfileLoading(false);
        }
        return;
      }

      setIsProfileLoading(true);

      const { data, error: fetchError } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!isMounted) return;

      if (fetchError) {
        console.error('Failed to fetch profile id:', fetchError);
        setProfileId(null);
      } else {
        setProfileId(data?.id ?? null);
      }

      setIsProfileLoading(false);
    };

    fetchProfileId();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const fetchListings = useCallback(async ({
    pageToLoad,
    append,
    isRefresh,
  }: {
    pageToLoad: number;
    append: boolean;
    isRefresh?: boolean;
  }) => {
    if (isRefresh) {
      setIsLoading(false);
    } else if (pageToLoad === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setError(null);

    try {
      const { listings: nextListings, hasMore: nextHasMore } = await getListings({
        filters,
        sort,
        page: pageToLoad,
        pageSize: MARKETPLACE_PAGE_SIZE,
        // Show all listings including user's own
      });

      setListings((prev) => (append ? [...prev, ...nextListings] : nextListings));
      setHasMore(nextHasMore);
      setPage(pageToLoad);
    } catch (err) {
      console.error('Error fetching marketplace listings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters, sort, getListings, profileId]);

  useEffect(() => {
    if (user && isProfileLoading) return;
    fetchListings({ pageToLoad: 0, append: false });
  }, [fetchListings, isProfileLoading, user]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    fetchListings({ pageToLoad: nextPage, append: true });
  }, [fetchListings, hasMore, isLoading, isLoadingMore, page]);

  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore) return;
    const triggerElement = loadMoreTriggerRef.current;
    if (!triggerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(triggerElement);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, isLoading, isLoadingMore]);

  const handleRefresh = useCallback(async () => {
    await fetchListings({ pageToLoad: 0, append: false, isRefresh: true });
  }, [fetchListings]);

  const {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold,
  } = usePullToRefresh({ onRefresh: handleRefresh });

  const handleApplyFilters = useCallback((nextFilters: MarketplaceFilters) => {
    setFilters(nextFilters);
  }, []);

  const handleClearSheetFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      categories: [],
      conditions: [],
      priceType: 'all',
      minPrice: null,
      maxPrice: null,
    }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilters(defaultFilters);
  }, []);

  /**
   * Stop voice search and clean up
   */
  const stopVoiceSearch = useCallback(() => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.abort();
      speechRecognitionRef.current = null;
    }
    if (noSpeechTimeoutRef.current) {
      clearTimeout(noSpeechTimeoutRef.current);
      noSpeechTimeoutRef.current = null;
    }
    setIsListening(false);
    setVoiceTranscript('');
  }, []);

  /**
   * Handle voice search via Web Speech API
   */
  const handleMicrophoneClick = useCallback(() => {
    if (isListening) {
      stopVoiceSearch();
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return;
    }

    const recognition = new SpeechRecognitionClass();
    speechRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceTranscript('');

      noSpeechTimeoutRef.current = setTimeout(() => {
        stopVoiceSearch();
        alert("Didn't catch that. Please try again.");
      }, 5000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = null;
      }

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setVoiceTranscript(currentTranscript);

      if (finalTranscript) {
        setSearchQuery(finalTranscript.trim());
        stopVoiceSearch();
      }
    };

    recognition.onend = () => {
      if (isListening) {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = null;
      }

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        alert('Microphone access required. Please allow microphone access in your browser settings.');
      } else if (event.error === 'no-speech') {
        alert("Didn't catch that. Please try again.");
      } else if (event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }

      stopVoiceSearch();
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      stopVoiceSearch();
    }
  }, [isListening, stopVoiceSearch]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
      }
    };
  }, []);

  const hasSearchQuery = debouncedSearch.trim().length > 0;
  const showRecentSearches = isSearchFocused && searchQuery.trim().length === 0 && recentSearches.length > 0;

  return (
    <div className="min-h-full bg-[#fdf8f2] pb-20">
      <div className="sticky top-0 z-10 glass border-b border-[#f5ebe0]/40 px-4 py-4">
        <div className="relative max-w-5xl mx-auto">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b9a99b]">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search marketplace..."
            className="w-full pl-10 pr-20 py-2.5 text-sm border border-[#f5ebe0]/60 bg-white/85 text-[#4a3f35] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] soft-shadow"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-7 h-7 flex items-center justify-center text-[#b9a99b] hover:text-[#4a3f35] rounded-full hover:bg-[#f3ece4]"
                aria-label="Clear search"
              >
                <ClearIcon />
              </button>
            )}
            {speechSupported && (
              <button
                type="button"
                onClick={handleMicrophoneClick}
                className="w-7 h-7 flex items-center justify-center text-[#b9a99b] hover:text-[#4a3f35] rounded-full hover:bg-[#e3ead3]"
                aria-label="Voice search"
              >
                <MicrophoneIcon />
              </button>
            )}
          </div>
          {showRecentSearches && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-[#f5ebe0]/60 bg-white/95 soft-shadow z-20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#f5ebe0]/50 bg-[#fdf8f2]">
                <span className="text-[11px] font-black text-[#8d7b6d] uppercase tracking-wide">
                  Recent searches
                </span>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-xs font-semibold text-[#8d7b6d] hover:text-[#4a3f35]"
                >
                  Clear all
                </button>
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {recentSearches.map((search) => (
                  <li key={search}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchQuery(search);
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#6f5f52] hover:bg-[#fdf8f2]"
                    >
                      <span className="text-[#b9a99b]">🕘</span>
                      <span className="truncate">{search}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#6f5f52] bg-[#f3ece4] rounded-xl hover:bg-[#eadfd4] transition-colors"
          >
            <FilterIcon />
            Filters
          </button>

          <div className="flex items-center gap-2">
            <label htmlFor="marketplace-sort" className="text-xs text-[#8d7b6d]">
              Sort
            </label>
            <select
              id="marketplace-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="text-sm border border-[#f5ebe0]/60 bg-white/90 text-[#4a3f35] rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#d6ccc2]"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price Low-High</option>
              <option value="price_desc">Price High-Low</option>
            </select>
          </div>
        </div>
      </div>

      <div
        className="relative px-4 py-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={threshold}
          isPulling={isPulling}
          isRefreshing={isRefreshing}
        />

        {isLoading && listings.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {Array.from({ length: 8 }).map((_, index) => (
              <MarketplaceCardSkeleton key={index} />
            ))}
          </div>
        ) : error && listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/75 rounded-[2rem] border border-[#f5ebe0]/60 soft-shadow max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-[#f8e1d7] rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-[#a04d2b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-black text-[#4a3f35] mb-1">
              Couldn't load listings
            </h3>
            <p className="text-sm text-[#8d7b6d] text-center mb-4">{error}</p>
            <button
              type="button"
              onClick={() => handleRefresh()}
              className="px-4 py-2 bg-[#f3ece4] text-[#6f5f52] text-sm font-semibold rounded-xl hover:bg-[#eadfd4] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : listings.length === 0 ? (
          hasSearchQuery ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/75 rounded-[2rem] border border-[#f5ebe0]/60 soft-shadow max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-[#f3ece4] rounded-full flex items-center justify-center mb-4 text-[#b9a99b]">
                <SearchIcon />
              </div>
              <h2 className="text-lg font-black text-[#4a3f35]">
                No items found for '{debouncedSearch}'
              </h2>
              <p className="text-sm text-[#8d7b6d] text-center mt-1">
                Try a different search term or clear your filters.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-[#f3ece4] text-[#6f5f52] text-sm font-semibold rounded-xl hover:bg-[#eadfd4] transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <EmptyState onClearFilters={handleClearAllFilters} />
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {listings.map((listing) => (
                <MarketplaceCard
                  key={listing.id}
                  listing={listing}
                  onClick={() => navigate(`/marketplace/${listing.id}`)}
                />
              ))}
            </div>

            <div ref={loadMoreTriggerRef} className="h-px" />
            {isLoadingMore && <LoadingMoreSpinner />}
          </div>
        )}
      </div>

      <MarketplaceFilterSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearSheetFilters}
      />

      <VoiceSearchOverlay
        isListening={isListening}
        transcript={voiceTranscript}
        onCancel={stopVoiceSearch}
      />
    </div>
  );
}
