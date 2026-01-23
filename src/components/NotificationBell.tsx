/**
 * Notification Bell Component
 * Shows bell icon with unread notification count badge
 * Used in Dashboard and Inventory headers
 */

import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell() {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  const handleClick = () => {
    navigate('/notifications');
  };

  // Format badge text - show 9+ for counts greater than 9
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <button
      onClick={handleClick}
      className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#8d7b6d] hover:bg-[#fdf8f2] transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      {/* Bell icon */}
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
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
          {badgeText}
        </span>
      )}
    </button>
  );
}
