-- Migration: Create user_subscriptions table
-- Description: Stores Ownly service subscription records per user (Stripe-backed)
-- Created: 2026-02-01

CREATE TABLE IF NOT EXISTS user_subscriptions (
    uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uuid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_uuid uuid NULL,
    start_date date NOT NULL,
    end_date date NULL,
    paid_thru date NULL,
    stripe_subscription_id text NULL,
    status varchar(50) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS user_subscriptions_user_uuid_idx ON user_subscriptions(user_uuid);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_idx ON user_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS user_subscriptions_end_date_idx ON user_subscriptions(end_date) WHERE end_date IS NULL;

-- Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON user_subscriptions
    FOR SELECT
    USING (auth.uid() = user_uuid);

CREATE POLICY "Users can insert own subscriptions"
    ON user_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_uuid);

CREATE POLICY "Users can update own subscriptions"
    ON user_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_uuid)
    WITH CHECK (auth.uid() = user_uuid);

-- Trigger to update updated_at
CREATE TRIGGER user_subscriptions_updated_at_trigger
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_subscriptions IS 'Ownly service subscription records per user (Stripe-backed)';
COMMENT ON COLUMN user_subscriptions.uuid IS 'Unique subscription record identifier';
COMMENT ON COLUMN user_subscriptions.user_uuid IS 'Reference to auth.users.id';
COMMENT ON COLUMN user_subscriptions.subscription_uuid IS 'Reference to subscription plan (e.g. free, basic, pro)';
COMMENT ON COLUMN user_subscriptions.start_date IS 'Subscription period start date';
COMMENT ON COLUMN user_subscriptions.end_date IS 'Subscription period end date; NULL means currently active';
COMMENT ON COLUMN user_subscriptions.paid_thru IS 'Paid through this date (from Stripe)';
COMMENT ON COLUMN user_subscriptions.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN user_subscriptions.status IS 'Subscription status (e.g. active, canceled, past_due)';
COMMENT ON COLUMN user_subscriptions.created_at IS 'Record created at';
COMMENT ON COLUMN user_subscriptions.updated_at IS 'Record last updated at';
