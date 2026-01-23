-- Migration: Add warranty_expiry_date column to items table
-- Description: Adds warranty expiry tracking for items so users can receive warranty expiration reminders
-- Created: 2026-02-03

-- Add warranty_expiry_date column to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS warranty_expiry_date date;

-- Add index for efficient querying of upcoming warranty expirations
CREATE INDEX IF NOT EXISTS items_warranty_expiry_date_idx ON items(warranty_expiry_date)
  WHERE warranty_expiry_date IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN items.warranty_expiry_date IS 'Date when item warranty expires (for warranty expiration reminders)';
