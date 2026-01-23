-- Migration: Create user_settings table
-- Description: Stores user personalization preferences for reminders and display options
-- Created: 2026-01-23

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    reminder_enabled boolean NOT NULL DEFAULT true,
    reminder_threshold_days integer NOT NULL DEFAULT 90,
    expiration_reminder_days integer NOT NULL DEFAULT 7,
    push_notifications_enabled boolean NOT NULL DEFAULT false,
    default_view varchar(20) NOT NULL DEFAULT 'gallery',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS user_settings_user_id_idx ON user_settings(user_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own settings
CREATE POLICY "Users can view own settings"
    ON user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only update their own settings
CREATE POLICY "Users can update own settings"
    ON user_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can insert their own settings (needed for the trigger or manual creation)
CREATE POLICY "Users can insert own settings"
    ON user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Trigger to automatically update updated_at on row update
-- Note: update_updated_at_column() function already exists from profiles migration
CREATE TRIGGER user_settings_updated_at_trigger
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create user settings when a new profile is created
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user_settings on profiles insert
CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_profile();

-- Comment on table and columns for documentation
COMMENT ON TABLE user_settings IS 'User personalization preferences for reminders and display options';
COMMENT ON COLUMN user_settings.id IS 'Unique settings identifier';
COMMENT ON COLUMN user_settings.user_id IS 'Reference to auth.users.id';
COMMENT ON COLUMN user_settings.reminder_enabled IS 'Master toggle for all reminder notifications';
COMMENT ON COLUMN user_settings.reminder_threshold_days IS 'Days of inactivity before unused item reminder (default 90)';
COMMENT ON COLUMN user_settings.expiration_reminder_days IS 'Days before expiration to send reminder (default 7)';
COMMENT ON COLUMN user_settings.push_notifications_enabled IS 'Whether push notifications are enabled';
COMMENT ON COLUMN user_settings.default_view IS 'Default inventory view mode: gallery or list';
COMMENT ON COLUMN user_settings.created_at IS 'Timestamp when settings were created';
COMMENT ON COLUMN user_settings.updated_at IS 'Timestamp when settings were last updated';
