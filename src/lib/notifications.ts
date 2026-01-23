/**
 * Notifications helper for in-app notifications
 */

import { supabase } from '@/lib/supabase';
import type { NotificationType } from '@/types/database';

export type MarketplaceNotificationType =
  | 'new_inquiry'
  | 'purchase_request'
  | 'request_accepted'
  | 'request_declined'
  | 'new_message'
  | 'transaction_complete';

export interface MarketplaceNotificationData {
  listing_id?: string;
  transaction_id?: string;
  sender_id?: string;
  sender_name?: string;
  item_name?: string;
  /** Message preview for new_message notifications (first 50 chars) */
  message_preview?: string;
}

export interface MarketplaceNotification {
  id: string;
  user_id: string;
  type: MarketplaceNotificationType;
  title: string;
  body: string;
  data: MarketplaceNotificationData;
  read_at: string | null;
  created_at: string;
}

function getNotificationContent(
  type: MarketplaceNotificationType,
  data: MarketplaceNotificationData
): { title: string; body: string } {
  const senderName = data.sender_name ?? 'Someone';
  const itemName = data.item_name ?? 'an item';

  switch (type) {
    case 'new_inquiry':
      // Push format: 'New inquiry from {buyer}' / '{item_name}'
      return {
        title: `New inquiry from ${senderName}`,
        body: itemName,
      };
    case 'purchase_request':
      // Push format: '{buyer} wants to buy {item_name}'
      return {
        title: `${senderName} wants to buy ${itemName}`,
        body: `Tap to view the purchase request`,
      };
    case 'request_accepted':
      // Push format: '{seller} accepted your request for {item_name}'
      return {
        title: `${senderName} accepted your request`,
        body: `Your request for ${itemName} was accepted`,
      };
    case 'request_declined':
      // Push format: '{seller} declined your request'
      return {
        title: `${senderName} declined your request`,
        body: `Your purchase request was declined`,
      };
    case 'new_message': {
      // Format: "New message from {sender_name}" / message preview (first 50 chars)
      const messagePreview = data.message_preview ?? '';
      const truncatedPreview = messagePreview.length > 50
        ? `${messagePreview.slice(0, 50)}...`
        : messagePreview;
      return {
        title: `New message from ${senderName}`,
        body: truncatedPreview || `Message about ${itemName}`,
      };
    }
    case 'transaction_complete':
      // Push format: 'Transaction complete! Leave a review'
      return {
        title: 'Transaction complete!',
        body: 'Leave a review for this transaction',
      };
    default:
      return {
        title: 'Notification',
        body: `You have a new notification`,
      };
  }
}

export async function createMarketplaceNotification(
  recipientUserId: string,
  type: MarketplaceNotificationType,
  data: MarketplaceNotificationData
): Promise<void> {
  const { title, body } = getNotificationContent(type, data);
  const dbType: NotificationType = type;

  const { error } = await (supabase.from('notifications') as ReturnType<typeof supabase.from>)
    .insert({
      user_id: recipientUserId,
      type: dbType,
      title,
      body,
      item_id: null,
      data,
    } as Record<string, unknown>);

  if (error) {
    throw new Error(error.message);
  }
}
