-- Extend profiles table for marketplace seller features
-- Created: 2026-01-31

-- Expand existing display_name length and add seller profile fields
ALTER TABLE profiles
  ALTER COLUMN display_name TYPE VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_rate DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Update RLS policies for profiles (keep existing + add new)
-- Note: profiles table should already have RLS enabled

-- Policy for reading public seller info (anyone authenticated can read)
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Public profiles are viewable by authenticated users" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Policy for users updating their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for seller lookups
CREATE INDEX IF NOT EXISTS idx_profiles_seller_rating ON profiles(seller_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location_city);
