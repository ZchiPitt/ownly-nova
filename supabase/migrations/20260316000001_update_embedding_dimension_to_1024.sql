-- Migration: Update pgvector embedding dimension from 1536 (OpenAI) to 1024 (Amazon Nova)
-- Description: Migrates vector column and search functions to use 1024-dimension embeddings
-- from Amazon Nova Multimodal Embeddings model.
-- Created: 2026-03-16
--
-- IMPORTANT: This migration drops all existing embeddings because they are incompatible
-- with the new dimension. Items will need to be re-embedded after deployment.

-- Step 1: Drop existing indexes that reference the old dimension
DROP INDEX IF EXISTS items_embedding_hnsw_idx;

-- Step 2: Drop existing functions that reference vector(1536)
DROP FUNCTION IF EXISTS search_items_by_embedding(vector(1536), float, int, uuid);
DROP FUNCTION IF EXISTS search_similar_items(vector(1536), float, int);

-- Step 3: Clear existing embeddings (incompatible dimensions)
UPDATE items SET embedding = NULL WHERE embedding IS NOT NULL;

-- Step 4: Alter column to new dimension
ALTER TABLE items ALTER COLUMN embedding TYPE vector(1024);

-- Step 5: Recreate HNSW index for new dimension
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
ON items
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 6: Recreate search function with new dimension (server-side, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION search_items_by_embedding(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 10,
    search_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name varchar(200),
    description text,
    photo_url text,
    thumbnail_url text,
    category_id uuid,
    location_id uuid,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.name,
        i.description,
        i.photo_url,
        i.thumbnail_url,
        i.category_id,
        i.location_id,
        1 - (i.embedding <=> query_embedding) AS similarity
    FROM items i
    WHERE
        i.embedding IS NOT NULL
        AND i.deleted_at IS NULL
        AND (search_user_id IS NULL OR i.user_id = search_user_id)
        AND 1 - (i.embedding <=> query_embedding) >= match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 7: Recreate client-side search function with new dimension (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION search_similar_items(
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    name varchar(200),
    description text,
    photo_url text,
    thumbnail_url text,
    category_id uuid,
    location_id uuid,
    similarity float
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.name,
        i.description,
        i.photo_url,
        i.thumbnail_url,
        i.category_id,
        i.location_id,
        1 - (i.embedding <=> query_embedding) AS similarity
    FROM items i
    WHERE
        i.embedding IS NOT NULL
        AND i.deleted_at IS NULL
        AND i.user_id = auth.uid()
        AND 1 - (i.embedding <=> query_embedding) >= match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 8: Update comments
COMMENT ON COLUMN items.embedding IS 'Amazon Nova embedding vector (1024 dimensions) for similarity search. Generated from item name, description, and tags.';
COMMENT ON FUNCTION search_items_by_embedding IS 'Search for items similar to a query embedding (1024d Nova). SECURITY DEFINER - use with explicit user_id parameter from server-side.';
COMMENT ON FUNCTION search_similar_items IS 'Search for similar items in the current user inventory (1024d Nova). SECURITY INVOKER - uses auth.uid() for RLS compliance.';
