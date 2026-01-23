/**
 * Notifications Page - View and manage in-app notifications
 * Shows list of notifications with unread indicators and mark as read functionality
 * Organized into Messages and Reminders tabs with unread count badges
 */

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useReviews, type PendingReviewTransaction } from '@/hooks/useReviews';
import { ReviewModal } from '@/components/ReviewModal';
import type { MarketplaceNotificationType } from '@/lib/notifications';
import type { Notification, NotificationData, NotificationType } from '@/types';

// Tab definitions
type NotificationTab = 'messages' | 'reminders';

// Notification types for each tab
const MESSAGE_TYPES: NotificationType[] = [
  'new_inquiry',
  'purchase_request',
  'request_accepted',
  'request_declined',
  'new_message',
  'transaction_complete',
];

const REMINDER_TYPES: NotificationType[] = [
  'unused_item',
  'expiring_item',
  'warranty_expiring',
  'custom_reminder',
  'system',
];

const MARKETPLACE_TYPES: MarketplaceNotificationType[] = [
  'new_inquiry',
  'purchase_request',
  'request_accepted',
  'request_declined',
  'new_message',
  'transaction_complete',
];

const MARKETPLACE_ICONS: Record<MarketplaceNotificationType, string> = {
  new_inquiry: '💬',
  purchase_request: '🛒',
  request_accepted: '✅',
  request_declined: '❌',
  new_message: '💬',
  transaction_complete: '🎉',
};

const MARKETPLACE_ICON_COLORS: Record<MarketplaceNotificationType, string> = {
  new_inquiry: 'text-sky-600 bg-sky-100',
  purchase_request: 'text-indigo-600 bg-indigo-100',
  request_accepted: 'text-emerald-600 bg-emerald-100',
  request_declined: 'text-rose-600 bg-rose-100',
  new_message: 'text-sky-600 bg-sky-100',
  transaction_complete: 'text-amber-600 bg-amber-100',
};

function isMarketplaceType(type: NotificationType): type is MarketplaceNotificationType {
  return MARKETPLACE_TYPES.includes(type as MarketplaceNotificationType);
}

/**
 * Get relative time string from date
 */
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Date group types for notification grouping
 */
type DateGroup = 'today' | 'yesterday' | 'this_week' | 'earlier';

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  earlier: 'Earlier',
};

/**
 * Determine which date group a notification belongs to
 */
function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString);
  const now = new Date();

  // Reset time components for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Calculate start of this week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - today.getDay());

  const notificationDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notificationDate.getTime() >= today.getTime()) {
    return 'today';
  } else if (notificationDate.getTime() >= yesterday.getTime()) {
    return 'yesterday';
  } else if (notificationDate.getTime() >= startOfWeek.getTime()) {
    return 'this_week';
  } else {
    return 'earlier';
  }
}

/**
 * Group notifications by date
 */
function groupNotificationsByDate(notifications: Notification[]): Map<DateGroup, Notification[]> {
  const groups = new Map<DateGroup, Notification[]>();

  // Initialize all groups to maintain order
  const groupOrder: DateGroup[] = ['today', 'yesterday', 'this_week', 'earlier'];
  groupOrder.forEach(group => groups.set(group, []));

  // Notifications are already sorted by created_at (newest first)
  // Group them while maintaining that order within each group
  notifications.forEach(notification => {
    const group = getDateGroup(notification.created_at);
    groups.get(group)!.push(notification);
  });

  return groups;
}

/**
 * Get icon component based on notification type
 */
function NotificationIcon({ type }: { type: NotificationType }) {
  if (isMarketplaceType(type)) {
    return (
      <span className="text-lg leading-none" aria-hidden="true">
        {MARKETPLACE_ICONS[type]}
      </span>
    );
  }

  switch (type) {
    case 'unused_item':
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
    case 'expiring_item':
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'warranty_expiring':
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
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case 'custom_reminder':
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      );
    case 'system':
    default:
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
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

/**
 * Get icon color classes based on notification type
 */
function getIconColorClasses(type: NotificationType): string {
  if (isMarketplaceType(type)) {
    return MARKETPLACE_ICON_COLORS[type];
  }

  switch (type) {
    case 'unused_item':
      return 'text-[#4a3f35] bg-[#f5ebe0]';
    case 'expiring_item':
      return 'text-amber-600 bg-amber-100';
    case 'warranty_expiring':
      return 'text-purple-600 bg-purple-100';
    case 'custom_reminder':
      return 'text-[#6f5f52] bg-teal-100';
    case 'system':
    default:
      return 'text-[#8d7b6d] bg-[#f3ece4]';
  }
}

/**
 * Skeleton component for notification item loading state
 */
function NotificationItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 bg-white border-b border-[#f5ebe0]/50">
      {/* Icon skeleton */}
      <div className="w-10 h-10 rounded-full bg-[#efe6dc] animate-pulse flex-shrink-0" />
      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <div className="w-3/4 h-4 bg-[#efe6dc] rounded animate-pulse mb-2" />
        <div className="w-full h-3 bg-[#efe6dc] rounded animate-pulse mb-2" />
        <div className="w-20 h-3 bg-[#efe6dc] rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Swipe-to-delete threshold in pixels
 */
const SWIPE_DELETE_THRESHOLD = 80;

/**
 * Notification item component with swipe-to-delete
 */
interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: () => Promise<void>;
}

function NotificationItem({ notification, onClick, onDelete }: NotificationItemProps) {
  const isUnread = !notification.is_read;
  const iconColorClasses = getIconColorClasses(notification.type);

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDeleting) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  }, [isDeleting]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || isDeleting) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 10 || absY > 10) {
        isHorizontalSwipe.current = absX > absY;
      }
    }

    // Only handle horizontal swipes (left swipe = negative diffX)
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      setIsSwiping(true);
      // Only allow left swipe (negative offset), apply some resistance
      const offset = Math.min(0, diffX * 0.8);
      setSwipeOffset(Math.max(offset, -SWIPE_DELETE_THRESHOLD * 1.5));
    }
  }, [isDeleting]);

  const handleTouchEnd = useCallback(async () => {
    if (isDeleting) return;

    const shouldDelete = swipeOffset <= -SWIPE_DELETE_THRESHOLD;

    if (shouldDelete) {
      // Animate out and delete
      setIsDeleting(true);
      setSwipeOffset(-window.innerWidth);

      // Wait for animation, then delete
      setTimeout(async () => {
        try {
          await onDelete();
        } catch {
          // Reset if delete failed
          setSwipeOffset(0);
          setIsDeleting(false);
        }
      }, 200);
    } else {
      // Snap back
      setSwipeOffset(0);
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
    setIsSwiping(false);
  }, [swipeOffset, onDelete, isDeleting]);

  const handleDeleteClick = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setSwipeOffset(-window.innerWidth);

    setTimeout(async () => {
      try {
        await onDelete();
      } catch {
        setSwipeOffset(0);
        setIsDeleting(false);
      }
    }, 200);
  }, [onDelete, isDeleting]);

  const handleContentClick = useCallback(() => {
    // Only trigger click if not swiping
    if (Math.abs(swipeOffset) < 5 && !isSwiping) {
      onClick();
    }
  }, [swipeOffset, isSwiping, onClick]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Delete action background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500"
        style={{ width: Math.max(-swipeOffset, SWIPE_DELETE_THRESHOLD) }}
      >
        <button
          onClick={handleDeleteClick}
          className="h-full px-6 flex items-center justify-center text-white font-medium"
          aria-label="Delete notification"
        >
          <svg
            className="w-5 h-5 mr-1"
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
          Delete
        </button>
      </div>

      {/* Notification content */}
      <div
        onClick={handleContentClick}
        className={`relative flex items-start gap-3 p-4 text-left transition-transform border-b border-[#f5ebe0]/50 cursor-pointer ${
          isUnread ? 'bg-[#fdf8f2]' : 'bg-white'
        } ${!isSwiping ? 'transition-transform duration-200' : ''}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {/* Type icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColorClasses}`}
        >
          <NotificationIcon type={notification.type} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Title */}
            <p
              className={`text-sm flex-1 ${
                isUnread ? 'font-semibold text-[#4a3f35]' : 'font-medium text-[#6f5f52]'
              }`}
            >
              {notification.title}
            </p>

            {/* Unread indicator */}
            {isUnread && (
              <div className="w-2 h-2 rounded-full bg-[#4a3f35] flex-shrink-0 mt-1.5" />
            )}
          </div>

          {/* Body preview */}
          {notification.body && (
            <p className="text-sm text-[#8d7b6d] mt-0.5 line-clamp-2">
              {notification.body}
            </p>
          )}

          {/* Relative time */}
          <p className="text-xs text-[#b9a99b] mt-1">
            {getRelativeTime(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ tab }: { tab: NotificationTab }) {
  const isMessages = tab === 'messages';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Icon with muted styling */}
      <div className="w-16 h-16 mb-4 bg-[#f3ece4] rounded-full flex items-center justify-center">
        {isMessages ? (
          <svg
            className="w-8 h-8 text-[#b9a99b]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        ) : (
          <svg
            className="w-8 h-8 text-[#b9a99b]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}
      </div>

      <h2 className="text-lg font-medium text-[#4a3f35] mb-1">
        {isMessages ? 'No messages yet' : 'No reminders yet'}
      </h2>
      <p className="text-sm text-[#8d7b6d] max-w-xs">
        {isMessages
          ? 'When you receive messages from buyers or sellers, they\'ll appear here.'
          : 'When you receive reminders about your items, they\'ll appear here.'}
      </p>
    </div>
  );
}

/**
 * Banner shown when push notifications are blocked
 * Provides platform-specific instructions for enabling notifications
 */
function NotificationsDeniedBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mx-4 mt-4 bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
      <div className="p-4">
        <div className="flex gap-3">
          {/* Warning icon */}
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-amber-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="flex-1">
            {/* Main message */}
            <h3 className="text-sm font-semibold text-amber-800">
              Push notifications are disabled
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              You won't receive alerts for new messages or reminders outside the app.
            </p>

            {/* Toggle for instructions */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 flex items-center gap-1"
            >
              {isExpanded ? 'Hide instructions' : 'How to enable'}
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expanded instructions */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <p className="text-sm text-amber-700 mb-3">
              To receive push notifications, enable them in your browser settings:
            </p>
            <ul className="space-y-3 text-sm text-amber-700">
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-200 rounded-full text-xs font-semibold text-amber-800 flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-amber-800">Chrome (Desktop):</strong>{' '}
                  Click the lock/tune icon in the address bar → Site settings → Notifications → Allow
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-200 rounded-full text-xs font-semibold text-amber-800 flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-amber-800">Safari (Mac):</strong>{' '}
                  Safari menu → Settings → Websites → Notifications → Find this site → Allow
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-200 rounded-full text-xs font-semibold text-amber-800 flex-shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-amber-800">Firefox:</strong>{' '}
                  Click the lock icon in the address bar → Clear "Notifications" permission → Reload page
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-200 rounded-full text-xs font-semibold text-amber-800 flex-shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <strong className="text-amber-800">Mobile (iOS/Android):</strong>{' '}
                  Open device Settings → Find this app or browser → Enable Notifications
                </div>
              </li>
            </ul>

            {/* Link to Settings page */}
            <div className="mt-4 pt-3 border-t border-amber-200">
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-900"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Go to notification settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    notifications,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const { getPendingReviews } = useReviews();
  const { permissionState, isSupported: isPushSupported } = usePushNotifications();

  const [pendingReviews, setPendingReviews] = useState<PendingReviewTransaction[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PendingReviewTransaction | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Calculate unread counts per tab and group notifications by date
  const { messagesUnreadCount, remindersUnreadCount, filteredNotifications, groupedNotifications, activeTab } = useMemo(() => {
    const messagesUnread = notifications.filter(
      (n) => MESSAGE_TYPES.includes(n.type) && !n.is_read
    ).length;
    const remindersUnread = notifications.filter(
      (n) => REMINDER_TYPES.includes(n.type) && !n.is_read
    ).length;

    // Determine active tab from URL param or default based on unread
    const tabParam = searchParams.get('tab') as NotificationTab | null;
    let tab: NotificationTab;
    if (tabParam === 'messages' || tabParam === 'reminders') {
      tab = tabParam;
    } else {
      // Default: messages if any unread messages exist, otherwise reminders
      tab = messagesUnread > 0 ? 'messages' : 'reminders';
    }

    // Filter notifications based on active tab
    const types = tab === 'messages' ? MESSAGE_TYPES : REMINDER_TYPES;
    const filtered = notifications.filter((n) => types.includes(n.type));

    // Group filtered notifications by date
    const grouped = groupNotificationsByDate(filtered);

    return {
      messagesUnreadCount: messagesUnread,
      remindersUnreadCount: remindersUnread,
      filteredNotifications: filtered,
      groupedNotifications: grouped,
      activeTab: tab,
    };
  }, [notifications, searchParams]);

  // Handle tab change
  const handleTabChange = useCallback((tab: NotificationTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  const fetchPendingReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const data = await getPendingReviews();
      setPendingReviews(data);
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [getPendingReviews]);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  const getNotificationTarget = (notification: Notification): string | null => {
    const data = notification.data as NotificationData | null;
    const listingId = data?.listing_id;

    if (notification.type === 'new_message' || notification.type === 'request_accepted') {
      return listingId ? `/messages/${listingId}` : null;
    }

    if (
      notification.type === 'new_inquiry' ||
      notification.type === 'purchase_request' ||
      notification.type === 'request_declined' ||
      notification.type === 'transaction_complete'
    ) {
      return listingId ? `/marketplace/${listingId}` : null;
    }

    if (notification.item_id) {
      return `/item/${notification.item_id}`;
    }

    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    const target = getNotificationTarget(notification);
    if (target) {
      navigate(target);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleOpenReview = (review: PendingReviewTransaction) => {
    setSelectedReview(review);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    fetchPendingReviews();
  };

  return (
    <div className="min-h-full bg-[#fdf8f2]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#8d7b6d] hover:bg-[#f3ece4] transition-colors"
              aria-label="Go back"
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

            {/* Title */}
            <h1 className="text-xl font-semibold text-[#4a3f35]">Notifications</h1>
          </div>

          {/* Mark All Read link */}
          {(messagesUnreadCount > 0 || remindersUnreadCount > 0) && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-[#4a3f35] hover:text-[#3d332b]"
            >
              Mark All Read
            </button>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex border-t border-[#f5ebe0]/50">
          <button
            onClick={() => handleTabChange('messages')}
            className={`flex-1 relative py-3 text-sm font-medium transition-colors ${
              activeTab === 'messages'
                ? 'text-[#4a3f35]'
                : 'text-[#8d7b6d] hover:text-[#6f5f52]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              Messages
              {messagesUnreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-[#4a3f35] rounded-full">
                  {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                </span>
              )}
            </span>
            {activeTab === 'messages' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a3f35]" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('reminders')}
            className={`flex-1 relative py-3 text-sm font-medium transition-colors ${
              activeTab === 'reminders'
                ? 'text-[#4a3f35]'
                : 'text-[#8d7b6d] hover:text-[#6f5f52]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              Reminders
              {remindersUnreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-[#4a3f35] rounded-full">
                  {remindersUnreadCount > 99 ? '99+' : remindersUnreadCount}
                </span>
              )}
            </span>
            {activeTab === 'reminders' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a3f35]" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        {/* Notification permission denied banner */}
        {isPushSupported && permissionState === 'denied' && (
          <NotificationsDeniedBanner />
        )}

        <div className="px-4 pt-4">
          <div className="bg-white border border-[#f5ebe0]/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#4a3f35]">Pending Reviews</h2>
              {isLoadingReviews && <span className="text-xs text-[#8d7b6d]">Loading...</span>}
            </div>
            {pendingReviews.length === 0 ? (
              <p className="text-sm text-[#8d7b6d]">You're all caught up.</p>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-[#f5ebe0]/60 rounded-xl p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#4a3f35]">
                        How was your experience with {review.other_user.display_name ?? 'this member'}?
                      </p>
                      <p className="text-xs text-[#8d7b6d] mt-1">
                        {review.listing.item_name ?? 'Transaction'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReview(review)}
                      className="px-3 py-2 text-xs font-semibold text-[#4a3f35] bg-[#e3ead3] border border-[#d7e1c2] rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      Leave Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          // Loading skeletons
          <div>
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
            <NotificationItemSkeleton />
          </div>
        ) : error ? (
          // Error state
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="w-16 h-16 mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[#4a3f35] mb-1">
              Couldn't load notifications
            </h2>
            <p className="text-sm text-[#8d7b6d]">{error}</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty state
          <EmptyState tab={activeTab} />
        ) : (
          // Notifications list grouped by date
          <div>
            {(['today', 'yesterday', 'this_week', 'earlier'] as const).map((group) => {
              const groupNotifications = groupedNotifications.get(group) || [];
              if (groupNotifications.length === 0) return null;

              return (
                <div key={group}>
                  {/* Section header */}
                  <div className="sticky top-[116px] z-[5] px-4 py-2 bg-[#f3ece4] border-b border-[#f5ebe0]/60">
                    <h3 className="text-xs font-semibold text-[#8d7b6d] uppercase tracking-wider">
                      {DATE_GROUP_LABELS[group]}
                    </h3>
                  </div>
                  {/* Notifications in this group */}
                  {groupNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                      onDelete={() => deleteNotification(notification.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedReview && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          transaction={{
            id: selectedReview.id,
            listing: { item_name: selectedReview.listing.item_name },
            other_user: {
              id: selectedReview.other_user.id,
              display_name: selectedReview.other_user.display_name,
            },
          }}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
