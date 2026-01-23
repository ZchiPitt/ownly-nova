/**
 * Hook for managing push notification permissions and subscriptions
 * US-065: Implement push notification permission flow
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// VAPID public key for Web Push
// This should be set in environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface UsePushNotificationsReturn {
  /** Current permission state */
  permissionState: PushPermissionState;
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Whether currently requesting permission */
  isRequesting: boolean;
  /** Whether currently registered (has active subscription) */
  isSubscribed: boolean;
  /** Error message if any */
  error: string | null;
  /** Request permission and subscribe */
  requestPermission: () => Promise<'granted' | 'denied' | 'error'>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
}

/**
 * Convert base64 URL-safe string to Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Push API is supported in the current browser
 */
function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state
 */
function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionState;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<PushPermissionState>(getPermissionState);
  const [isSupported] = useState(isPushSupported);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing subscription on mount
  useEffect(() => {
    if (!isSupported || !user) {
      return;
    }

    const checkExistingSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Error checking push subscription:', err);
      }
    };

    checkExistingSubscription();
  }, [isSupported, user]);

  // Update permission state when it changes
  useEffect(() => {
    if (!isSupported) return;

    // Listen for permission changes (some browsers support this)
    const checkPermission = () => {
      setPermissionState(getPermissionState());
    };

    // Check on visibility change (user might change permissions in settings)
    document.addEventListener('visibilitychange', checkPermission);

    return () => {
      document.removeEventListener('visibilitychange', checkPermission);
    };
  }, [isSupported]);

  /**
   * Store push subscription in the database
   */
  const storeSubscription = useCallback(async (subscription: globalThis.PushSubscription): Promise<boolean> => {
    if (!user) return false;

    try {
      const subscriptionData = subscription.toJSON();

      if (!subscriptionData.endpoint || !subscriptionData.keys) {
        throw new Error('Invalid subscription data');
      }

      const { error: upsertError } = await (supabase
        .from('push_subscriptions') as ReturnType<typeof supabase.from>)
        .upsert(
          {
            user_id: user.id,
            endpoint: subscriptionData.endpoint,
            p256dh: subscriptionData.keys.p256dh || '',
            auth: subscriptionData.keys.auth || '',
            user_agent: navigator.userAgent,
            is_active: true,
          } as Record<string, unknown>,
          {
            onConflict: 'user_id,endpoint',
          }
        );

      if (upsertError) {
        throw upsertError;
      }

      return true;
    } catch (err) {
      console.error('Error storing push subscription:', err);
      return false;
    }
  }, [user]);

  /**
   * Remove push subscription from the database
   */
  const removeSubscription = useCallback(async (endpoint: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);

      if (deleteError) {
        throw deleteError;
      }

      return true;
    } catch (err) {
      console.error('Error removing push subscription:', err);
      return false;
    }
  }, [user]);

  /**
   * Request notification permission and subscribe to push
   */
  const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'error'> => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return 'error';
    }

    if (!user) {
      setError('You must be logged in to enable notifications');
      return 'error';
    }

    if (!VAPID_PUBLIC_KEY) {
      // For development, we still want to test the permission flow
      console.warn('VAPID_PUBLIC_KEY not configured - push subscription will be skipped');
    }

    setIsRequesting(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PushPermissionState);

      if (permission !== 'granted') {
        return 'denied';
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      // If not subscribed and we have a VAPID key, create new subscription
      if (!subscription && VAPID_PUBLIC_KEY) {
        try {
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
          });
        } catch (subscribeError) {
          console.error('Failed to subscribe to push:', subscribeError);
          // Permission was granted but subscription failed - still return granted
          // This can happen if service worker isn't properly configured yet
          setIsSubscribed(false);
          return 'granted';
        }
      }

      // Store subscription in database
      if (subscription) {
        const stored = await storeSubscription(subscription);
        if (!stored) {
          console.warn('Failed to store push subscription in database');
        }
        setIsSubscribed(true);
      }

      return 'granted';
    } catch (err) {
      console.error('Error requesting push permission:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
      return 'error';
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported, user, storeSubscription]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from database
        await removeSubscription(subscription.endpoint);
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Error unsubscribing from push:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable notifications');
      return false;
    }
  }, [isSupported, removeSubscription]);

  return {
    permissionState,
    isSupported,
    isRequesting,
    isSubscribed,
    error,
    requestPermission,
    unsubscribe,
  };
}
