-- Migration: Create profiles table
-- Description: Extends Supabase Auth user data with profile information
-- Created: 2026-01-23

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name varchar(50),
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can insert their own profile (needed for the trigger or manual creation)
CREATE POLICY "Users can insert own profile"
    ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row update
CREATE TRIGGER profiles_updated_at_trigger
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Comment on table and columns for documentation
COMMENT ON TABLE profiles IS 'User profile information extending auth.users';
COMMENT ON COLUMN profiles.id IS 'Unique profile identifier';
COMMENT ON COLUMN profiles.user_id IS 'Reference to auth.users.id';
COMMENT ON COLUMN profiles.display_name IS 'User display name (max 50 chars)';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN profiles.created_at IS 'Timestamp when profile was created';
COMMENT ON COLUMN profiles.updated_at IS 'Timestamp when profile was last updated';
