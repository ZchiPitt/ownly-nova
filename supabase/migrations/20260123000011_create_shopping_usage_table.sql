-- Migration: Create shopping_usage table for rate limiting
-- Description: Tracks daily usage of the shopping assistant feature per user
-- Created: 2026-01-23

-- Create shopping_usage table to track daily API usage
CREATE TABLE IF NOT EXISTS shopping_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date date NOT NULL DEFAULT CURRENT_DATE,
    photo_count integer NOT NULL DEFAULT 0,
    text_count integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Unique constraint on user_id + date to ensure one record per user per day
    CONSTRAINT shopping_usage_user_date_unique UNIQUE (user_id, usage_date)
);

-- Add comments for documentation
COMMENT ON TABLE shopping_usage IS 'Tracks daily usage of the shopping assistant feature for rate limiting';
COMMENT ON COLUMN shopping_usage.user_id IS 'Reference to the user';
COMMENT ON COLUMN shopping_usage.usage_date IS 'The date this usage record is for (UTC)';
COMMENT ON COLUMN shopping_usage.photo_count IS 'Number of photo analyses performed today';
COMMENT ON COLUMN shopping_usage.text_count IS 'Number of text follow-up questions asked today';

-- Enable Row Level Security
ALTER TABLE shopping_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only view their own usage
CREATE POLICY "Users can view own shopping usage"
    ON shopping_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users cannot directly insert/update usage (only via Edge Functions using service role)
-- Service role key bypasses RLS, so no insert/update policies needed for users

-- Create index for faster lookups by user_id and date
CREATE INDEX IF NOT EXISTS idx_shopping_usage_user_date
    ON shopping_usage(user_id, usage_date);

-- Add updated_at trigger
CREATE TRIGGER update_shopping_usage_updated_at
    BEFORE UPDATE ON shopping_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment photo usage (called by Edge Function)
CREATE OR REPLACE FUNCTION increment_shopping_photo_usage(
    p_user_id uuid,
    p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO shopping_usage (user_id, usage_date, photo_count)
    VALUES (p_user_id, p_date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        photo_count = shopping_usage.photo_count + 1,
        updated_at = now();
END;
$$;

-- Create function to increment text usage (called by Edge Function)
CREATE OR REPLACE FUNCTION increment_shopping_text_usage(
    p_user_id uuid,
    p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO shopping_usage (user_id, usage_date, text_count)
    VALUES (p_user_id, p_date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        text_count = shopping_usage.text_count + 1,
        updated_at = now();
END;
$$;

-- Add comments for functions
COMMENT ON FUNCTION increment_shopping_photo_usage IS 'Increments the photo analysis count for a user on a given date. Used by shopping-analyze Edge Function.';
COMMENT ON FUNCTION increment_shopping_text_usage IS 'Increments the text question count for a user on a given date. Used by shopping follow-up Edge Function.';
