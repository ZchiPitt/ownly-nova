-- Migration: Update push notification trigger to support message batching
-- Description: Messages from same sender within 5 seconds are batched
-- US-005: Implement message batching for rapid messages
-- Created: 2026-02-03

-- Update function to batch new_message notifications
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
  sender_id text;
  sender_name text;
  item_name text;
  message_preview text;
  existing_batch_id uuid;
  batch_window interval := interval '5 seconds';
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
      -- Mark as pushed to prevent re-triggering
      UPDATE notifications SET is_pushed = true, pushed_at = now() WHERE id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  -- For new_message type, use batching logic
  IF NEW.type = 'new_message' AND listing_id IS NOT NULL THEN
    -- Extract sender info from notification data
    sender_id := NEW.data->>'sender_id';
    sender_name := NEW.data->>'sender_name';
    item_name := NEW.data->>'item_name';
    message_preview := NEW.data->>'message_preview';

    IF sender_id IS NOT NULL THEN
      -- Check if there's an existing batch for this (user, sender, listing) combination
      SELECT id INTO existing_batch_id
      FROM pending_push_notifications
      WHERE pending_push_notifications.user_id = NEW.user_id
        AND pending_push_notifications.sender_id = sender_id
        AND pending_push_notifications.listing_id = listing_id
        AND pending_push_notifications.last_message_at > (now() - batch_window);

      IF existing_batch_id IS NOT NULL THEN
        -- Update existing batch: increment count and update timestamp
        UPDATE pending_push_notifications
        SET message_count = message_count + 1,
            last_message_at = now()
        WHERE id = existing_batch_id;

        RAISE LOG 'Message batched for notification % (batch %)', NEW.id, existing_batch_id;

        -- Mark this notification as pushed (it's batched)
        UPDATE notifications SET is_pushed = true, pushed_at = now() WHERE id = NEW.id;
        RETURN NEW;
      ELSE
        -- No active batch, create a new pending batch
        INSERT INTO pending_push_notifications (
          user_id, sender_id, sender_name, listing_id, item_name,
          message_count, first_message_preview, first_message_at, last_message_at
        ) VALUES (
          NEW.user_id, sender_id, sender_name, listing_id, item_name,
          1, message_preview, now(), now()
        )
        ON CONFLICT (user_id, sender_id, listing_id)
        DO UPDATE SET
          message_count = pending_push_notifications.message_count + 1,
          last_message_at = now();

        RAISE LOG 'Created/updated pending batch for notification %', NEW.id;

        -- Mark this notification as pushed (it's pending in batch)
        UPDATE notifications SET is_pushed = true, pushed_at = now() WHERE id = NEW.id;
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- For non-batched notifications, send immediately
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

  RAISE LOG 'Push notification triggered for notification %: request_id=%', NEW.id, request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on updated function
COMMENT ON FUNCTION trigger_push_notification() IS 'Triggers push notification delivery. For new_message type, batches messages from same sender within 5 seconds. Skips push if user is actively viewing the conversation.';
