/**
 * Search Page - Dedicated search with auto-focus input
 * Features:
 * - Sticky search input bar at top
 * - Back arrow to navigate back
 * - Auto-focused text input
 * - Clear button when has text
 * - Microphone icon (if Speech API supported)
 * - Query preserved in URL: ?q={encoded_query}
 * - Real-time search with 300ms debounce
 * - Highlighted matching text in results
 * - Recent searches with swipe-to-delete and Clear All
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearch } from '@/hooks/useSearch';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { SearchResult, SearchResultSkeleton } from '@/components/SearchResult';

/**
 * Type declarations for Web Speech API (not included in standard TypeScript lib)
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

/**
 * Back arrow icon
 */
function BackIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

/**
 * Search/magnifying glass icon
 */
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

/**
 * Clear/X icon
 */
function ClearIcon() {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

/**
 * Microphone icon
 */
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

/**
 * No results magnifying glass with X
 */
function NoResultsIcon() {
  return (
    <svg
      className="w-16 h-16 text-[#d6ccc2]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.5 8.5l3 3m0-3l-3 3"
      />
    </svg>
  );
}

/**
 * Pulsing microphone for listening state
 */
function PulsingMicIcon() {
  return (
    <div className="relative">
      {/* Pulsing rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-24 h-24 bg-red-500/20 rounded-full animate-ping" />
        <div className="absolute w-20 h-20 bg-red-500/30 rounded-full animate-pulse" />
      </div>
      {/* Microphone icon */}
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
        {/* Red pulsing dot */}
        <div className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-full animate-pulse border-2 border-white" />
      </div>
    </div>
  );
}

/**
 * Voice search listening overlay
 */
interface VoiceSearchOverlayProps {
  isListening: boolean;
  transcript: string;
  onCancel: () => void;
}

function VoiceSearchOverlay({ isListening, transcript, onCancel }: VoiceSearchOverlayProps) {
  if (!isListening) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6"
      onClick={onCancel}
    >
      {/* Pulsing microphone */}
      <div className="mb-8">
        <PulsingMicIcon />
      </div>

      {/* Listening text */}
      <p className="text-xl font-medium text-[#4a3f35] mb-4">
        Listening...
      </p>

      {/* Real-time transcription */}
      <div className="min-h-[48px] w-full max-w-sm">
        {transcript ? (
          <p className="text-lg text-[#6f5f52] text-center px-4 py-2 bg-[#f3ece4] rounded-lg">
            {transcript}
          </p>
        ) : (
          <p className="text-sm text-[#8d7b6d] text-center">
            Speak now...
          </p>
        )}
      </div>

      {/* Cancel hint */}
      <p className="mt-8 text-sm text-[#b9a99b]">
        Tap anywhere to cancel
      </p>
    </div>
  );
}

/**
 * Clock icon for recent searches
 */
function ClockIcon() {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Trash icon for delete buttons
 */
function TrashIcon() {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

/**
 * Recent search item with swipe-to-delete on mobile and hover delete on desktop
 */
interface RecentSearchItemProps {
  query: string;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function RecentSearchItem({ query, onClick, onRemove }: RecentSearchItemProps) {
  const [swiped, setSwiped] = useState(false);
  const [startX, setStartX] = useState(0);
  const [deltaX, setDeltaX] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);

  // Handle touch start for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setDeltaX(0);
  };

  // Handle touch move for swipe
  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;

    // Only allow swiping left (positive diff)
    if (diff > 0) {
      setDeltaX(Math.min(diff, 80)); // Max swipe distance of 80px
    } else {
      setDeltaX(0);
    }
  };

  // Handle touch end for swipe
  const handleTouchEnd = () => {
    // If swiped more than 40px, show delete button
    if (deltaX > 40) {
      setSwiped(true);
    } else {
      setSwiped(false);
    }
    setDeltaX(0);
  };

  // Reset swipe state when clicked elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (itemRef.current && !itemRef.current.contains(e.target as Node)) {
        setSwiped(false);
      }
    };

    if (swiped) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [swiped]);

  return (
    <div ref={itemRef} className="relative overflow-hidden">
      {/* Delete button revealed on swipe (mobile) */}
      <div
        className={`absolute right-0 top-0 bottom-0 flex items-center bg-red-500 transition-all duration-200 ${swiped ? 'w-20' : 'w-0'
          }`}
      >
        <button
          onClick={onRemove}
          className="w-full h-full flex items-center justify-center text-white"
          aria-label="Delete search"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Main content */}
      <div
        onClick={() => !swiped && onClick()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex items-center px-4 py-3 bg-white cursor-pointer hover:bg-[#fdf8f2] transition-all duration-200 group ${swiped ? '-translate-x-20' : deltaX > 0 ? '' : ''
          }`}
        style={{
          transform: deltaX > 0 ? `translateX(-${deltaX}px)` : swiped ? 'translateX(-80px)' : 'translateX(0)',
        }}
      >
        {/* Clock icon */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-[#b9a99b]">
          <ClockIcon />
        </div>

        {/* Query text */}
        <span className="flex-1 text-[#4a3f35] truncate">{query}</span>

        {/* Delete button on hover (desktop) */}
        <button
          onClick={onRemove}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#b9a99b] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50 hidden md:flex"
          aria-label="Remove from recent searches"
        >
          <ClearIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for clearing all recent searches
 */
interface ClearConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ClearConfirmDialog({ isOpen, onConfirm, onCancel }: ClearConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl mx-4 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-[#4a3f35] mb-2">
          Clear all recent searches?
        </h2>
        <p className="text-sm text-[#8d7b6d] mb-6">
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-[#f5ebe0] rounded-lg text-[#6f5f52] font-medium hover:bg-[#fdf8f2] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-500 rounded-lg text-white font-medium hover:bg-red-600 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get initial query from URL
  const initialQuery = searchParams.get('q') || '';
  const shouldAutoStartVoice = searchParams.get('voice') === '1';

  // Recent searches hook
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();

  // Callback to add to recent searches when a successful search completes
  const handleSuccessfulSearch = useCallback((searchQuery: string) => {
    addSearch(searchQuery);
  }, [addSearch]);

  // Use the search hook
  const { results, isLoading, error, query, setQuery, hasSearched } = useSearch({
    debounceMs: 300,
    minQueryLength: 1,
    onSuccessfulSearch: handleSuccessfulSearch,
  });

  // Track speech recognition support
  const [speechSupported] = useState(() => isSpeechRecognitionSupported());

  // Voice search state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const noSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoVoiceStartedRef = useRef(false);

  // State for showing clear all confirmation dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Initialize query from URL on mount
  useEffect(() => {
    if (initialQuery && !query) {
      setQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Update URL when query changes
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query }, { replace: true });
    } else {
      // Remove query param if empty
      setSearchParams({}, { replace: true });
    }
  }, [query, setSearchParams]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleClear = () => {
    setQuery('');
    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

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
  const handleMicrophoneClick = () => {
    // Don't start if already listening
    if (isListening) {
      stopVoiceSearch();
      return;
    }

    // Get the SpeechRecognition constructor
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return;
    }

    // Create new recognition instance
    const recognition = new SpeechRecognitionClass();
    speechRecognitionRef.current = recognition;

    // Configure recognition
    recognition.continuous = false; // Stop after first result
    recognition.interimResults = true; // Get real-time transcription
    recognition.lang = 'en-US'; // Default to English

    // Handle start - listening has begun
    recognition.onstart = () => {
      setIsListening(true);
      setVoiceTranscript('');

      // Set timeout for no speech detected (5 seconds)
      noSpeechTimeoutRef.current = setTimeout(() => {
        stopVoiceSearch();
        // Show toast - using alert as placeholder (Toast component to be implemented in US-083)
        // In production, this would use the Toast component
        alert("Didn't catch that. Please try again.");
      }, 5000);
    };

    // Handle results - real-time transcription
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Clear the no-speech timeout since we got speech
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = null;
      }

      // Get the transcript from the results
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

      // Update the transcript display (prefer final, fallback to interim)
      const currentTranscript = finalTranscript || interimTranscript;
      setVoiceTranscript(currentTranscript);

      // If we have a final result, execute the search
      if (finalTranscript) {
        setQuery(finalTranscript.trim());
        stopVoiceSearch();
      }
    };

    // Handle end - recognition stopped
    recognition.onend = () => {
      // Only stop listening if we haven't already (to avoid double-cleanup)
      if (isListening) {
        setIsListening(false);
      }
    };

    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Clear timeout
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = null;
      }

      // Handle specific errors
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        // Permission denied
        alert('Microphone access required. Please allow microphone access in your browser settings.');
      } else if (event.error === 'no-speech') {
        // No speech detected (handled by our timeout, but browser may also trigger this)
        alert("Didn't catch that. Please try again.");
      } else if (event.error !== 'aborted') {
        // Other errors (not aborted - which is our intentional cancel)
        console.error('Speech recognition error:', event.error);
      }

      stopVoiceSearch();
    };

    // Start listening
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      stopVoiceSearch();
    }
  };

  // Optionally auto-start voice search when navigating with ?voice=1
  useEffect(() => {
    if (!shouldAutoStartVoice || autoVoiceStartedRef.current || !speechSupported) return;
    autoVoiceStartedRef.current = true;

    const timer = setTimeout(() => {
      handleMicrophoneClick();
    }, 150);

    return () => clearTimeout(timer);
  }, [shouldAutoStartVoice, speechSupported, handleMicrophoneClick]);

  /**
   * Cancel voice search when overlay is tapped
   */
  const handleVoiceSearchCancel = () => {
    stopVoiceSearch();
  };

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

  /**
   * Handle tapping a recent search to execute it
   */
  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
    // Focus input after selecting
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  /**
   * Handle removing a recent search
   */
  const handleRemoveRecentSearch = (searchQuery: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the click handler
    removeSearch(searchQuery);
  };

  /**
   * Handle clearing all recent searches
   */
  const handleClearAllClick = () => {
    setShowClearConfirm(true);
  };

  /**
   * Confirm clearing all recent searches
   */
  const confirmClearAll = () => {
    clearAll();
    setShowClearConfirm(false);
  };

  /**
   * Cancel clearing all recent searches
   */
  const cancelClearAll = () => {
    setShowClearConfirm(false);
  };

  // Render search results header
  const renderResultsHeader = () => {
    if (!hasSearched || !query) return null;

    return (
      <div className="px-4 py-2 bg-[#fdf8f2] border-b border-[#f5ebe0]/60">
        <p className="text-sm text-[#8d7b6d]">
          <span className="font-medium">{results.length}</span>
          {' '}result{results.length !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>
    );
  };

  // Render search results or states
  const renderContent = () => {
    // Loading state - show skeleton
    if (isLoading) {
      return (
        <div className="divide-y divide-[#f5ebe0]">
          {Array.from({ length: 5 }).map((_, i) => (
            <SearchResultSkeleton key={i} />
          ))}
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <div className="text-red-500 mb-2">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-[#4a3f35] font-medium mb-1">Search failed</p>
          <p className="text-sm text-[#8d7b6d] text-center mb-4">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={() => setQuery(query)} // Trigger re-search
            className="px-4 py-2 bg-[#e3ead3]0 text-white rounded-lg font-medium hover:bg-[#8d7b6d] transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    // No query entered - show recent searches or placeholder
    if (!query) {
      // Show recent searches if available
      if (recentSearches.length > 0) {
        return (
          <div className="py-4">
            {/* Header with Clear All */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2 text-[#8d7b6d]">
                <ClockIcon />
                <span className="font-medium text-sm">Recent Searches</span>
              </div>
              <button
                onClick={handleClearAllClick}
                className="text-sm text-[#4a3f35] hover:text-[#3d332b] font-medium transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Recent search list */}
            <div className="divide-y divide-[#f5ebe0]">
              {recentSearches.map((searchQuery) => (
                <RecentSearchItem
                  key={searchQuery}
                  query={searchQuery}
                  onClick={() => handleRecentSearchClick(searchQuery)}
                  onRemove={(e) => handleRemoveRecentSearch(searchQuery, e)}
                />
              ))}
            </div>
          </div>
        );
      }

      // No recent searches - show empty state
      return (
        <div className="text-center text-[#8d7b6d] mt-12 px-4">
          <div className="flex justify-center mb-4">
            <ClockIcon />
          </div>
          <p>Your recent searches will appear here</p>
        </div>
      );
    }

    // Has searched but no results
    if (hasSearched && results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <NoResultsIcon />
          <p className="text-[#4a3f35] font-medium mt-4 mb-1">No items found</p>
          <p className="text-sm text-[#8d7b6d] text-center">
            Try different keywords or check your spelling
          </p>
        </div>
      );
    }

    // Has results - show them
    if (results.length > 0) {
      return (
        <>
          {renderResultsHeader()}
          <div className="divide-y divide-[#f5ebe0]">
            {results.map((item) => (
              <SearchResult key={item.id} item={item} query={query} />
            ))}
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-full bg-[#fdf8f2]">
      {/* Sticky search header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="flex-shrink-0 w-10 h-10 -ml-2 flex items-center justify-center text-[#8d7b6d] hover:text-[#4a3f35] transition-colors rounded-full hover:bg-[#f3ece4]"
            aria-label="Go back"
          >
            <BackIcon />
          </button>

          {/* Search input container */}
          <div className="flex-1 relative">
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b9a99b] pointer-events-none">
              <SearchIcon />
            </div>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search items, tags, locations..."
              className="w-full h-10 pl-10 pr-20 bg-[#f3ece4] rounded-full text-[#4a3f35] placeholder-[#b9a99b] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:bg-white transition-colors"
              aria-label="Search items"
            />

            {/* Right side buttons container */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Clear button - shown when query has text */}
              {query && (
                <button
                  onClick={handleClear}
                  className="w-8 h-8 flex items-center justify-center text-[#b9a99b] hover:text-[#8d7b6d] transition-colors rounded-full hover:bg-[#efe6dc]"
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </button>
              )}

              {/* Microphone button - shown if Speech API supported */}
              {speechSupported && (
                <button
                  onClick={handleMicrophoneClick}
                  className="w-8 h-8 flex items-center justify-center text-[#b9a99b] hover:text-[#8d7b6d] transition-colors rounded-full hover:bg-[#efe6dc]"
                  aria-label="Voice search"
                >
                  <MicrophoneIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search content area */}
      <div className="pb-4">
        {renderContent()}
      </div>

      {/* Clear all confirmation dialog */}
      <ClearConfirmDialog
        isOpen={showClearConfirm}
        onConfirm={confirmClearAll}
        onCancel={cancelClearAll}
      />

      {/* Voice search listening overlay */}
      <VoiceSearchOverlay
        isListening={isListening}
        transcript={voiceTranscript}
        onCancel={handleVoiceSearchCancel}
      />
    </div>
  );
}
