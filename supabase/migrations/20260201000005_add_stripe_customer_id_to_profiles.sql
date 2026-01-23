-- Add Stripe Customer ID to profiles for Checkout / Customer Portal
-- One per user (cus_...); used when creating sessions or managing billing
-- Created: 2026-02-01

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text NULL;

DROP INDEX IF EXISTS idx_profiles_stripe_customer_id;
CREATE UNIQUE INDEX idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID (cus_...) for Checkout and Customer Portal';
