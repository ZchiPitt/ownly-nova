/**
 * Shopping Page - Smart Shopping Assistant
 * Route: /shopping
 *
 * Features:
 * - Initial state with shopping bag icon and helper text
 * - Take Photo and Choose from Gallery buttons
 * - Recent shopping queries section (last 3)
 * - Chat interface after photo capture (US-074)
 * - AI-powered analysis of items for shopping advice (US-076)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Toast } from '@/components/Toast';
import { validateImage, compressImage, uploadToStorage } from '@/lib/imageUtils';
import { useAuth } from '@/hooks/useAuth';
import { useOffline } from '@/hooks/useOffline';
import { useShoppingUsage } from '@/hooks/useShoppingUsage';
import { supabase } from '@/lib/supabase';
import type {
  ShoppingAnalyzeResponse,
  ShoppingFollowupResponse,
  ShoppingConversationMessage,
  SimilarItem,
  DetectedItem,
} from '@/types/api';

// Storage key for recent shopping queries
const RECENT_QUERIES_KEY = 'ownly_shopping_queries';
const MAX_RECENT_QUERIES = 3;

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// Recent shopping query saved to localStorage
interface RecentQuery {
  id: string;
  thumbnailUrl: string;
  itemName: string;
  timestamp: number;
}

// Chat message types
type MessageType = 'text' | 'image' | 'analysis';

interface AnalysisData {
  detected_item: DetectedItem | null;
  similar_items: SimilarItem[];
  advice: string | null;
  usage?: {
    photo_count: number;
    photo_limit: number;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: MessageType;
  content: string; // For text messages
  imageUrl?: string; // For image messages
  analysisData?: AnalysisData; // For analysis messages
  timestamp: number;
}

// View states for the page
type ViewState = 'initial' | 'chat';

/**
 * Load recent shopping queries from localStorage
 */
function loadRecentQueries(): RecentQuery[] {
  try {
    const stored = localStorage.getItem(RECENT_QUERIES_KEY);
    if (!stored) return [];
    const queries = JSON.parse(stored) as RecentQuery[];
    // Filter out old queries (older than 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return queries.filter((q) => q.timestamp > thirtyDaysAgo).slice(0, MAX_RECENT_QUERIES);
  } catch {
    return [];
  }
}

/**
 * Get relative time string from timestamp
 */
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Format timestamp for message groups
 */
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return time;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${dateStr}, ${time}`;
}

/**
 * Generate a unique ID for messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if two timestamps are within the same time group (5 minutes)
 */
function isSameTimeGroup(t1: number, t2: number): boolean {
  return Math.abs(t1 - t2) < 5 * 60 * 1000;
}

export function ShoppingPage() {
  // References
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const chatCameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [viewState, setViewState] = useState<ViewState>('initial');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SimilarItem | null>(null);

  // Get auth session and offline status
  const { session } = useAuth();
  const { requireOnline } = useOffline();

  // Shopping usage tracking for limits
  const {
    updateUsage,
    showPhotoWarning,
    showTextWarning,
    photoLimitReached,
    textLimitReached,
    getPhotoWarningMessage,
    getTextWarningMessage,
  } = useShoppingUsage();

  // URL search params for initial query
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryProcessed = useRef(false);

  // Load recent queries on mount
  useEffect(() => {
    setRecentQueries(loadRecentQueries());
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  /**
   * Add a message to the chat
   */
  const addMessage = useCallback((
    role: 'user' | 'assistant',
    type: MessageType,
    content: string,
    imageUrl?: string
  ) => {
    const newMessage: ChatMessage = {
      id: generateId(),
      role,
      type,
      content,
      imageUrl,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  /**
   * Save a query to recent searches
   */
  const saveRecentQuery = useCallback((thumbnailUrl: string, itemName: string) => {
    try {
      const queries = loadRecentQueries();
      const newQuery: RecentQuery = {
        id: generateId(),
        thumbnailUrl,
        itemName,
        timestamp: Date.now(),
      };

      // Add to front and limit to max
      const updated = [newQuery, ...queries.filter(q => q.thumbnailUrl !== thumbnailUrl)]
        .slice(0, MAX_RECENT_QUERIES);

      localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(updated));
      setRecentQueries(updated);
    } catch {
      // Silently fail on localStorage errors
    }
  }, []);

  /**
   * Call the shopping-analyze Edge Function
   */
  const analyzeShoppingImage = useCallback(async (imageUrl: string) => {
    setIsTyping(true);

    try {
      // Check online status
      if (!requireOnline('analyze')) {
        addMessage(
          'assistant',
          'text',
          "I can't analyze this image while you're offline. Please check your connection and try again."
        );
        setIsTyping(false);
        return;
      }

      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        addMessage(
          'assistant',
          'text',
          'Please sign in to use the shopping assistant.'
        );
        setIsTyping(false);
        return;
      }

      // Call the Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/shopping-analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 429) {
          const details = data.error?.details as { photo_count?: number; photo_limit?: number } | undefined;
          // Update usage state to reflect limit reached
          if (details) {
            updateUsage({
              photo_count: details.photo_count ?? 20,
              photo_limit: details.photo_limit ?? 20,
            });
          }
          addMessage(
            'assistant',
            'text',
            `You've used ${details?.photo_count ?? 'all'} of your ${details?.photo_limit ?? 20} daily analyses. Try again tomorrow!`
          );
        } else if (response.status === 401) {
          addMessage(
            'assistant',
            'text',
            'Your session has expired. Please sign in again.'
          );
        } else {
          addMessage(
            'assistant',
            'text',
            data.error?.message || 'Something went wrong. Please try again.'
          );
        }
        setIsTyping(false);
        return;
      }

      // Successfully received analysis
      const analysisResponse = data as ShoppingAnalyzeResponse;

      // Update usage state from response
      if (analysisResponse.usage) {
        updateUsage({
          photo_count: analysisResponse.usage.photo_count,
          photo_limit: analysisResponse.usage.photo_limit,
        });
      }

      // Create analysis message
      const newMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        type: 'analysis',
        content: analysisResponse.advice || "I've analyzed your photo.",
        analysisData: {
          detected_item: analysisResponse.detected_item,
          similar_items: analysisResponse.similar_items,
          advice: analysisResponse.advice,
          usage: (data as { usage?: { photo_count: number; photo_limit: number } }).usage,
        },
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);

      // Save to recent queries if we detected an item
      if (analysisResponse.detected_item) {
        saveRecentQuery(
          imageUrl,
          analysisResponse.detected_item.name
        );
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
      addMessage(
        'assistant',
        'text',
        'Sorry, I had trouble analyzing that image. Please try again.'
      );
    } finally {
      setIsTyping(false);
    }
  }, [addMessage, requireOnline, saveRecentQuery, updateUsage]);

  /**
   * Handle file selection from camera or gallery (initial state)
   */
  const handleFileSelect = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check online status before starting
    if (!requireOnline('analyze')) {
      setToast({
        message: "You're offline. Connect to analyze images.",
        type: 'warning',
      });
      event.target.value = '';
      return;
    }

    setIsProcessing(true);

    try {
      // Validate the selected image
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const validation = await validateImage(file, authSession?.access_token);

      if (!validation.valid) {
        setToast({
          message: validation.error || 'Invalid image',
          type: 'error',
        });
        return;
      }

      // Compress the image for display
      const compressedBlob = await compressImage(file);
      const localImageUrl = URL.createObjectURL(compressedBlob);

      // Transition to chat view
      setViewState('chat');

      // Add user's image as first message (with local URL for display)
      addMessage('user', 'image', 'Photo uploaded', localImageUrl);

      // Upload to Supabase storage for AI analysis
      if (!session?.user?.id) {
        addMessage('assistant', 'text', 'Please sign in to use the shopping assistant.');
        return;
      }

      // Generate unique filename for shopping photo
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `shopping-${timestamp}-${random}.jpg`;

      const uploadResult = await uploadToStorage(
        compressedBlob,
        session.user.id,
        filename
      );

      // Call AI analysis with the uploaded URL
      await analyzeShoppingImage(uploadResult.url);

    } catch (error) {
      console.error('Error processing image:', error);
      setToast({
        message: 'Failed to process image. Please try again.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
      // Reset input value to allow selecting the same file again
      event.target.value = '';
    }
  }, [addMessage, analyzeShoppingImage, requireOnline, session?.user?.id]);

  /**
   * Handle adding a new photo in chat mode
   */
  const handleChatPhotoSelect = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check online status
    if (!requireOnline('analyze')) {
      setToast({
        message: "You're offline. Connect to analyze images.",
        type: 'warning',
      });
      event.target.value = '';
      return;
    }

    try {
      // Validate the selected image
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const validation = await validateImage(file, authSession?.access_token);

      if (!validation.valid) {
        setToast({
          message: validation.error || 'Invalid image',
          type: 'error',
        });
        return;
      }

      // Compress the image for display
      const compressedBlob = await compressImage(file);
      const localImageUrl = URL.createObjectURL(compressedBlob);

      // Add user's image message (with local URL for display)
      addMessage('user', 'image', 'Photo uploaded', localImageUrl);

      // Upload to Supabase storage for AI analysis
      if (!session?.user?.id) {
        addMessage('assistant', 'text', 'Please sign in to continue.');
        return;
      }

      // Generate unique filename for shopping photo
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `shopping-${timestamp}-${random}.jpg`;

      const uploadResult = await uploadToStorage(
        compressedBlob,
        session.user.id,
        filename
      );

      // Call AI analysis
      await analyzeShoppingImage(uploadResult.url);

    } catch (error) {
      console.error('Error processing image:', error);
      setToast({
        message: 'Failed to process image. Please try again.',
        type: 'error',
      });
    } finally {
      // Reset input value
      event.target.value = '';
    }
  }, [addMessage, analyzeShoppingImage, requireOnline, session?.user?.id]);


  /**
   * Go to inventory search page and auto-start voice search
   */
  const handleVoiceInventorySearch = useCallback(() => {
    navigate('/search?voice=1');
  }, [navigate]);

  /**
   * Handle camera button in chat mode
   */
  const handleChatCameraClick = useCallback(() => {
    chatCameraInputRef.current?.click();
  }, []);

  /**
   * Build conversation history for API from messages state
   */
  const buildConversationHistory = useCallback((): ShoppingConversationMessage[] => {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      type: msg.type,
      imageUrl: msg.imageUrl,
      analysisData: msg.analysisData
        ? {
          detected_item: msg.analysisData.detected_item,
          similar_items: msg.analysisData.similar_items?.map((item) => ({
            name: item.name,
            similarity: item.similarity,
          })),
        }
        : undefined,
    }));
  }, [messages]);

  /**
   * Handle sending a text message
   */
  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text) return;

    // Check online status
    if (!requireOnline('send message')) {
      setToast({
        message: "You're offline. Connect to send messages.",
        type: 'warning',
      });
      return;
    }

    // Add user message
    addMessage('user', 'text', text);
    setInputValue('');

    setIsTyping(true);

    try {
      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        addMessage(
          'assistant',
          'text',
          'Please sign in to continue the conversation.'
        );
        setIsTyping(false);
        return;
      }

      // Build conversation history
      const conversationHistory = buildConversationHistory();

      // Call the Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/shopping-followup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          conversation_history: conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 429) {
          const details = data.error?.details as { text_count?: number; text_limit?: number } | undefined;
          // Update usage state to reflect limit reached
          if (details) {
            updateUsage({
              text_count: details.text_count ?? 50,
              text_limit: details.text_limit ?? 50,
            });
          }
          addMessage(
            'assistant',
            'text',
            `You've used ${details?.text_count ?? 'all'} of your ${details?.text_limit ?? 50} daily questions. Try again tomorrow!`
          );
        } else if (response.status === 401) {
          addMessage(
            'assistant',
            'text',
            'Your session has expired. Please sign in again.'
          );
        } else {
          addMessage(
            'assistant',
            'text',
            data.error?.message || 'Something went wrong. Please try again.'
          );
        }
        setIsTyping(false);
        return;
      }

      // Successfully received response
      const followupResponse = data as ShoppingFollowupResponse;

      // Update usage state from response
      if (followupResponse.usage) {
        updateUsage({
          text_count: followupResponse.usage.text_count,
          text_limit: followupResponse.usage.text_limit,
        });
      }

      addMessage('assistant', 'text', followupResponse.response);

    } catch (error) {
      console.error('Error sending message:', error);
      addMessage(
        'assistant',
        'text',
        'Sorry, I had trouble responding. Please try again.'
      );
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, addMessage, buildConversationHistory, requireOnline, updateUsage]);

  /**
   * Handle Enter key press in input
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  /**
   * Start chat with a starter prompt - pre-fills the input and lets the user edit/send
   */
  const startChatWithPrompt = useCallback((prompt: string) => {
    if (!prompt.trim()) return;

    // Switch to chat view and pre-fill the input for user to review/edit
    setViewState('chat');
    setInputValue(prompt);

    // Focus the input field after the view transition
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  /**
   * Handle initial query from URL parameter (e.g., from Dashboard sample queries)
   */
  useEffect(() => {
    const initialQuery = searchParams.get('query');

    // Only process once and if there's a query AND session is available
    if (!initialQuery || initialQueryProcessed.current || !session?.access_token) return;
    initialQueryProcessed.current = true;

    // Clear the URL parameter to prevent re-processing on navigation
    setSearchParams({}, { replace: true });

    // Execute after a small delay
    setTimeout(() => {
      void startChatWithPrompt(initialQuery);
    }, 100);
  }, [searchParams, setSearchParams, session, startChatWithPrompt]);

  /**
   * Handle recent query click
   */
  const handleRecentQueryClick = useCallback((query: RecentQuery) => {
    // Check online status
    if (!requireOnline('analyze')) {
      setToast({
        message: "You're offline. Connect to analyze images.",
        type: 'warning',
      });
      return;
    }

    // Transition to chat view with the saved query
    setViewState('chat');

    // Add the saved image as first message
    addMessage('user', 'image', query.itemName, query.thumbnailUrl);

    // Re-analyze the image
    analyzeShoppingImage(query.thumbnailUrl);
  }, [addMessage, analyzeShoppingImage, requireOnline]);

  /**
   * Handle New Chat button
   */
  const handleNewChat = useCallback(() => {
    setViewState('initial');
    setMessages([]);
    setInputValue('');
    setIsTyping(false);
    setSelectedItem(null);
  }, []);

  /**
   * Render a similar item card
   */
  const renderSimilarItem = (item: SimilarItem) => {
    const matchPercentage = Math.round(item.similarity * 100);
    const matchColor =
      matchPercentage >= 90
        ? 'bg-[#f8e1d7] text-[#a04d2b]'
        : matchPercentage >= 70
          ? 'bg-[#fcf6bd] text-[#826a2a]'
          : 'bg-[#e3ead3] text-[#516241]';

    return (
      <button
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className="flex items-center gap-3 p-2.5 bg-white/90 rounded-2xl border border-[#f5ebe0]/60 hover:bg-white transition-all soft-shadow active:scale-[0.98] w-full text-left"
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-xl bg-[#f3ece4] flex-shrink-0 overflow-hidden">
          <img
            src={item.thumbnail_url || item.photo_url}
            alt={item.name || 'Item'}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#4a3f35] truncate">
            {item.name || 'Unnamed item'}
          </p>
          {item.location_path && (
            <p className="text-xs text-[#8d7b6d] truncate">
              📍 {item.location_path}
            </p>
          )}
        </div>

        {/* Match Percentage */}
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${matchColor}`}
        >
          {matchPercentage}%
        </div>
      </button>
    );
  };

  /**
   * Render an analysis message with similar items
   */
  const renderAnalysisMessage = (message: ChatMessage) => {
    const data = message.analysisData;
    if (!data) return null;

    const hasSimilarItems = data.similar_items.length > 0;
    const highMatchItems = data.similar_items.filter(i => i.similarity >= 0.9);

    return (
      <div className="flex justify-start mb-2">
        <div className="max-w-[90%] rounded-2xl bg-white/90 border border-[#f5ebe0]/60 text-[#4a3f35] rounded-bl-md px-4 py-3 soft-shadow">
          {/* Detected Item Header */}
          {data.detected_item && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔍</span>
                <span className="font-black text-[#4a3f35]">
                  {data.detected_item.name}
                </span>
              </div>
              {data.detected_item.category_suggestion && (
                <span className="inline-block px-2 py-0.5 bg-[#e3ead3] text-[#516241] text-xs rounded-full">
                  {data.detected_item.category_suggestion}
                </span>
              )}
            </div>
          )}

          {/* Similar Items Section */}
          {hasSimilarItems ? (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-[#6f5f52]">
                  {highMatchItems.length > 0
                    ? `⚠️ Found ${highMatchItems.length} very similar item${highMatchItems.length > 1 ? 's' : ''}!`
                    : `📦 ${data.similar_items.length} similar item${data.similar_items.length > 1 ? 's' : ''} in your inventory`}
                </span>
              </div>
              <div className="space-y-2">
                {data.similar_items.slice(0, 3).map(renderSimilarItem)}
              </div>
              {data.similar_items.length > 3 && (
                <p className="text-xs text-[#8d7b6d] mt-2 text-center">
                  +{data.similar_items.length - 3} more items
                </p>
              )}
            </div>
          ) : (
            <div className="mb-3 p-3 bg-[#e3ead3] rounded-xl border border-[#d7e1c2]">
              <div className="flex items-center gap-2">
                <span className="text-[#516241]">✅</span>
                <span className="text-sm text-[#516241]">
                  No similar items found in your inventory
                </span>
              </div>
            </div>
          )}

          {/* AI Advice */}
          {data.advice && (
            <div className="pt-3 border-t border-[#ece2d8]">
              <p className="text-sm text-[#4a3f35] whitespace-pre-wrap">
                {data.advice}
              </p>
            </div>
          )}

          {/* Usage indicator */}
          {data.usage && (
            <div className="mt-3 pt-2 border-t border-[#ece2d8]">
              <p className="text-xs text-[#8d7b6d]">
                📸 {data.usage.photo_count}/{data.usage.photo_limit} daily analyses used
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Render a single chat message
   */
  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showTimestamp = !prevMessage ||
      prevMessage.role !== message.role ||
      !isSameTimeGroup(prevMessage.timestamp, message.timestamp);

    return (
      <div key={message.id}>
        {/* Timestamp */}
        {showTimestamp && (
          <div className="text-center my-3">
            <span className="text-xs text-[#8d7b6d] bg-[#f3ece4] px-2 py-1 rounded-full">
              {formatMessageTime(message.timestamp)}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        {message.type === 'analysis' ? (
          renderAnalysisMessage(message)
        ) : (
          <div
            className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl ${isUser
                  ? 'bg-[#d6ccc2] text-[#4a3f35] rounded-br-md'
                  : 'bg-white/90 border border-[#f5ebe0]/60 text-[#4a3f35] rounded-bl-md soft-shadow'
                } ${message.type === 'image' ? 'p-1' : 'px-4 py-3'}`}
            >
              {message.type === 'image' && message.imageUrl ? (
                <img
                  src={message.imageUrl}
                  alt="User photo"
                  className="max-w-full rounded-xl max-h-64 object-contain"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get current warning messages
  const photoWarningMessage = getPhotoWarningMessage();
  const textWarningMessage = getTextWarningMessage();

  // Render Chat Interface
  if (viewState === 'chat') {
    return (
      <div className="h-full flex flex-col bg-[#fdf8f2]">
        {/* Usage Warning Banner */}
        {(showPhotoWarning || photoLimitReached) && (
          <div
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium text-center ${photoLimitReached
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-800'
              }`}
          >
            <span className="mr-1">{photoLimitReached ? '🚫' : '⚠️'}</span>
            {photoWarningMessage}
          </div>
        )}

        {/* Text Usage Warning Banner (only show when different from photo warning) */}
        {(showTextWarning || textLimitReached) && !photoLimitReached && (
          <div
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium text-center ${textLimitReached
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-800'
              }`}
          >
            <span className="mr-1">{textLimitReached ? '🚫' : '⚠️'}</span>
            {textWarningMessage}
          </div>
        )}

        {/* Chat Header */}
        <div className="flex-shrink-0 glass border-b border-[#f5ebe0]/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="p-1 -ml-1 text-[#8d7b6d] hover:text-[#4a3f35]"
              aria-label="Back to initial state"
            >
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
            </button>
            <div>
              <h1 className="text-lg font-black text-[#4a3f35] tracking-tight">
                Shopping Assistant
              </h1>
              <p className="text-xs text-[#8d7b6d] uppercase tracking-wider">
                {isTyping ? 'Analyzing...' : 'Online'}
              </p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="text-xs text-[#8d7b6d] font-black uppercase tracking-wider hover:text-[#4a3f35]"
          >
            New Chat
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl w-full mx-auto">
          {messages.map((msg, index) => renderMessage(msg, index))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start mb-2">
              <div className="bg-white/90 border border-[#f5ebe0]/60 rounded-2xl rounded-bl-md px-4 py-3 soft-shadow">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-[#b9a99b] rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#b9a99b] rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#b9a99b] rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar - Sticky at bottom */}
        <div className="flex-shrink-0 bg-white/90 border-t border-[#f5ebe0]/60 px-4 py-3 pb-safe backdrop-blur">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            {/* Camera Button */}
            <button
              onClick={handleChatCameraClick}
              disabled={photoLimitReached}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${photoLimitReached
                  ? 'text-[#cdbfb2] cursor-not-allowed'
                  : 'text-[#8d7b6d] hover:text-[#4a3f35] hover:bg-[#f3ece4]'
                }`}
              aria-label="Add photo"
            >
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={textLimitReached}
                placeholder={textLimitReached ? "Daily limit reached" : "Ask a follow-up..."}
                className={`w-full px-4 py-2 rounded-full border border-transparent focus:outline-none transition-colors ${textLimitReached
                    ? 'bg-[#f0e8df] text-[#b9a99b] cursor-not-allowed'
                    : 'bg-[#f3ece4] focus:border-[#d6ccc2] focus:bg-white text-[#4a3f35]'
                  }`}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || textLimitReached}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${inputValue.trim() && !textLimitReached
                  ? 'bg-[#d6ccc2] text-[#4a3f35] hover:bg-[#c8b9ab]'
                  : 'bg-[#f0e8df] text-[#b9a99b] cursor-not-allowed'
                }`}
              aria-label="Send message"
            >
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Hidden File Input for Chat Camera */}
        <input
          ref={chatCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChatPhotoSelect}
          className="hidden"
          aria-label="Take photo for chat"
        />

        {/* Similar Item Detail Modal */}
        {selectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="bg-[#fdf8f2] w-full max-w-lg rounded-t-[2rem] max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300 border-t border-[#f5ebe0]/70"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#ece2d8]">
                <h3 className="text-lg font-black text-[#4a3f35]">
                  Item Details
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 text-[#8d7b6d] hover:text-[#4a3f35] hover:bg-[#f3ece4] rounded-full transition-colors"
                  aria-label="Close"
                >
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
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 overflow-y-auto">
                {/* Item Image */}
                <div className="w-full aspect-square rounded-2xl bg-[#f3ece4] overflow-hidden mb-4 border border-[#f5ebe0]/60">
                  <img
                    src={selectedItem.photo_url}
                    alt={selectedItem.name || 'Item'}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Item Info */}
                <div className="space-y-3">
                  <h4 className="text-xl font-black text-[#4a3f35]">
                    {selectedItem.name || 'Unnamed item'}
                  </h4>

                  {/* Match Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#8d7b6d]">Match:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${selectedItem.similarity >= 0.9
                          ? 'bg-red-100 text-red-700'
                          : selectedItem.similarity >= 0.7
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                    >
                      {Math.round(selectedItem.similarity * 100)}% similar
                    </span>
                  </div>

                  {/* Location */}
                  {selectedItem.location_path && (
                    <div className="flex items-center gap-2 text-[#8d7b6d]">
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-sm">{selectedItem.location_path}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      // Navigate to item detail page
                      window.location.href = `/item/${selectedItem.id}`;
                    }}
                    className="flex-1 py-3 px-4 bg-[#d6ccc2] text-[#4a3f35] font-semibold rounded-xl hover:bg-[#c8b9ab] transition-colors"
                  >
                    View Item
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="py-3 px-4 bg-[#f3ece4] text-[#6f5f52] font-semibold rounded-xl hover:bg-[#eadfd4] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  }

  // Render Initial State
  return (
    <div className="min-h-full flex flex-col bg-[#fdf8f2]">
      {/* Usage Warning Banner */}
      {(showPhotoWarning || photoLimitReached) && (
        <div
          className={`flex-shrink-0 px-4 py-2 text-sm font-medium text-center ${photoLimitReached
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-800'
            }`}
        >
          <span className="mr-1">{photoLimitReached ? '🚫' : '⚠️'}</span>
          {photoWarningMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 pt-6 pb-4 px-4 max-w-3xl w-full mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-[#4a3f35]">
          Ownly,
          <span className="ml-2 text-xl font-semibold tracking-normal text-[#6f5f52]">
            your AI Bestie to help find, buy or decide
          </span>
        </h1>
        <p className="mt-2 text-sm text-[#8d7b6d]">
          Tap a prompt below to start chatting with Ownly
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pb-6 max-w-3xl w-full mx-auto">
        {/* Initial State - Assistant Prompts */}
        <div className="mb-8 pt-2">
          <div className="bg-white/90 rounded-[1.75rem] border border-[#f5ebe0]/60 soft-shadow p-6">
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#f8f3ec] border border-[#eadfce] p-4">
                <h3 className="text-base font-black text-[#4a3f35]">Help me find my stuff</h3>
                <p className="text-xs text-[#8d7b6d] mb-2">Tap a prompt below to start chatting with Ownly</p>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    onClick={handleVoiceInventorySearch}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e7dbcc] bg-white/95 px-4 py-2 text-sm font-semibold text-[#7a6b5e] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#d8cab9] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span aria-hidden="true">🔍</span>
                    Search in my inventory
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f3f7eb] border border-[#dde8ca] p-4">
                <h3 className="text-base font-black text-[#4a3f35] mb-2">Should I buy this?</h3>
                <p className="text-xs text-[#8d7b6d] mb-2">Tap a prompt below to start chatting with Ownly</p>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    onClick={() => void startChatWithPrompt('Do I really need this?')}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-full border border-[#d4dfc2] bg-white/95 px-4 py-2 text-sm font-semibold text-[#6f7e5e] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#c0cfaa] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Do I really need this?
                  </button>
                  <button
                    onClick={() => void startChatWithPrompt('Does this match my closet?')}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-full border border-[#d4dfc2] bg-white/95 px-4 py-2 text-sm font-semibold text-[#6f7e5e] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#c0cfaa] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Does this match my closet?
                  </button>
                </div>

              </div>

              <div className="rounded-2xl bg-[#eef5f7] border border-[#d7e6eb] p-4">
                <h3 className="text-base font-black text-[#4a3f35] mb-2">What should I wear today?</h3>
                <p className="text-xs text-[#8d7b6d] mb-2">Tap a prompt below to start chatting with Ownly</p>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    onClick={() => void startChatWithPrompt('What should I wear today for work?')}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-full border border-[#cfdfe6] bg-white/95 px-4 py-2 text-sm font-semibold text-[#5e7682] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#bcd0da] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    What should I wear today for work?
                  </button>
                  <button
                    onClick={() => void startChatWithPrompt('Pack for this weekend trip')}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-full border border-[#cfdfe6] bg-white/95 px-4 py-2 text-sm font-semibold text-[#5e7682] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#bcd0da] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pack for this weekend trip
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f7efef] border border-[#ebdcdc] p-4">
                <h3 className="text-base font-black text-[#4a3f35] mb-2">I need some space, help me declutter.</h3>
                <p className="text-xs text-[#8d7b6d] mb-2">Tap a prompt below to start chatting with Ownly</p>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    onClick={() => void startChatWithPrompt("What I haven't used for more than 1 year")}
                    disabled={isProcessing}
                    className="inline-flex items-center rounded-full border border-[#e5d4d4] bg-white/95 px-4 py-2 text-sm font-semibold text-[#7d6666] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#d7c0c0] hover:text-[#4a3f35] hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    What I haven't used for more than 1 year
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-4 mb-8">
          {/* Ask a Question Card */}
          <button
            onClick={() => setViewState('chat')}
            disabled={isProcessing}
            className="w-full p-6 bg-white/90 rounded-[1.75rem] soft-shadow border border-[#f5ebe0]/60 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4">
              {/* Chat Icon */}
              <div className="w-14 h-14 rounded-full bg-[#e3ead3] flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-7 h-7 text-[#4a3f35]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              {/* Text */}
              <div className="flex-1 text-left">
                <h3 className="text-lg font-black text-[#4a3f35]">
                  Ask Any Question
                </h3>
                <p className="text-sm text-[#8d7b6d]">
                  Chat with me about your inventory
                </p>
              </div>
              {/* Chevron */}
              <svg
                className="w-5 h-5 text-[#b9a99b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-[#8d7b6d] mb-6">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
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
            <span>Processing image...</span>
          </div>
        )}

        {/* Recent Queries Section */}
        {recentQueries.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-[#8d7b6d]"
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
              <h3 className="text-lg font-black text-[#4a3f35]">Recent</h3>
            </div>

            <div className="space-y-2">
              {recentQueries.map((query) => (
                <button
                  key={query.id}
                  onClick={() => handleRecentQueryClick(query)}
                  className="w-full flex items-center gap-3 p-3 bg-white/90 rounded-2xl border border-[#f5ebe0]/60 soft-shadow hover:bg-white transition-all active:scale-[0.98]"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-[#f3ece4] flex-shrink-0 overflow-hidden">
                    {query.thumbnailUrl ? (
                      <img
                        src={query.thumbnailUrl}
                        alt={query.itemName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-[#b9a99b]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-black text-[#4a3f35] truncate">
                      {query.itemName}
                    </p>
                    <p className="text-xs text-[#8d7b6d]">
                      {getRelativeTime(query.timestamp)}
                    </p>
                  </div>

                  {/* Chevron */}
                  <svg
                    className="w-5 h-5 text-[#b9a99b] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for recent queries - only show when no queries */}
        {recentQueries.length === 0 && (
          <div className="p-4 bg-white/80 border border-[#f5ebe0]/60 rounded-2xl text-center soft-shadow">
            <p className="text-sm text-[#8d7b6d]">
              Your recent shopping queries will appear here
            </p>
          </div>
        )}

      </div>

      {/* Hidden File Inputs */}
      {/* Camera Input - uses capture="environment" for rear camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Take photo with camera"
      />

      {/* Gallery Input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Choose from gallery"
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
