/**
 * Chat Page
 * Shows messages for a listing conversation
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useMessages, type ChatMessage, type Conversation } from '@/hooks/useMessages';
import { usePresence } from '@/hooks/usePresence';
import { useToast } from '@/hooks/useToast';

function BackIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ChatPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getListingById } = useMarketplace();
  const { getMessages, sendMessage, markAsRead, getConversations, subscribeToMessages } = useMessages();
  const { setActiveConversation, clearPresence } = usePresence();
  const { error: showError } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [listingName, setListingName] = useState('Listing');
  const [listingPhoto, setListingPhoto] = useState('');
  const [listingSellerId, setListingSellerId] = useState<string | null>(null);
  const [listingSellerName, setListingSellerName] = useState<string | null>(null);
  const [listingSellerUserId, setListingSellerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadListing = useCallback(async () => {
    if (!listingId) {
      return;
    }

    try {
      const listing = await getListingById(listingId);
      if (listing) {
        setListingName(listing.item.name || 'Listing');
        setListingPhoto(listing.item.photo_url || listing.item.thumbnail_url || '');
        setListingSellerId(listing.seller.id);
        setListingSellerName(listing.seller.display_name || 'Seller');
        setListingSellerUserId(listing.seller.user_id);
      }
    } catch (err) {
      console.error('Failed to load listing details:', err);
    }
  }, [getListingById, listingId]);

  const loadConversation = useCallback(async () => {
    if (!listingId) {
      return;
    }

    const conversations = await getConversations();
    const match = conversations.find((item) => item.id === listingId) || null;
    setConversation(match);
  }, [getConversations, listingId]);

  const loadMessages = useCallback(async () => {
    if (!listingId) {
      return;
    }

    setIsLoading(true);
    const data = await getMessages(listingId);
    setMessages(data);
    setIsLoading(false);
  }, [getMessages, listingId]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    loadListing();
    loadConversation();
    loadMessages();
  }, [loadConversation, loadListing, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (listingId) {
      markAsRead(listingId);
    }
  }, [listingId, markAsRead]);

  // Track user presence on this conversation for smart push suppression
  useEffect(() => {
    if (listingId) {
      setActiveConversation(listingId);
    }

    return () => {
      clearPresence();
    };
  }, [listingId, setActiveConversation, clearPresence]);

  useEffect(() => {
    if (!listingId) return;

    const unsubscribe = subscribeToMessages(listingId, (msg) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === msg.id)) {
          return prev;
        }
        const next = [...prev, msg];
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return next;
      });

      if (!msg.is_mine) {
        markAsRead(listingId);
      }
    });

    return unsubscribe;
  }, [listingId, markAsRead, subscribeToMessages]);

  const receiverId = useMemo(() => {
    if (conversation) {
      return conversation.other_user.id;
    }
    if (listingSellerId && listingSellerUserId && user && listingSellerUserId !== user.id) {
      return listingSellerId;
    }
    return null;
  }, [conversation, listingSellerId, listingSellerUserId, user]);

  const handleSend = useCallback(async () => {
    if (!listingId || !receiverId || !draft.trim()) {
      return;
    }

    setIsSending(true);
    const success = await sendMessage(listingId, receiverId, draft);
    setIsSending(false);

    if (!success) {
      showError('Unable to send message. Please try again.');
      return;
    }

    setDraft('');
    await loadMessages();
  }, [draft, listingId, loadMessages, receiverId, sendMessage, showError]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const headerSubtitle = conversation?.other_user.display_name
    || (user && listingSellerUserId === user.id ? 'Buyer' : listingSellerName)
    || (user ? 'Chat' : 'Conversation');

  return (
    <div className="min-h-screen bg-[#fdf8f2] flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#efe6dc] overflow-hidden flex items-center justify-center">
              {listingPhoto ? (
                <img src={listingPhoto} alt={listingName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[#8d7b6d]">No photo</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#4a3f35]">{listingName}</p>
              <p className="text-xs text-[#8d7b6d]">{headerSubtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-[#8d7b6d]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[#8d7b6d]">No messages yet</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[75%]">
                <div
                  className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                    message.is_mine
                      ? 'bg-[#8d7b6d] text-white rounded-br-md'
                      : 'bg-[#efe6dc] text-[#4a3f35] rounded-bl-md'
                  }`}
                >
                  {message.content}
                </div>
                <div
                  className={`text-[11px] mt-1 ${message.is_mine ? 'text-right text-teal-200' : 'text-left text-[#b9a99b]'}`}
                >
                  {formatMessageTime(message.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#f5ebe0]/60 bg-white px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[#f5ebe0]/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#d6ccc2]"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || isSending || !receiverId}
            className="px-4 py-2 rounded-xl bg-[#8d7b6d] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#7c6b5d] transition-colors"
          >
            Send
          </button>
        </div>
        {!receiverId && (
          <p className="text-xs text-[#b9a99b] mt-2">
            You can start messaging once the other party is available.
          </p>
        )}
      </div>
    </div>
  );
}
