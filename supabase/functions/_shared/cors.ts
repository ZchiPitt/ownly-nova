/**
 * Shared CORS headers for Supabase Edge Functions
 *
 * These headers enable cross-origin requests from the frontend application.
 * Used by all Edge Functions that need to respond to browser requests.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
