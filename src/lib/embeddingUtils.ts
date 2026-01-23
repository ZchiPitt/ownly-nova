/**
 * Embedding utility functions for generating and searching with embeddings
 *
 * Uses OpenAI text-embedding-3-small via Supabase Edge Function
 */

import { supabase } from './supabase';

/**
 * Generate embedding for an item (non-blocking, fire-and-forget)
 * This is called after item creation/update to populate the embedding field
 *
 * @param itemId - The item ID to generate embedding for
 * @returns Promise that resolves when embedding generation is initiated
 */
export async function generateItemEmbedding(itemId: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('No session for embedding generation');
      return;
    }

    // Fire and forget - don't await the response
    // This keeps the item save fast while embedding generates in background
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item_id: itemId }),
    })
      .then((response) => {
        if (!response.ok) {
          console.warn('Embedding generation failed:', response.status);
        }
      })
      .catch((error) => {
        console.warn('Embedding generation error:', error);
      });
  } catch (error) {
    console.warn('Failed to initiate embedding generation:', error);
  }
}

/**
 * Generate embedding for a search query
 * Returns the embedding vector for use in similarity search
 *
 * @param text - The search query text
 * @returns The embedding vector or null if generation failed
 */
export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('No session for query embedding');
      return null;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Query embedding failed:', errorData);
      return null;
    }

    const data = await response.json();

    if (!data.embedding || !Array.isArray(data.embedding)) {
      console.warn('No embedding in response');
      return null;
    }

    return data.embedding;
  } catch (error) {
    console.warn('Query embedding error:', error);
    return null;
  }
}

/**
 * Search items by semantic similarity using embeddings
 *
 * @param queryEmbedding - The embedding vector of the search query
 * @param matchThreshold - Minimum similarity score (0-1, default 0.6)
 * @param matchCount - Maximum results to return (default 20)
 * @returns Array of matching items with similarity scores
 */
export interface SemanticSearchResult {
  id: string;
  name: string | null;
  description: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  category_id: string | null;
  location_id: string | null;
  similarity: number;
}

export async function searchItemsByEmbedding(
  queryEmbedding: number[],
  matchThreshold = 0.6,
  matchCount = 20
): Promise<SemanticSearchResult[]> {
  try {
    // Call the RPC function directly using the Supabase client
    // The function search_similar_items is defined in the database
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/search_similar_items`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Semantic search error:', errorData);
      return [];
    }

    const data = await response.json();
    return (data as SemanticSearchResult[]) || [];
  } catch (error) {
    console.error('Semantic search failed:', error);
    return [];
  }
}
