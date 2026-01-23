-- Migration: Create subscription_plans table
-- Description: Defines plan tiers (free, basic, pro) and Stripe product/price mapping
-- Created: 2026-02-01

CREATE TABLE IF NOT EXISTS subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NULL,
    stripe_product_id text NULL,
    stripe_price_id text NULL,
    tier_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups by slug and by Stripe price (webhook resolution)
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_idx ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS subscription_plans_stripe_price_id_idx ON subscription_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- Trigger to update updated_at (reuses function from profiles migration)
CREATE TRIGGER subscription_plans_updated_at_trigger
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed plans: free (default), basic, pro (monthly only for now)
INSERT INTO subscription_plans (id, slug, name, description, stripe_product_id, stripe_price_id, tier_order)
VALUES
    (gen_random_uuid(), 'free', 'Free', 'Default plan with core features', NULL, NULL, 0),
    (gen_random_uuid(), 'basic', 'Basic', 'Basic subscription tier', NULL, NULL, 1),
    (gen_random_uuid(), 'pro', 'Pro', 'Pro subscription tier', NULL, NULL, 2)
ON CONFLICT (slug) DO NOTHING;

-- Link user_subscriptions to subscription_plans
ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_subscription_plan_fkey
    FOREIGN KEY (subscription_uuid) REFERENCES subscription_plans(id) ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE subscription_plans IS 'Plan tiers (free, basic, pro) and Stripe product/price IDs';
COMMENT ON COLUMN subscription_plans.id IS 'Primary key; referenced by user_subscriptions.subscription_uuid';
COMMENT ON COLUMN subscription_plans.slug IS 'Stable identifier: free, basic, pro';
COMMENT ON COLUMN subscription_plans.name IS 'Display name';
COMMENT ON COLUMN subscription_plans.description IS 'Optional plan description';
COMMENT ON COLUMN subscription_plans.stripe_product_id IS 'Stripe Product ID (prod_...); NULL for free';
COMMENT ON COLUMN subscription_plans.stripe_price_id IS 'Stripe Price ID for monthly billing (price_...)';
COMMENT ON COLUMN subscription_plans.tier_order IS 'Numeric tier for comparison (0=free, 1=basic, 2=pro)';
