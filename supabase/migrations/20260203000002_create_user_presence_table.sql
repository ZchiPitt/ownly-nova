-- Migration: Create user_presence table for smart push suppression
-- Description: Tracks user presence on specific listings to suppress redundant push notifications
-- Created: 2026-02-03

-- Create user_presence table
CREATE TABLE IF NOT EXISTS user_presence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    active_listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
    last_seen timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on user_id for faster lookups (unique per user)
CREATE UNIQUE INDEX IF NOT EXISTS user_presence_user_id_idx ON user_presence(user_id);

-- Create index on active_listing_id for presence queries
CREATE INDEX IF NOT EXISTS user_presence_listing_id_idx ON user_presence(active_listing_id) WHERE active_listing_id IS NOT NULL;

-- Create index for checking recent presence (within last 30 seconds)
CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON user_presence(last_seen);

-- Enable Row Level Security
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own presence
CREATE POLICY "Users can view own presence"
    ON user_presence
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own presence
CREATE POLICY "Users can insert own presence"
    ON user_presence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own presence
CREATE POLICY "Users can update own presence"
    ON user_presence
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own presence
CREATE POLICY "Users can delete own presence"
    ON user_presence
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy: Service role can read all presence (for push suppression check)
CREATE POLICY "Service role can read all presence"
    ON user_presence
    FOR SELECT
    TO service_role
    USING (true);

-- Trigger to automatically update updated_at on row update
-- Note: update_updated_at_column() function already exists from profiles migration
CREATE TRIGGER user_presence_updated_at_trigger
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on table and columns for documentation
COMMENT ON TABLE user_presence IS 'Tracks user presence on specific listings for smart push notification suppression';
COMMENT ON COLUMN user_presence.id IS 'Unique presence record identifier';
COMMENT ON COLUMN user_presence.user_id IS 'Reference to auth.users.id';
COMMENT ON COLUMN user_presence.active_listing_id IS 'The listing the user is currently viewing (null if not viewing any)';
COMMENT ON COLUMN user_presence.last_seen IS 'When the user was last seen active on this listing';
COMMENT ON COLUMN user_presence.updated_at IS 'Timestamp when presence was last updated';
