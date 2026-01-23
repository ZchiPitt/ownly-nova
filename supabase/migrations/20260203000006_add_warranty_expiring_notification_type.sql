-- Migration: Add warranty_expiring notification type and user settings
-- Description: Extend notifications table for warranty expiry alerts and add warranty reminder preferences
-- Created: 2026-02-03

-- Extend notifications table for warranty_expiring notification type
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
      'transaction_complete',
      'warranty_expiring'
    )
  );

COMMENT ON COLUMN notifications.type IS 'Notification type: unused_item, expiring_item, warranty_expiring, system, and marketplace event types';

-- Add warranty reminder settings to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS warranty_reminder_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS warranty_reminder_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_settings.warranty_reminder_days IS 'Days before warranty expiration to send reminder (default 30)';
COMMENT ON COLUMN user_settings.warranty_reminder_enabled IS 'Whether warranty expiration reminders are enabled';
