-- Migration: Add custom_reminder_enabled to user_settings
-- US-014: Add per-category notification toggles

-- Add custom_reminder_enabled column to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS custom_reminder_enabled boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.custom_reminder_enabled IS 'Whether to receive custom reminder notifications';
