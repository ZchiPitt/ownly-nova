-- Migration: Update push notification trigger to check user presence
-- Description: Skip push notifications when user is actively viewing the relevant conversation
-- Created: 2026-02-03

-- Update function to check user presence before sending push notification
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  supabase_url text;
  service_role_key text;
  request_id bigint;
  notification_data jsonb;
  listing_id uuid;
  user_is_present boolean;
BEGIN
  -- Only trigger for notifications that haven't been pushed yet
  IF NEW.is_pushed = true THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from environment (set via Vault or config)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, warn and skip
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Push notification trigger: supabase_url not configured';
    RETURN NEW;
  END IF;

  -- Extract listing_id from notification data if present
  -- This is used for marketplace notifications (new_message, new_inquiry, etc.)
  listing_id := (NEW.data->>'listing_id')::uuid;

  -- Check if user is actively viewing this conversation
  -- Skip push if user was active on that listing within last 30 seconds
  IF listing_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM user_presence
      WHERE user_id = NEW.user_id
        AND active_listing_id = listing_id
        AND last_seen > (now() - interval '30 seconds')
    ) INTO user_is_present;

    IF user_is_present THEN
      RAISE LOG 'Push notification skipped for notification % - user is present on listing %', NEW.id, listing_id;
      -- Mark as pushed to prevent re-triggering, even though we didn't send
      -- The notification still exists in the database for in-app display
      UPDATE notifications SET is_pushed = true, pushed_at = now() WHERE id = NEW.id;
      RETURN NEW;
    END IF;
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

-- Comment on updated function
COMMENT ON FUNCTION trigger_push_notification() IS 'Triggers push notification delivery via Edge Function when a new notification is created with is_pushed=false. Skips push if user is actively viewing the relevant conversation (presence check).';
