-- Migration: Create items storage bucket for item photos
-- Created: 2026-01-23
-- Story: US-012 - Create Supabase storage bucket for item images

-- =====================================================
-- STORAGE BUCKET CONFIGURATION
-- =====================================================

-- Create the items storage bucket
-- Note: Supabase storage buckets are created via storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'items',
    'items',
    false,  -- Not public - requires authentication
    10485760,  -- 10MB in bytes (10 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Policy: Users can upload files to their own folder (items/{user_id}/*)
-- Allows INSERT (upload) operations only to user's own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'items' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read (download) their own files
-- Allows SELECT operations only on user's own files
CREATE POLICY "Users can read own files" ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'items' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own files
-- Allows UPDATE operations (like replacing files) only on user's own files
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'items' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'items' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
-- Allows DELETE operations only on user's own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'items' AND
    (storage.foldername(name))[1] = auth.uid()::text
);


-- Note: File path structure should be: items/{user_id}/{filename}
-- Example: items/550e8400-e29b-41d4-a716-446655440000/photo-abc123.jpg
--
-- Supported formats:
-- - image/jpeg (.jpg, .jpeg)
-- - image/png (.png)
-- - image/webp (.webp)
-- - image/heic (.heic) - iOS photos
--
-- Max file size: 10MB (10485760 bytes)
