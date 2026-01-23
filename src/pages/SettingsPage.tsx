/**
 * Settings Page
 * Allows users to configure preferences and log out
 * US-020: Create logout functionality in settings
 * US-064: Create Settings page - reminder settings section
 * US-065: Implement push notification permission flow
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useUserSettings } from '@/hooks/useUserSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/useToast';

// Unused item reminder threshold options (days)
const UNUSED_THRESHOLD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
];

// Expiration reminder options (days before) - used in Reminders & Notifications section
const EXPIRATION_REMINDER_OPTIONS = [
  { value: 3, label: '3 days before' },
  { value: 7, label: '7 days before' },
  { value: 14, label: '14 days before' },
  { value: 30, label: '30 days before' },
];

// Expiry reminder options for Item Reminders section (per US-015)
const EXPIRY_REMINDER_OPTIONS = [
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '7 days before' },
  { value: 14, label: '14 days before' },
];

// Warranty reminder options (days before)
const WARRANTY_REMINDER_OPTIONS = [
  { value: 7, label: '7 days before' },
  { value: 14, label: '14 days before' },
  { value: 30, label: '30 days before' },
  { value: 60, label: '60 days before' },
];

function TagIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M3 11l8.586 8.586a2 2 0 002.828 0l6.586-6.586a2 2 0 000-2.828L12.414 1.586a2 2 0 00-1.414-.586H5a2 2 0 00-2 2v6.586a2 2 0 00.586 1.414z"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChatBubbleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.2-4A7.76 7.76 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function HeartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      />
    </svg>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { getUnreadCount } = useMessages();
  const { settings, updateSettings, isLoading: isLoadingSettings } = useUserSettings();
  const {
    isSupported: isPushSupported,
    isRequesting: isRequestingPush,
    requestPermission,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();
  const { success, error } = useToast();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingName, setEditingName] = useState(user?.user_metadata?.display_name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMarketplaceNotificationsEnabled = settings
    ? [
      settings.marketplace_new_inquiry_enabled,
      settings.marketplace_purchase_request_enabled,
      settings.marketplace_request_accepted_enabled,
      settings.marketplace_request_declined_enabled,
      settings.marketplace_new_message_enabled,
      settings.marketplace_transaction_complete_enabled,
    ].some((value) => value === true)
    : true;

  useEffect(() => {
    const loadUnreadCount = async () => {
      const count = await getUnreadCount();
      setUnreadCount(count);
    };

    loadUnreadCount();

    const handleFocus = () => {
      loadUnreadCount();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [getUnreadCount]);

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  // Handle settings updates with optimistic UI
  const handleSettingChange = async (
    key: 'reminder_enabled' | 'reminder_threshold_days' | 'expiration_reminder_days' | 'push_notifications_enabled' | 'default_view'
      | 'marketplace_new_inquiry_enabled'
      | 'marketplace_purchase_request_enabled'
      | 'marketplace_request_accepted_enabled'
      | 'marketplace_request_declined_enabled'
      | 'marketplace_new_message_enabled'
      | 'marketplace_transaction_complete_enabled'
      | 'warranty_reminder_enabled'
      | 'warranty_reminder_days'
      | 'custom_reminder_enabled'
      | 'notification_sound_enabled',
    value: boolean | number | string
  ) => {
    if (isUpdating || isRequestingPush) return;

    // Special handling for push notifications toggle
    if (key === 'push_notifications_enabled' && value === true) {
      await handleEnablePushNotifications();
      return;
    }

    // If disabling push notifications, also unsubscribe
    if (key === 'push_notifications_enabled' && value === false) {
      await handleDisablePushNotifications();
      return;
    }

    setIsUpdating(true);
    const success = await updateSettings({ [key]: value });
    setIsUpdating(false);

    if (!success) {
      error('Failed to update setting');
    }
  };

  // Handle enabling push notifications
  const handleEnablePushNotifications = async () => {
    if (!isPushSupported) {
      error('Push notifications are not supported in this browser');
      return;
    }

    const result = await requestPermission();

    if (result === 'granted') {
      // Update user settings in database
      setIsUpdating(true);
      const updateSuccess = await updateSettings({ push_notifications_enabled: true });
      setIsUpdating(false);

      if (updateSuccess) {
        success('Push notifications enabled');
      } else {
        error('Failed to save notification setting');
      }
    } else if (result === 'denied') {
      error('Notifications blocked. Please enable in browser settings.');
    } else {
      error('Failed to enable notifications');
    }
  };

  // Handle disabling push notifications
  const handleDisablePushNotifications = async () => {
    // Unsubscribe from push notifications
    await unsubscribePush();

    // Update user settings in database
    setIsUpdating(true);
    const success = await updateSettings({ push_notifications_enabled: false });
    setIsUpdating(false);

    if (!success) {
      error('Failed to update setting');
    }
  };

  const handleMarketplaceNotificationsToggle = async (enabled: boolean) => {
    if (isUpdating || isRequestingPush) return;

    setIsUpdating(true);
    const updateSuccess = await updateSettings({
      marketplace_new_inquiry_enabled: enabled,
      marketplace_purchase_request_enabled: enabled,
      marketplace_request_accepted_enabled: enabled,
      marketplace_request_declined_enabled: enabled,
      marketplace_new_message_enabled: enabled,
      marketplace_transaction_complete_enabled: enabled,
    });
    setIsUpdating(false);

    if (!updateSuccess) {
      error('Failed to update marketplace notifications');
    }
  };

  const handleCancelLogout = () => {
    setShowLogoutDialog(false);
  };

  const handleEditProfileClick = () => {
    setEditingName(user?.user_metadata?.display_name || '');
    setShowEditProfile(true);
  };

  const handleCancelEditProfile = () => {
    setShowEditProfile(false);
    setEditingName(user?.user_metadata?.display_name || '');
  };

  const handleSaveEditProfile = async () => {
    // Validate input
    const name = editingName.trim();
    if (!name) {
      error('Display name cannot be empty');
      return;
    }

    if (name.length > 50) {
      error('Display name must be 50 characters or less');
      return;
    }

    setIsSavingName(true);
    try {
      // Update the user metadata in Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: name },
      });

      if (updateError) {
        console.error('Error updating display name:', updateError);
        error('Failed to update display name');
      } else {
        success('Display name updated successfully');
        setShowEditProfile(false);
      }
    } catch (err) {
      console.error('Error updating display name:', err);
      error('Failed to update display name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        throw signOutError;
      }
      // Use hard redirect to ensure clean state - avoids React routing race conditions
      window.location.href = '/login';
    } catch {
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
      error('Failed to log out. Please try again.');
    }
  };

  return (
    <div className="min-h-full p-4 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#4a3f35] tracking-tight">Settings</h1>
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
        {/* Account Section - US-088 */}
        <section>
          <h2 className="text-xl font-black text-[#4a3f35] tracking-tight mb-4 px-2">
            Account
          </h2>
          <div className="bg-white rounded-[2.5rem] p-2 soft-shadow border border-[#f5ebe0]/40 overflow-hidden">
            {/* User Profile Info */}
            <div className="px-4 py-6 border-b border-[#f5ebe0]/40">
              <div className="flex items-center space-x-4">
                {/* User Avatar or Initials */}
                <div className="h-14 w-14 rounded-full bg-[#d6ccc2] flex items-center justify-center text-[#4a3f35] font-bold text-lg shadow-sm">
                  {user?.user_metadata?.display_name
                    ? user.user_metadata.display_name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                    : user?.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  {/* Display Name */}
                  <h3 className="text-base font-semibold text-[#4a3f35]">
                    {user?.user_metadata?.display_name || 'User'}
                  </h3>
                  {/* Email */}
                  <p className="text-sm text-[#8d7b6d]">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              onClick={handleEditProfileClick}
              className="w-full px-4 py-4 text-left hover:bg-[#f8e1d7]/30 transition-colors flex items-center justify-between border-b border-[#f5ebe0]/40 last:border-b-0"
            >
              <div>
                <p className="text-base font-medium text-[#4a3f35]">Edit Profile</p>
                <p className="text-sm text-[#8d7b6d]">Change your display name</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#b9a99b]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Change Password Link */}
            <button
              onClick={() => navigate('/reset-password')}
              className="w-full px-4 py-4 text-left hover:bg-[#f8e1d7]/30 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-base font-medium text-[#4a3f35]">Change Password</p>
                <p className="text-sm text-[#8d7b6d]">Reset your password</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#b9a99b]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Subscription Link */}
            <Link
              to="/plans"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#f8e1d7]/30 transition-colors border-t border-[#f5ebe0]/40"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#8d7b6d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z" />
                </svg>
                <div>
                  <span className="text-base font-medium text-[#4a3f35]">Subscription</span>
                  <p className="text-sm text-[#8d7b6d]">Manage plans and billing</p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-[#b9a99b]" />
            </Link>

            {/* My Listings Link */}
            <Link
              to="/marketplace/my-listings"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#f8e1d7]/30 transition-colors border-t border-[#f5ebe0]/40"
            >
              <div className="flex items-center gap-3">
                <TagIcon className="w-5 h-5 text-[#8d7b6d]" />
                <span className="text-base font-medium text-[#4a3f35]">My Listings</span>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-[#b9a99b]" />
            </Link>

            {/* Saved Listings Link */}
            <Link
              to="/marketplace/saved"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#f8e1d7]/30 transition-colors border-t border-[#f5ebe0]/40"
            >
              <div className="flex items-center gap-3">
                <HeartIcon className="w-5 h-5 text-[#8d7b6d]" />
                <span className="text-base font-medium text-[#4a3f35]">Saved Listings</span>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-[#b9a99b]" />
            </Link>

            {/* Messages Link */}
            <Link
              to="/messages"
              className="flex items-center justify-between px-4 py-4 hover:bg-[#f8e1d7]/30 transition-colors border-t border-[#f5ebe0]/40"
            >
              <div className="flex items-center gap-3">
                <ChatBubbleIcon className="w-5 h-5 text-[#8d7b6d]" />
                <span className="text-base font-medium text-[#4a3f35]">Messages</span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#fbc4ab] text-[#4a3f35] text-xs font-black">
                    {unreadCount}
                  </span>
                )}
                <ChevronRightIcon className="w-5 h-5 text-[#b9a99b]" />
              </div>
            </Link>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-xl font-black text-[#4a3f35] tracking-tight mb-4 px-2">
            Notifications
          </h2>
          <div className="bg-white rounded-[2.5rem] p-6 soft-shadow border border-[#f5ebe0]/40">
            
            {/* Notification type: Reminders */}
            <div className="px-4 py-4 border-b border-[#f5ebe0]/50 bg-[#eef3e6]">
              <p className="text-[11px] font-black text-[#8d7b6d] uppercase tracking-[0.24em]">
                Reminders
              </p>
            </div>
            {isLoadingSettings ? (
              <div className="px-4 py-4 flex items-center justify-center border-b border-[#f5ebe0]/40">
                <div className="animate-pulse flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#efe6dc] rounded-full" />
                  <div className="h-4 w-32 bg-[#efe6dc] rounded" />
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40">
                  <div className="flex-1">
                    <label htmlFor="reminder-master-toggle" className="text-base font-medium text-[#4a3f35]">
                      Enable Reminders
                    </label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">
                      Turn on reminder notifications for your items
                    </p>
                  </div>
                  <button
                    id="reminder-master-toggle"
                    role="switch"
                    aria-checked={settings?.reminder_enabled ?? true}
                    onClick={() => handleSettingChange('reminder_enabled', !settings?.reminder_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.reminder_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.reminder_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {settings?.reminder_enabled && (
                  <>
                    <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40">
                      <div className="flex-1 pr-4">
                        <label htmlFor="unused-threshold-inline" className="text-base font-medium text-[#4a3f35]">
                          Unused Item Reminder
                        </label>
                        <p className="text-sm text-[#8d7b6d] mt-0.5">
                          Remind about items not viewed for
                        </p>
                      </div>
                      <select
                        id="unused-threshold-inline"
                        value={settings?.reminder_threshold_days ?? 90}
                        onChange={(e) => handleSettingChange('reminder_threshold_days', parseInt(e.target.value, 10))}
                        disabled={isUpdating}
                        className="block w-32 rounded-lg border border-[#f5ebe0] bg-white py-2 px-3 text-sm text-[#4a3f35] shadow-sm focus:border-[#d6ccc2] focus:outline-none focus:ring-1 focus:ring-[#d6ccc2] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {UNUSED_THRESHOLD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40">
                      <div className="flex-1 pr-4">
                        <label htmlFor="expiration-reminder-inline" className="text-base font-medium text-[#4a3f35]">
                          Expiration Reminder
                        </label>
                        <p className="text-sm text-[#8d7b6d] mt-0.5">
                          Remind before items expire
                        </p>
                      </div>
                      <select
                        id="expiration-reminder-inline"
                        value={settings?.expiration_reminder_days ?? 7}
                        onChange={(e) => handleSettingChange('expiration_reminder_days', parseInt(e.target.value, 10))}
                        disabled={isUpdating}
                        className="block w-40 rounded-lg border border-[#f5ebe0] bg-white py-2 px-3 text-sm text-[#4a3f35] shadow-sm focus:border-[#d6ccc2] focus:outline-none focus:ring-1 focus:ring-[#d6ccc2] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {EXPIRATION_REMINDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

            {settings?.reminder_enabled && (
              <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fcfefc]">
                <div className="flex-1 pr-4">
                  <label htmlFor="expiry-reminder-timing-inline" className="text-base font-medium text-[#4a3f35]">
                    Expiry reminder timing
                  </label>
                </div>
                <select
                  id="expiry-reminder-timing-inline"
                  value={settings?.expiration_reminder_days ?? 7}
                  onChange={(e) => handleSettingChange('expiration_reminder_days', parseInt(e.target.value, 10))}
                  disabled={isUpdating}
                  className="block w-36 rounded-lg border border-[#f5ebe0] bg-white py-2 px-3 text-sm text-[#4a3f35] shadow-sm focus:border-[#d6ccc2] focus:outline-none focus:ring-1 focus:ring-[#d6ccc2] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {EXPIRY_REMINDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {settings?.reminder_enabled && (
              <>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fcfefc]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">
                      Warranty reminders
                    </label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">
                      Alerts before warranty expires
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.warranty_reminder_enabled ?? true}
                    onClick={() => handleSettingChange(
                      'warranty_reminder_enabled',
                      !settings?.warranty_reminder_enabled
                    )}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.warranty_reminder_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.warranty_reminder_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {settings?.warranty_reminder_enabled && (
                  <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fcfefc]">
                    <div className="flex-1 pr-4">
                      <label htmlFor="warranty-reminder-timing-inline" className="text-sm font-medium text-[#4a3f35]">
                        Warranty reminder timing
                      </label>
                    </div>
                    <select
                      id="warranty-reminder-timing-inline"
                      value={settings?.warranty_reminder_days ?? 30}
                      onChange={(e) => handleSettingChange('warranty_reminder_days', parseInt(e.target.value, 10))}
                      disabled={isUpdating}
                      className="block w-40 rounded-lg border border-[#f5ebe0] bg-white py-2 px-3 text-sm text-[#4a3f35] shadow-sm focus:border-[#d6ccc2] focus:outline-none focus:ring-1 focus:ring-[#d6ccc2] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {WARRANTY_REMINDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fcfefc]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">
                      Custom reminders
                    </label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">
                      Notifications for your scheduled reminders
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.custom_reminder_enabled ?? true}
                    onClick={() => handleSettingChange(
                      'custom_reminder_enabled',
                      !settings?.custom_reminder_enabled
                    )}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.custom_reminder_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.custom_reminder_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </>
            )}

            {/* Notification type: Marketplace Notifications */}
            <div className="px-4 py-4 border-b border-[#f5ebe0]/50 bg-[#fff1e8]">
              <p className="text-[11px] font-black text-[#b57f66] uppercase tracking-[0.24em]">
                Marketplace Notifications
              </p>
            </div>
            <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
              <div className="flex-1">
                <label className="text-base font-medium text-[#4a3f35]">Enable Marketplace Notifications</label>
                <p className="text-sm text-[#8d7b6d] mt-0.5">Turn on notifications for marketplace activity</p>
              </div>
              <button
                role="switch"
                aria-checked={isMarketplaceNotificationsEnabled}
                onClick={() => handleMarketplaceNotificationsToggle(!isMarketplaceNotificationsEnabled)}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isMarketplaceNotificationsEnabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMarketplaceNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {isMarketplaceNotificationsEnabled && (
              <>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">New inquiries</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Get notified when someone asks about your listing</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_new_inquiry_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_new_inquiry_enabled', !settings?.marketplace_new_inquiry_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_new_inquiry_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_new_inquiry_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">Purchase requests</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Alerts when someone wants to buy your item</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_purchase_request_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_purchase_request_enabled', !settings?.marketplace_purchase_request_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_purchase_request_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_purchase_request_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">Request accepted</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Updates when a seller accepts your request</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_request_accepted_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_request_accepted_enabled', !settings?.marketplace_request_accepted_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_request_accepted_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_request_accepted_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">Request declined</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Updates when a seller declines your request</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_request_declined_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_request_declined_enabled', !settings?.marketplace_request_declined_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_request_declined_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_request_declined_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">New messages</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Alerts when you receive a marketplace message</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_new_message_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_new_message_enabled', !settings?.marketplace_new_message_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_new_message_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_new_message_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="px-4 py-4 flex items-center justify-between border-b border-[#f5ebe0]/40 bg-[#fffaf6]">
                  <div className="flex-1">
                    <label className="text-base font-medium text-[#4a3f35]">Transaction complete</label>
                    <p className="text-sm text-[#8d7b6d] mt-0.5">Confirmation when a transaction is completed</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings?.marketplace_transaction_complete_enabled ?? true}
                    onClick={() => handleSettingChange('marketplace_transaction_complete_enabled', !settings?.marketplace_transaction_complete_enabled)}
                    disabled={isUpdating}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${settings?.marketplace_transaction_complete_enabled ? 'bg-[#b8cda0]' : 'bg-[#d6ccc2]'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.marketplace_transaction_complete_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Display Section - US-087 */}
        {/* Display Section - US-087 */}
        <section>
          <h2 className="text-xl font-black text-[#4a3f35] tracking-tight mb-4 px-2">
            Display
          </h2>
          <div className="bg-white rounded-[2.5rem] p-6 soft-shadow border border-[#f5ebe0]/40">
            {/* Default View Toggle - Gallery / List */}
            <div className="py-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-base font-medium text-[#4a3f35]">
                    Default View
                  </label>
                  <p className="text-sm text-[#8d7b6d] mt-0.5">
                    Choose how your inventory displays by default
                  </p>
                </div>
                <div className="flex bg-[#f5ebe0]/40 rounded-lg p-1">
                  <button
                    onClick={() => handleSettingChange('default_view', 'gallery')}
                    disabled={isUpdating}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${settings?.default_view === 'gallery'
                      ? 'bg-white text-[#4a3f35] shadow-sm'
                      : 'text-[#8d7b6d] hover:text-[#4a3f35]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Gallery
                  </button>
                  <button
                    onClick={() => handleSettingChange('default_view', 'list')}
                    disabled={isUpdating}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${settings?.default_view === 'list'
                      ? 'bg-white text-[#4a3f35] shadow-sm'
                      : 'text-[#8d7b6d] hover:text-[#4a3f35]'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logout Section */}
        <section className="pb-24">
          <div className="bg-white rounded-[2.5rem] p-2 soft-shadow border border-[#f5ebe0]/40 overflow-hidden">
            <button
              onClick={handleLogoutClick}
              className="w-full px-6 py-6 text-left hover:bg-red-50 transition-colors flex items-center gap-3"
            >
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="text-base font-medium text-red-600">Log out</span>
            </button>
          </div>
        </section>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelLogout}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-[#4a3f35] mb-2">
              Log out?
            </h2>
            <p className="text-[#8d7b6d] mb-6">
              Are you sure you want to log out?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#f5ebe0] text-[#6f5f52] font-medium hover:bg-[#fdf8f2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoggingOut ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Logging out...
                  </>
                ) : (
                  'Log out'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Dialog */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#4a3f35]/35 backdrop-blur-[1px]" onClick={handleCancelEditProfile} />

          {/* Dialog */}
          <div className="relative bg-[#fdf8f2] rounded-[2rem] soft-shadow border border-[#f5ebe0]/70 max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black tracking-tight text-[#4a3f35] mb-5">
              Edit Profile
            </h2>

            {/* Display Name Input */}
            <div className="mb-5">
              <label htmlFor="display-name" className="block text-sm font-black uppercase tracking-[0.12em] text-[#6f5f52] mb-2">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                maxLength={50}
                placeholder="Enter your display name"
                className="w-full px-4 py-3 border border-[#e8dbcf] rounded-xl bg-white/90 text-[#4a3f35] focus:outline-none focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] soft-shadow"
                autoFocus
              />
              <p className="text-xs text-[#8d7b6d] mt-1">Up to 50 characters</p>
            </div>

            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-black uppercase tracking-[0.12em] text-[#6f5f52] mb-2">
                Email Address
              </label>
              <p className="px-4 py-3 bg-[#f3ece4] rounded-xl text-[#6f5f52] border border-[#e8dbcf]">
                {user?.email}
              </p>
              <p className="text-xs text-[#8d7b6d] mt-1">Email cannot be changed</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelEditProfile}
                disabled={isSavingName}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#d8cfc4] bg-white/80 text-[#4a3f35] font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditProfile}
                disabled={isSavingName || !editingName.trim() || editingName.trim().length > 50}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#d6ccc2] text-[#4a3f35] font-semibold hover:bg-[#c8b9ab] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSavingName ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#4a3f35]"
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
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
