/**
 * Hook for managing notifications
 * Provides notifications list, unread count, and mutation functions
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Notification } from '@/types';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

/**
 * Get notifications for the current user
 */
export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setNotifications(data ?? []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error: updateError } = await (supabase
        .from('notifications') as ReturnType<typeof supabase.from>)
        .update({ is_read: true } as Record<string, unknown>)
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error: updateError } = await (supabase
        .from('notifications') as ReturnType<typeof supabase.from>)
        .update({ is_read: true } as Record<string, unknown>)
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [user]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error: deleteError } = await (supabase
        .from('notifications') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Update local state - remove the notification
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, [user]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
