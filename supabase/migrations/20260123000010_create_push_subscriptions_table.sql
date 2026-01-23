-- ============================================
-- Migration: Create Push Subscriptions Table
-- US-065: Implement push notification permission flow
-- ============================================
-- This table stores Web Push API subscription endpoints
-- for sending push notifications to user devices

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Push subscription data from PushSubscription.toJSON()
    endpoint TEXT NOT NULL,

    -- Encryption keys for push messages
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,

    -- Device/browser identifier (optional, for managing multiple devices)
    device_name TEXT,

    -- User agent for debugging/identifying subscriptions
    user_agent TEXT,

    -- Subscription status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,

    -- Unique constraint: one endpoint per user (prevents duplicate subscriptions)
    CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint)
);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON public.push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
    ON public.push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
    ON public.push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
    ON public.push_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Indexes
-- ============================================

-- Index for finding active subscriptions by user
CREATE INDEX idx_push_subscriptions_user_active
    ON public.push_subscriptions(user_id)
    WHERE is_active = true;

-- Index for finding subscriptions by endpoint (for cleanup)
CREATE INDEX idx_push_subscriptions_endpoint
    ON public.push_subscriptions(endpoint);

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at timestamp (reusing existing function)
CREATE TRIGGER push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Documentation
-- ============================================

COMMENT ON TABLE public.push_subscriptions IS
    'Stores Web Push API subscription endpoints for push notifications (US-065)';

COMMENT ON COLUMN public.push_subscriptions.endpoint IS
    'Push service endpoint URL from PushSubscription';

COMMENT ON COLUMN public.push_subscriptions.p256dh IS
    'Public key for encrypting push messages (from keys.p256dh)';

COMMENT ON COLUMN public.push_subscriptions.auth IS
    'Authentication secret for push messages (from keys.auth)';

COMMENT ON COLUMN public.push_subscriptions.device_name IS
    'Optional user-friendly device name for managing multiple devices';

COMMENT ON COLUMN public.push_subscriptions.is_active IS
    'Whether subscription is active (set to false if push fails)';

COMMENT ON COLUMN public.push_subscriptions.last_used_at IS
    'Last time a push was sent to this subscription';
