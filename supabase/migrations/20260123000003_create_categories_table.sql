-- Migration: Create categories table with system presets
-- Description: Stores category definitions for organizing inventory items. Supports both system-defined presets and user-defined custom categories.
-- Created: 2026-01-23

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name varchar(50) NOT NULL,
    icon varchar(10) NOT NULL DEFAULT '📦',
    color varchar(7) NOT NULL DEFAULT '#6B7280',
    is_system boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_is_system_idx ON categories(is_system);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can view system categories (is_system = true)
CREATE POLICY "Anyone can view system categories"
    ON categories
    FOR SELECT
    USING (is_system = true);

-- Policy: Users can view their own custom categories
CREATE POLICY "Users can view own categories"
    ON categories
    FOR SELECT
    USING (user_id = auth.uid() AND is_system = false);

-- Policy: Users can insert their own custom categories (non-system)
CREATE POLICY "Users can insert own categories"
    ON categories
    FOR INSERT
    WITH CHECK (user_id = auth.uid() AND is_system = false);

-- Policy: Users can update their own custom categories (non-system)
CREATE POLICY "Users can update own categories"
    ON categories
    FOR UPDATE
    USING (user_id = auth.uid() AND is_system = false)
    WITH CHECK (user_id = auth.uid() AND is_system = false);

-- Policy: Users can delete their own custom categories (non-system)
CREATE POLICY "Users can delete own categories"
    ON categories
    FOR DELETE
    USING (user_id = auth.uid() AND is_system = false);

-- Insert 10 system preset categories
-- Note: user_id is NULL for system categories, is_system = true
INSERT INTO categories (id, user_id, name, icon, color, is_system, sort_order, created_at) VALUES
    (gen_random_uuid(), NULL, 'Clothing', '👕', '#8B5CF6', true, 1, now()),
    (gen_random_uuid(), NULL, 'Food & Beverage', '🍕', '#EF4444', true, 2, now()),
    (gen_random_uuid(), NULL, 'Electronics', '📱', '#3B82F6', true, 3, now()),
    (gen_random_uuid(), NULL, 'Kitchen', '🍳', '#F97316', true, 4, now()),
    (gen_random_uuid(), NULL, 'Sports & Fitness', '⚽', '#22C55E', true, 5, now()),
    (gen_random_uuid(), NULL, 'Tools', '🔧', '#64748B', true, 6, now()),
    (gen_random_uuid(), NULL, 'Books & Documents', '📚', '#A855F7', true, 7, now()),
    (gen_random_uuid(), NULL, 'Personal Care', '🧴', '#EC4899', true, 8, now()),
    (gen_random_uuid(), NULL, 'Home Decor', '🏠', '#14B8A6', true, 9, now()),
    (gen_random_uuid(), NULL, 'Other', '📦', '#6B7280', true, 10, now());

-- Comment on table and columns for documentation
COMMENT ON TABLE categories IS 'Category definitions for organizing inventory items. Supports system presets and user-defined categories.';
COMMENT ON COLUMN categories.id IS 'Unique category identifier';
COMMENT ON COLUMN categories.user_id IS 'Reference to auth.users.id. NULL for system categories, set for user categories.';
COMMENT ON COLUMN categories.name IS 'Category display name (max 50 characters)';
COMMENT ON COLUMN categories.icon IS 'Emoji icon for the category (default box emoji)';
COMMENT ON COLUMN categories.color IS 'Hex color code for category display (default gray #6B7280)';
COMMENT ON COLUMN categories.is_system IS 'Whether this is a system-defined preset category (read-only for users)';
COMMENT ON COLUMN categories.sort_order IS 'Display order for sorting categories (lower numbers first)';
COMMENT ON COLUMN categories.created_at IS 'Timestamp when category was created';
