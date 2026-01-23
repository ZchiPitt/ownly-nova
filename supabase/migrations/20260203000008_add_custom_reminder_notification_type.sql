-- Migration: Add custom_reminder notification type and item reminder fields
-- Description: Support custom item reminders that fire once on the specified date
-- Created: 2026-02-03

-- Extend notifications table for custom_reminder notification type
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
      'warranty_expiring',
      'custom_reminder'
    )
  );

COMMENT ON COLUMN notifications.type IS 'Notification type: unused_item, expiring_item, warranty_expiring, custom_reminder, system, and marketplace event types';

-- Add reminder fields to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS reminder_date date,
  ADD COLUMN IF NOT EXISTS reminder_note text,
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Index for efficient reminder queries
CREATE INDEX IF NOT EXISTS items_reminder_date_idx ON items(reminder_date) WHERE reminder_date IS NOT NULL AND reminder_sent = false;

COMMENT ON COLUMN items.reminder_date IS 'Date when custom reminder should fire';
COMMENT ON COLUMN items.reminder_note IS 'Custom note to include in the reminder notification';
COMMENT ON COLUMN items.reminder_sent IS 'Whether the reminder notification has been sent (prevents re-firing)';
