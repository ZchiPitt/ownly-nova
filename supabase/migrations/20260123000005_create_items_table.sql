-- Migration: Create items table for inventory storage
-- Description: Core table for storing user inventory items with AI metadata, categorization, and location tracking.
-- Created: 2026-01-23

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url text NOT NULL,
    thumbnail_url text,
    name varchar(200),
    description text,
    category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
    tags text[] NOT NULL DEFAULT '{}',
    location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 999),
    price decimal(10, 2),
    currency varchar(3) NOT NULL DEFAULT 'CNY',
    purchase_date date,
    expiration_date date,
    brand varchar(100),
    model varchar(100),
    notes text,
    is_favorite boolean NOT NULL DEFAULT false,
    keep_forever boolean NOT NULL DEFAULT false,
    ai_metadata jsonb,
    last_viewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS items_user_id_idx ON items(user_id);
CREATE INDEX IF NOT EXISTS items_category_id_idx ON items(category_id);
CREATE INDEX IF NOT EXISTS items_location_id_idx ON items(location_id);
CREATE INDEX IF NOT EXISTS items_deleted_at_idx ON items(deleted_at);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own items (not soft-deleted)
CREATE POLICY "Users can view own items"
    ON items
    FOR SELECT
    USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Policy: Users can insert their own items
CREATE POLICY "Users can insert own items"
    ON items
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own items
CREATE POLICY "Users can update own items"
    ON items
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete (soft-delete) their own items
CREATE POLICY "Users can delete own items"
    ON items
    FOR DELETE
    USING (user_id = auth.uid());

-- Trigger: Auto-update updated_at on modifications
-- Reuses the update_updated_at_column function created in profiles migration
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on table and columns for documentation
COMMENT ON TABLE items IS 'Core inventory items table storing user belongings with AI metadata, categorization, and location tracking.';
COMMENT ON COLUMN items.id IS 'Unique item identifier';
COMMENT ON COLUMN items.user_id IS 'Reference to auth.users.id - owner of this item';
COMMENT ON COLUMN items.photo_url IS 'URL of the main item photo (required)';
COMMENT ON COLUMN items.thumbnail_url IS 'URL of the 200x200 thumbnail image (optional, generated)';
COMMENT ON COLUMN items.name IS 'Item display name (max 200 characters, can be AI-generated)';
COMMENT ON COLUMN items.description IS 'Detailed item description (can be AI-generated)';
COMMENT ON COLUMN items.category_id IS 'Reference to categories.id - item categorization';
COMMENT ON COLUMN items.tags IS 'Array of text tags for item organization and search';
COMMENT ON COLUMN items.location_id IS 'Reference to locations.id - where item is stored';
COMMENT ON COLUMN items.quantity IS 'Number of this item owned (1-999)';
COMMENT ON COLUMN items.price IS 'Purchase price with 2 decimal places';
COMMENT ON COLUMN items.currency IS 'ISO 4217 currency code (default CNY)';
COMMENT ON COLUMN items.purchase_date IS 'Date when item was purchased';
COMMENT ON COLUMN items.expiration_date IS 'Date when item expires (for perishables)';
COMMENT ON COLUMN items.brand IS 'Item brand name (max 100 characters)';
COMMENT ON COLUMN items.model IS 'Item model number or name (max 100 characters)';
COMMENT ON COLUMN items.notes IS 'Additional user notes about the item';
COMMENT ON COLUMN items.is_favorite IS 'Whether item is marked as favorite';
COMMENT ON COLUMN items.keep_forever IS 'Whether item should be excluded from unused item reminders';
COMMENT ON COLUMN items.ai_metadata IS 'JSON object containing AI analysis results and confidence scores';
COMMENT ON COLUMN items.last_viewed_at IS 'Timestamp when item was last viewed (for unused item detection)';
COMMENT ON COLUMN items.created_at IS 'Timestamp when item was created';
COMMENT ON COLUMN items.updated_at IS 'Timestamp when item was last modified';
COMMENT ON COLUMN items.deleted_at IS 'Soft delete timestamp. NULL for active items.';
