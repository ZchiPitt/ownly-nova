/**
 * Messages Page
 * Lists conversations for the current user
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages, type Conversation } from '@/hooks/useMessages';

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function MessageListItem({ conversation, onClick }: { conversation: Conversation; onClick: () => void }) {
  const { other_user, last_message, unread_count, listing } = conversation;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 text-left bg-white/90 hover:bg-white transition-all border border-[#f5ebe0]/60 rounded-2xl soft-shadow"
    >
      <div className="w-12 h-12 rounded-full bg-[#f3ece4] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {other_user.avatar_url ? (
          <img
            src={other_user.avatar_url}
            alt={other_user.display_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold text-[#6f5f52]">
            {other_user.display_name?.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#4a3f35] truncate">
              {other_user.display_name || 'User'}
            </p>
            <p className="text-xs text-[#8d7b6d] truncate uppercase tracking-wide">
              {listing.item_name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-[#b9a99b]">
              {formatTimestamp(last_message.created_at)}
            </span>
            {unread_count > 0 && (
              <span className="min-w-[20px] px-1.5 py-0.5 text-[10px] font-semibold text-[#4a3f35] bg-[#fbc4ab] rounded-full text-center">
                {unread_count}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-[#8d7b6d] mt-1 truncate">
          {last_message.is_mine ? 'You: ' : ''}{last_message.content}
        </p>
      </div>
    </button>
  );
}

export function MessagesPage() {
  const navigate = useNavigate();
  const { getConversations } = useMessages();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    const data = await getConversations();
    setConversations(data);
    setIsLoading(false);
  }, [getConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const handleFocus = () => {
      loadConversations();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadConversations]);

  return (
    <div className="min-h-screen bg-[#fdf8f2]">
      <div className="glass border-b border-[#f5ebe0]/40 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-black tracking-tight text-[#4a3f35]">Messages</h1>
        </div>
      </div>

      <div className="pb-20 max-w-3xl mx-auto px-4 pt-4">
        {isLoading ? (
          <div className="p-6 text-center text-[#8d7b6d] bg-white/80 rounded-[1.5rem] border border-[#f5ebe0]/60 soft-shadow">Loading messages...</div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center bg-white/80 rounded-[2rem] border border-[#f5ebe0]/60 soft-shadow">
            <div className="w-16 h-16 mb-4 bg-[#f3ece4] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#b9a99b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.2-4A7.76 7.76 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-[#4a3f35]">No messages yet</h3>
            <p className="text-sm text-[#8d7b6d] mt-2">
              When you message a seller, your conversations will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <MessageListItem
                key={conversation.id}
                conversation={conversation}
                onClick={() => navigate(`/messages/${conversation.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
