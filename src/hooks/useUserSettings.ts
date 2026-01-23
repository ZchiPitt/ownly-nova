/**
 * Hook for fetching and updating user settings
 * Used for preferences like default_view, reminder settings, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { UserSettings } from '@/types';

interface UseUserSettingsReturn {
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<Pick<UserSettings,
    | 'default_view'
    | 'reminder_enabled'
    | 'reminder_threshold_days'
    | 'expiration_reminder_days'
    | 'push_notifications_enabled'
    | 'notification_sound_enabled'
    | 'marketplace_new_inquiry_enabled'
    | 'marketplace_purchase_request_enabled'
    | 'marketplace_request_accepted_enabled'
    | 'marketplace_request_declined_enabled'
    | 'marketplace_new_message_enabled'
    | 'marketplace_transaction_complete_enabled'
    | 'warranty_reminder_enabled'
    | 'warranty_reminder_days'
    | 'custom_reminder_enabled'
  >>) => Promise<boolean>;
  refetch: () => void;
}

export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setSettings(data as UserSettings);
    } catch (err) {
      console.error('Error fetching user settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (
    updates: Partial<Pick<UserSettings,
      | 'default_view'
      | 'reminder_enabled'
      | 'reminder_threshold_days'
      | 'expiration_reminder_days'
      | 'push_notifications_enabled'
      | 'notification_sound_enabled'
      | 'marketplace_new_inquiry_enabled'
      | 'marketplace_purchase_request_enabled'
      | 'marketplace_request_accepted_enabled'
      | 'marketplace_request_declined_enabled'
      | 'marketplace_new_message_enabled'
      | 'marketplace_transaction_complete_enabled'
      | 'warranty_reminder_enabled'
      | 'warranty_reminder_days'
      | 'custom_reminder_enabled'
    >>
  ): Promise<boolean> => {
    if (!user || !settings) {
      return false;
    }

    try {
      const { error: updateError } = await (supabase
        .from('user_settings') as ReturnType<typeof supabase.from>)
        .update(updates as Record<string, unknown>)
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state optimistically
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err) {
      console.error('Error updating user settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      return false;
    }
  }, [user, settings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}