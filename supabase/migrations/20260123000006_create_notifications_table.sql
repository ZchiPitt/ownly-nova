-- Migration: Create notifications table for reminder system
-- Description: Table for storing user notifications including unused item reminders, expiring item alerts, and system notifications.
-- Created: 2026-01-23

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type varchar(30) NOT NULL CHECK (type IN ('unused_item', 'expiring_item', 'system')),
    title varchar(200) NOT NULL,
    body text,
    item_id uuid REFERENCES items(id) ON DELETE CASCADE,
    is_read boolean NOT NULL DEFAULT false,
    is_pushed boolean NOT NULL DEFAULT false,
    pushed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx ON notifications(user_id, is_read);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can insert their own notifications (for system-generated notifications via functions)
CREATE POLICY "Users can insert own notifications"
    ON notifications
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications
    FOR DELETE
    USING (user_id = auth.uid());

-- Comment on table and columns for documentation
COMMENT ON TABLE notifications IS 'User notifications including unused item reminders, expiration alerts, and system messages.';
COMMENT ON COLUMN notifications.id IS 'Unique notification identifier';
COMMENT ON COLUMN notifications.user_id IS 'Reference to auth.users.id - recipient of this notification';
COMMENT ON COLUMN notifications.type IS 'Notification type: unused_item (not viewed in threshold), expiring_item (approaching expiration), system (general messages)';
COMMENT ON COLUMN notifications.title IS 'Notification title/headline (max 200 characters)';
COMMENT ON COLUMN notifications.body IS 'Notification body text with details';
COMMENT ON COLUMN notifications.item_id IS 'Reference to items.id - related item (nullable for system notifications)';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the user';
COMMENT ON COLUMN notifications.is_pushed IS 'Whether a push notification was sent for this notification';
COMMENT ON COLUMN notifications.pushed_at IS 'Timestamp when push notification was sent (if applicable)';
COMMENT ON COLUMN notifications.created_at IS 'Timestamp when notification was created';
