-- Migration: Add notification_sound_enabled column to user_settings
-- US-020: Add notification sound and vibration

-- Add notification_sound_enabled column with default true
-- This controls whether push notifications play sound/vibrate
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment to document the column
COMMENT ON COLUMN user_settings.notification_sound_enabled IS 'Whether push notifications should play sound and vibrate (default: true)';
