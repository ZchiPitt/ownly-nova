-- Migration: Create database trigger for push notification delivery
-- Description: Automatically trigger push notification delivery when notifications are created
-- Created: 2026-02-03

-- Enable pg_net extension for HTTP requests from database
-- This allows the trigger to call the Edge Function directly
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions for the extension
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Create function to trigger push notification via Edge Function
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  supabase_url text;
  service_role_key text;
  request_id bigint;
  notification_data jsonb;
BEGIN
  -- Only trigger for notifications that haven't been pushed yet
  IF NEW.is_pushed = true THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from environment (set via Vault or config)
  -- The URL is constructed from the project reference
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, try to use the default pattern
  -- Note: In production, these should be configured via Supabase Vault
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- Cannot proceed without URL configuration
    RAISE WARNING 'Push notification trigger: supabase_url not configured';
    RETURN NEW;
  END IF;

  -- Construct Edge Function URL
  edge_function_url := supabase_url || '/functions/v1/send-push-notification';

  -- Build the notification payload
  notification_data := jsonb_build_object(
    'user_id', NEW.user_id::text,
    'title', NEW.title,
    'body', COALESCE(NEW.body, ''),
    'type', NEW.type,
    'notification_id', NEW.id::text,
    'data', COALESCE(NEW.data, '{}'::jsonb)
  );

  -- Make async HTTP POST request to Edge Function
  -- pg_net.http_post is non-blocking and returns immediately
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := notification_data
  ) INTO request_id;

  -- Log the request for debugging
  RAISE LOG 'Push notification triggered for notification %: request_id=%', NEW.id, request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notifications table
-- Fires AFTER INSERT so the notification record exists when the Edge Function processes it
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;

CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.is_pushed = false)
  EXECUTE FUNCTION trigger_push_notification();

-- Comment on function and trigger
COMMENT ON FUNCTION trigger_push_notification() IS 'Triggers push notification delivery via Edge Function when a new notification is created with is_pushed=false';

-- Add index to optimize queries for unprocessed notifications
CREATE INDEX IF NOT EXISTS notifications_is_pushed_idx ON notifications(is_pushed) WHERE is_pushed = false;
