-- Migration: Add marketplace notification types and user settings
-- Description: Extend notifications table for marketplace events and add notification preferences
-- Created: 2026-02-01

-- Extend notifications table for marketplace notification types
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'unused_item',
      'expiring_item',
      'system',
      'new_inquiry',
      'purchase_request',
      'request_accepted',
      'request_declined',
      'new_message',
      'transaction_complete'
    )
  );

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS data jsonb;

COMMENT ON COLUMN notifications.type IS 'Notification type: unused_item, expiring_item, system, and marketplace event types';
COMMENT ON COLUMN notifications.data IS 'Notification payload for marketplace events (listing_id, transaction_id, sender_id, sender_name, item_name)';

-- Marketplace notification preferences
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS marketplace_new_inquiry_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_purchase_request_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_request_accepted_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_request_declined_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_new_message_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace_transaction_complete_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_settings.marketplace_new_inquiry_enabled IS 'Whether marketplace inquiry notifications are enabled';
COMMENT ON COLUMN user_settings.marketplace_purchase_request_enabled IS 'Whether marketplace purchase request notifications are enabled';
COMMENT ON COLUMN user_settings.marketplace_request_accepted_enabled IS 'Whether marketplace request accepted notifications are enabled';
COMMENT ON COLUMN user_settings.marketplace_request_declined_enabled IS 'Whether marketplace request declined notifications are enabled';
COMMENT ON COLUMN user_settings.marketplace_new_message_enabled IS 'Whether marketplace new message notifications are enabled';
COMMENT ON COLUMN user_settings.marketplace_transaction_complete_enabled IS 'Whether marketplace transaction complete notifications are enabled';
