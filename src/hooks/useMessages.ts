/**
 * Hook for managing in-app messages and conversations
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { createMarketplaceNotification } from '@/lib/notifications';

export interface Conversation {
  id: string;
  listing: { id: string; item_name: string; photo_url: string };
  other_user: { id: string; display_name: string; avatar_url: string | null };
  last_message: { content: string; created_at: string; is_mine: boolean };
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_mine: boolean;
}

interface MessageRow {
  id: string;
  listing_id: string | null;
  content: string;
  created_at: string;
  read_at: string | null;
  sender_id: string;
  receiver_id: string;
  listing: {
    id: string;
    item: {
      name: string | null;
      photo_url: string | null;
      thumbnail_url?: string | null;
    } | null;
  } | null;
  sender: { id: string; display_name: string | null; avatar_url: string | null } | null;
  receiver: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

export function useMessages() {
  const { user } = useAuth();

  const getProfileId = useCallback(async (): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('user_id', user.id)
      .single();

    const profile = data as { id: string } | null;

    if (error || !profile) {
      throw new Error(error?.message || 'Profile not found');
    }

    return profile.id;
  }, [user]);

  const getUserIdByProfileId = useCallback(async (profileId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('user_id')
      .eq('id', profileId)
      .single();

    const profile = data as { user_id: string } | null;

    if (error || !profile?.user_id) {
      console.warn('Unable to resolve profile user_id:', error?.message);
      return null;
    }

    return profile.user_id;
  }, []);

  const getProfileDisplayName = useCallback(async (profileId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
      .select('display_name')
      .eq('id', profileId)
      .single();

    const profile = data as { display_name: string | null } | null;

    if (error) {
      console.warn('Unable to resolve profile display name:', error.message);
      return null;
    }

    return profile?.display_name ?? null;
  }, []);

  const getListingItemName = useCallback(async (listingId: string): Promise<string | null> => {
    const { data, error } = await (supabase.from('listings') as ReturnType<typeof supabase.from>)
      .select('item:items(name)')
      .eq('id', listingId)
      .single();

    const listing = data as { item: { name: string | null } | null } | null;

    if (error) {
      console.warn('Unable to resolve listing item name:', error.message);
      return null;
    }

    return listing?.item?.name ?? null;
  }, []);

  const getConversations = useCallback(async (): Promise<Conversation[]> => {
    if (!user) {
      return [];
    }

    try {
      const profileId = await getProfileId();

      const { data, error } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select(`
          id,
          listing_id,
          content,
          created_at,
          read_at,
          sender_id,
          receiver_id,
          listing:listings!inner(
            id,
            item:items!inner(name, photo_url, thumbnail_url)
          ),
          sender:profiles!sender_id(id, display_name, avatar_url),
          receiver:profiles!receiver_id(id, display_name, avatar_url)
        `)
        .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data as MessageRow[] | null) ?? [];
      const conversationMap = new Map<string, Conversation>();

      rows.forEach((row) => {
        if (!row.listing_id || !row.listing?.item) {
          return;
        }

        const otherUser = row.sender_id === profileId ? row.receiver : row.sender;
        if (!otherUser) {
          return;
        }

        const existing = conversationMap.get(row.listing_id);
        const isUnread = row.receiver_id === profileId && !row.read_at;

        if (!existing) {
          const itemName = row.listing.item.name || 'Listing';
          const photoUrl = row.listing.item.photo_url || row.listing.item.thumbnail_url || '';
          conversationMap.set(row.listing_id, {
            id: row.listing_id,
            listing: {
              id: row.listing.id,
              item_name: itemName,
              photo_url: photoUrl,
            },
            other_user: {
              id: otherUser.id,
              display_name: otherUser.display_name || 'User',
              avatar_url: otherUser.avatar_url,
            },
            last_message: {
              content: row.content,
              created_at: row.created_at,
              is_mine: row.sender_id === profileId,
            },
            unread_count: isUnread ? 1 : 0,
          });
        } else if (isUnread) {
          existing.unread_count += 1;
        }
      });

      return Array.from(conversationMap.values()).sort((a, b) => {
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      });
    } catch (err) {
      console.error('Error fetching conversations:', err);
      return [];
    }
  }, [getProfileId, user]);

  const getMessages = useCallback(async (listingId: string): Promise<ChatMessage[]> => {
    if (!user || !listingId) {
      return [];
    }

    try {
      const profileId = await getProfileId();

      const { data, error } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select('id, content, sender_id, created_at, listing_id, receiver_id')
        .eq('listing_id', listingId)
        .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const rows = (data as Array<{ id: string; content: string; sender_id: string; created_at: string }> | null) ?? [];

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        sender_id: row.sender_id,
        created_at: row.created_at,
        is_mine: row.sender_id === profileId,
      }));
    } catch (err) {
      console.error('Error fetching messages:', err);
      return [];
    }
  }, [getProfileId, user]);

  const sendMessage = useCallback(async (listingId: string, receiverId: string, content: string): Promise<boolean> => {
    if (!user || !listingId || !receiverId) {
      return false;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }

    try {
      const profileId = await getProfileId();
      const payload = {
        listing_id: listingId,
        sender_id: profileId,
        receiver_id: receiverId,
        content: trimmed,
      } as Record<string, unknown>;

      const { error } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .insert(payload);

      if (error) {
        throw error;
      }

      const receiverUserId = await getUserIdByProfileId(receiverId);
      if (receiverUserId) {
        try {
          const senderName =
            (await getProfileDisplayName(profileId)) ??
            user?.user_metadata?.display_name ??
            'Someone';
          const itemName = await getListingItemName(listingId);

          await createMarketplaceNotification(receiverUserId, 'new_message', {
            listing_id: listingId,
            sender_id: profileId,
            sender_name: senderName,
            item_name: itemName ?? undefined,
            message_preview: trimmed,
          });
        } catch (notificationError) {
          console.warn('Failed to create new message notification:', notificationError);
        }
      }

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  }, [getListingItemName, getProfileDisplayName, getProfileId, getUserIdByProfileId, user]);

  const markAsRead = useCallback(async (listingId: string): Promise<void> => {
    if (!user || !listingId) {
      return;
    }

    try {
      const profileId = await getProfileId();
      const { error } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .update({ read_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('listing_id', listingId)
        .eq('receiver_id', profileId)
        .is('read_at', null);

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [getProfileId, user]);

  const getUnreadCount = useCallback(async (): Promise<number> => {
    if (!user) {
      return 0;
    }

    try {
      const profileId = await getProfileId();
      const { count, error } = await (supabase
        .from('messages') as ReturnType<typeof supabase.from>)
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', profileId)
        .is('read_at', null);

      if (error) {
        throw error;
      }

      return count ?? 0;
    } catch (err) {
      console.error('Error fetching unread count:', err);
      return 0;
    }
  }, [getProfileId, user]);

  const subscribeToMessages = useCallback((listingId: string, callback: (msg: ChatMessage) => void) => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isActive = true;

    const setup = async () => {
      if (!user || !listingId) {
        return;
      }

      try {
        const profileId = await getProfileId();
        if (!isActive) {
          return;
        }

        channel = supabase
          .channel(`messages:${listingId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `listing_id=eq.${listingId}`,
            },
            (payload) => {
              const newMessage = payload.new as {
                id: string;
                content: string;
                sender_id: string;
                created_at: string;
              };

              callback({
                id: newMessage.id,
                content: newMessage.content,
                sender_id: newMessage.sender_id,
                created_at: newMessage.created_at,
                is_mine: newMessage.sender_id === profileId,
              });
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to subscribe to messages:', err);
      }
    };

    setup();

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [getProfileId, user]);

  return {
    getConversations,
    getMessages,
    sendMessage,
    markAsRead,
    getUnreadCount,
    subscribeToMessages,
  };
}
