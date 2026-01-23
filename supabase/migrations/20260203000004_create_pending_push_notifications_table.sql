-- Migration: Create pending_push_notifications table for message batching
-- Description: Queue for batching rapid messages from same sender before sending push
-- US-005: Implement message batching for rapid messages
-- Created: 2026-02-03

-- Create table for pending push notifications (batching queue)
CREATE TABLE IF NOT EXISTS pending_push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,                    -- Profile ID of message sender
  sender_name TEXT,                           -- Cached sender display name
  listing_id UUID NOT NULL,                   -- Listing the conversation is about
  item_name TEXT,                             -- Cached item name
  message_count INT NOT NULL DEFAULT 1,       -- Number of messages in this batch
  first_message_preview TEXT,                 -- Preview of first message in batch
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- When first message in batch arrived
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- When last message in batch arrived
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint: one pending batch per (user, sender, listing) combination
  CONSTRAINT unique_pending_batch UNIQUE (user_id, sender_id, listing_id)
);

-- Create index for efficient lookups by user_id
CREATE INDEX idx_pending_push_user_id ON pending_push_notifications(user_id);

-- Create index for finding batches ready to send (older than 5 seconds)
CREATE INDEX idx_pending_push_ready ON pending_push_notifications(last_message_at);

-- Enable RLS
ALTER TABLE pending_push_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage their own pending notifications
CREATE POLICY "Users can view own pending notifications"
  ON pending_push_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending notifications"
  ON pending_push_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role and triggers can insert/update (handled by SECURITY DEFINER functions)
-- No INSERT/UPDATE policy for regular users since this is managed by triggers

-- Add comment
COMMENT ON TABLE pending_push_notifications IS 'Queue for batching rapid messages from same sender before sending push notification. Messages from same sender within 5 seconds are batched into single notification.';
COMMENT ON COLUMN pending_push_notifications.message_count IS 'Number of messages accumulated in this batch';
COMMENT ON COLUMN pending_push_notifications.first_message_preview IS 'Preview of the first message (up to 50 chars) for the batched notification';
COMMENT ON COLUMN pending_push_notifications.first_message_at IS 'Timestamp of first message in batch, used to ensure batch is eventually sent';
COMMENT ON COLUMN pending_push_notifications.last_message_at IS 'Timestamp of last message, used to detect 5-second batching window';
