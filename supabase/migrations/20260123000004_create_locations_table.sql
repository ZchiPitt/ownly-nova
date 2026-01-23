-- Migration: Create locations table with unlimited hierarchy support
-- Description: Stores user-defined storage locations with hierarchical parent-child relationships for organizing inventory items.
-- Created: 2026-01-23

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL,
    parent_id uuid REFERENCES locations(id) ON DELETE SET NULL,
    path text NOT NULL DEFAULT '',
    depth integer NOT NULL DEFAULT 1,
    icon varchar(10) NOT NULL DEFAULT '📍',
    photo_url text,
    item_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS locations_user_id_idx ON locations(user_id);
CREATE INDEX IF NOT EXISTS locations_parent_id_idx ON locations(parent_id);
CREATE INDEX IF NOT EXISTS locations_deleted_at_idx ON locations(deleted_at);

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own locations (not soft-deleted)
CREATE POLICY "Users can view own locations"
    ON locations
    FOR SELECT
    USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Policy: Users can insert their own locations
CREATE POLICY "Users can insert own locations"
    ON locations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own locations
CREATE POLICY "Users can update own locations"
    ON locations
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete (soft-delete) their own locations
CREATE POLICY "Users can delete own locations"
    ON locations
    FOR DELETE
    USING (user_id = auth.uid());

-- Trigger: Auto-update updated_at on modifications
-- Reuses the update_updated_at_column function created in profiles migration
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function: Update location path and depth when parent changes
-- This function automatically maintains the path and depth fields
CREATE OR REPLACE FUNCTION update_location_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path text;
    parent_depth integer;
BEGIN
    IF NEW.parent_id IS NULL THEN
        -- Root location: path is just its own name, depth is 1
        NEW.path := NEW.name;
        NEW.depth := 1;
    ELSE
        -- Child location: get parent's path and depth
        SELECT path, depth INTO parent_path, parent_depth
        FROM locations
        WHERE id = NEW.parent_id;

        NEW.path := parent_path || ' > ' || NEW.name;
        NEW.depth := parent_depth + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update path and depth on insert or update
CREATE TRIGGER update_location_path_trigger
    BEFORE INSERT OR UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_location_path();

-- Comment on table and columns for documentation
COMMENT ON TABLE locations IS 'User-defined storage locations with hierarchical support for organizing inventory items.';
COMMENT ON COLUMN locations.id IS 'Unique location identifier';
COMMENT ON COLUMN locations.user_id IS 'Reference to auth.users.id - owner of this location';
COMMENT ON COLUMN locations.name IS 'Location display name (max 100 characters)';
COMMENT ON COLUMN locations.parent_id IS 'Reference to parent location for hierarchy. NULL for root locations.';
COMMENT ON COLUMN locations.path IS 'Full path string for display (e.g., "Home > Kitchen > Pantry"). Auto-maintained by trigger.';
COMMENT ON COLUMN locations.depth IS 'Hierarchy depth level (1 for root, increments per level). Auto-maintained by trigger.';
COMMENT ON COLUMN locations.icon IS 'Emoji icon for the location (default pin emoji)';
COMMENT ON COLUMN locations.photo_url IS 'Optional photo URL for the location';
COMMENT ON COLUMN locations.item_count IS 'Number of items stored at this location. Maintained by items table triggers.';
COMMENT ON COLUMN locations.created_at IS 'Timestamp when location was created';
COMMENT ON COLUMN locations.updated_at IS 'Timestamp when location was last modified';
COMMENT ON COLUMN locations.deleted_at IS 'Soft delete timestamp. NULL for active locations.';
