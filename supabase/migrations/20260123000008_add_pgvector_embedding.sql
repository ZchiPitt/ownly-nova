-- Migration: Enable pgvector extension and add embedding column to items
-- Description: Adds vector storage capability for AI similarity detection using pgvector extension.
-- Created: 2026-01-23

-- Enable pgvector extension (requires superuser in Supabase - enabled by default)
-- Note: In Supabase, pgvector is pre-installed but may need to be enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to items table for vector similarity search
-- Using 1536 dimensions to match OpenAI text-embedding-3-small output
ALTER TABLE items
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index on embedding column for fast approximate nearest neighbor search
-- HNSW (Hierarchical Navigable Small World) is preferred over IVFFlat for:
--   1. Better query performance without training requirement
--   2. No need to specify number of lists upfront
--   3. Better recall at similar query speeds
-- Using cosine distance operator class for semantic similarity
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
ON items
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create function for cosine similarity search
-- Returns items similar to a given embedding vector, ordered by similarity
-- Parameters:
--   query_embedding: The embedding vector to search for
--   match_threshold: Minimum similarity score (0-1, where 1 is identical)
--   match_count: Maximum number of results to return
--   search_user_id: The user ID to filter items by (for RLS compliance)
CREATE OR REPLACE FUNCTION search_items_by_embedding(
    query_embedding vector(1536),
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

-- Create a simpler function that uses auth.uid() for RLS-compliant searches
-- This is the preferred function for client-side calls
CREATE OR REPLACE FUNCTION search_similar_items(
    query_embedding vector(1536),
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

-- Add comment for documentation
COMMENT ON COLUMN items.embedding IS 'OpenAI embedding vector (1536 dimensions) for similarity search. Generated from item name, description, and tags.';
COMMENT ON FUNCTION search_items_by_embedding IS 'Search for items similar to a query embedding. SECURITY DEFINER - use with explicit user_id parameter from server-side.';
COMMENT ON FUNCTION search_similar_items IS 'Search for similar items in the current user inventory. SECURITY INVOKER - uses auth.uid() for RLS compliance.';
