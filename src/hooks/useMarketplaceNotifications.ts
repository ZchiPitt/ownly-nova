/**
 * Hook for managing marketplace notifications
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { MarketplaceNotificationType } from '@/lib/notifications';
import type { Notification } from '@/types';

const MARKETPLACE_TYPES: MarketplaceNotificationType[] = [
  'new_inquiry',
  'purchase_request',
  'request_accepted',
  'request_declined',
  'new_message',
  'transaction_complete',
];

export function useMarketplaceNotifications() {
  const { user } = useAuth();

  const getNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .in('type', MARKETPLACE_TYPES)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as Notification[]) ?? [];
  }, [user]);

  const getUnreadCount = useCallback(async (): Promise<number> => {
    if (!user) {
      return 0;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .in('type', MARKETPLACE_TYPES);

    if (error) {
      throw new Error(error.message);
    }

    return count ?? 0;
  }, [user]);

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      return;
    }

    const { error } = await (supabase
      .from('notifications') as ReturnType<typeof supabase.from>)
      .update({ is_read: true } as Record<string, unknown>)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message);
    }
  }, [user]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) {
      return;
    }

    const { error } = await (supabase
      .from('notifications') as ReturnType<typeof supabase.from>)
      .update({ is_read: true } as Record<string, unknown>)
      .eq('user_id', user.id)
      .eq('is_read', false)
      .in('type', MARKETPLACE_TYPES);

    if (error) {
      throw new Error(error.message);
    }
  }, [user]);

  return {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
  };
}
