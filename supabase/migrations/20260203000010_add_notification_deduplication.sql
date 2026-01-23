-- Migration: Add notification deduplication via event_key
-- Description: Adds event_key column for preventing duplicate notifications
-- Created: 2026-02-03

-- Add event_key column for deduplication
-- Format: {type}:{item_id}:{timestamp_bucket}
-- timestamp_bucket is the date (YYYY-MM-DD) for 24-hour deduplication
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key TEXT;

-- Create index for efficient duplicate checking
-- Partial index only for non-null event_keys
CREATE INDEX IF NOT EXISTS notifications_event_key_idx
ON notifications(event_key)
WHERE event_key IS NOT NULL;

-- Create a unique constraint that prevents duplicates within the same day
-- This is enforced via a trigger function since we need time-based deduplication
-- (unique constraint alone can't express "unique within 24 hours")

-- Function to generate event_key from notification data
-- Used by trigger and can be called manually
CREATE OR REPLACE FUNCTION generate_notification_event_key(
    p_type TEXT,
    p_item_id UUID,
    p_data JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_key_parts TEXT[];
    v_date_bucket TEXT;
    v_identifier TEXT;
BEGIN
    -- Date bucket: current date in YYYY-MM-DD format
    v_date_bucket := to_char(CURRENT_DATE, 'YYYY-MM-DD');

    -- Start with type
    v_key_parts := ARRAY[p_type];

    -- For item-related notifications, use item_id as identifier
    IF p_item_id IS NOT NULL THEN
        v_identifier := p_item_id::TEXT;
    -- For marketplace notifications, create composite identifier
    -- from listing_id + sender_id (if available) for message deduplication
    ELSIF p_data IS NOT NULL THEN
        IF p_data->>'listing_id' IS NOT NULL THEN
            v_identifier := COALESCE(p_data->>'listing_id', 'unknown');
            -- For messages, include sender to distinguish different senders
            IF p_type = 'new_message' AND p_data->>'sender_id' IS NOT NULL THEN
                v_identifier := v_identifier || ':' || p_data->>'sender_id';
            END IF;
        ELSIF p_data->>'transaction_id' IS NOT NULL THEN
            v_identifier := p_data->>'transaction_id';
        ELSE
            v_identifier := 'no-id';
        END IF;
    ELSE
        v_identifier := 'no-id';
    END IF;

    -- Build the final key: type:identifier:date
    RETURN p_type || ':' || v_identifier || ':' || v_date_bucket;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check for duplicate notification before insert
-- Returns TRUE if a duplicate exists within 24 hours
CREATE OR REPLACE FUNCTION check_notification_duplicate(
    p_user_id UUID,
    p_event_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if notification with same event_key exists within last 24 hours
    SELECT EXISTS(
        SELECT 1 FROM notifications
        WHERE user_id = p_user_id
        AND event_key = p_event_key
        AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
    ) INTO v_exists;

    RETURN v_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function to auto-generate event_key and skip duplicates
CREATE OR REPLACE FUNCTION notification_deduplication_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_event_key TEXT;
BEGIN
    -- Generate event_key if not provided
    IF NEW.event_key IS NULL THEN
        NEW.event_key := generate_notification_event_key(
            NEW.type,
            NEW.item_id,
            NEW.data
        );
    END IF;

    -- Check for duplicate within 24 hours
    IF check_notification_duplicate(NEW.user_id, NEW.event_key) THEN
        -- Skip the insert by returning NULL
        -- This silently skips the duplicate without error
        RAISE NOTICE 'Skipping duplicate notification with event_key: %', NEW.event_key;
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on notifications table
-- BEFORE INSERT so we can modify event_key and skip duplicates
DROP TRIGGER IF EXISTS notification_deduplication ON notifications;
CREATE TRIGGER notification_deduplication
    BEFORE INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notification_deduplication_trigger();

-- Comment on the new column
COMMENT ON COLUMN notifications.event_key IS 'Deduplication key: {type}:{item_id|listing_id}:{date}. Used to prevent duplicate notifications within 24 hours.';
