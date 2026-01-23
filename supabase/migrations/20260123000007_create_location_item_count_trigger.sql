-- Migration: Create location item_count maintenance trigger
-- Description: Automatically maintains the item_count field on locations table when items are added, removed, or moved.
-- Created: 2026-01-23

-- Function: Update location item_count based on item changes
-- This function handles all scenarios:
-- 1. INSERT: Increment new location's count (if location_id is set)
-- 2. DELETE: Decrement location's count (if location_id was set)
-- 3. UPDATE with soft-delete: Decrement count when deleted_at changes from NULL to a value
-- 4. UPDATE with restore: Increment count when deleted_at changes from a value to NULL
-- 5. UPDATE location_id: Decrement old location, increment new location
CREATE OR REPLACE FUNCTION update_location_item_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Increment new location's item_count (if location_id is set and item is not soft-deleted)
        IF NEW.location_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE locations
            SET item_count = item_count + 1
            WHERE id = NEW.location_id;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle DELETE (hard delete)
    IF TG_OP = 'DELETE' THEN
        -- Decrement location's item_count (if location_id was set and item was not soft-deleted)
        IF OLD.location_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE locations
            SET item_count = GREATEST(item_count - 1, 0)
            WHERE id = OLD.location_id;
        END IF;
        RETURN OLD;
    END IF;

    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Case 1: Soft-delete (deleted_at changed from NULL to a value)
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            -- Decrement the location's count
            IF NEW.location_id IS NOT NULL THEN
                UPDATE locations
                SET item_count = GREATEST(item_count - 1, 0)
                WHERE id = NEW.location_id;
            END IF;
            RETURN NEW;
        END IF;

        -- Case 2: Restore from soft-delete (deleted_at changed from a value to NULL)
        IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            -- Increment the location's count
            IF NEW.location_id IS NOT NULL THEN
                UPDATE locations
                SET item_count = item_count + 1
                WHERE id = NEW.location_id;
            END IF;
            RETURN NEW;
        END IF;

        -- Case 3: Location change while item is active (not soft-deleted)
        IF NEW.deleted_at IS NULL THEN
            -- Only process if location_id actually changed
            IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
                -- Decrement old location's count (if it was set)
                IF OLD.location_id IS NOT NULL THEN
                    UPDATE locations
                    SET item_count = GREATEST(item_count - 1, 0)
                    WHERE id = OLD.location_id;
                END IF;

                -- Increment new location's count (if it's set)
                IF NEW.location_id IS NOT NULL THEN
                    UPDATE locations
                    SET item_count = item_count + 1
                    WHERE id = NEW.location_id;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Fire on items table for all relevant operations
CREATE TRIGGER update_location_item_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_location_item_count();

-- Comment on function for documentation
COMMENT ON FUNCTION update_location_item_count() IS 'Maintains location.item_count when items are inserted, updated, deleted, or soft-deleted. Handles location changes and null location_id cases.';
