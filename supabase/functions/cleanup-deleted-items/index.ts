/**
 * Supabase Edge Function: cleanup-deleted-items
 *
 * Background job to permanently delete soft-deleted items older than 30 days.
 * Intended to be triggered daily via pg_cron, Supabase scheduled functions,
 * or external scheduler (e.g., GitHub Actions, cron.org).
 *
 * This function:
 * 1. Finds items where deleted_at < NOW() - INTERVAL '30 days'
 * 2. Hard deletes those item records from the database
 * 3. Deletes associated files from Supabase Storage (photo, thumbnail)
 * 4. Logs deletion counts for audit purposes
 *
 * @requires SUPABASE_URL environment variable
 * @requires SUPABASE_SERVICE_ROLE_KEY environment variable (for bypassing RLS)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface DeletedItem {
  id: string;
  user_id: string;
  photo_url: string | null;
  thumbnail_url: string | null;
  name: string | null;
  deleted_at: string;
}

interface CleanupResponse {
  success: boolean;
  items_found: number;
  items_deleted: number;
  storage_files_deleted: number;
  storage_files_failed: number;
  errors: string[];
  executed_at: string;
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Extract the storage path from a Supabase storage URL
 * Storage URLs look like: https://xxx.supabase.co/storage/v1/object/public/items/user-id/filename.jpg
 * or: https://xxx.supabase.co/storage/v1/object/sign/items/user-id/filename.jpg?token=xxx
 * We need to extract: user-id/filename.jpg
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match patterns like /storage/v1/object/public/items/... or /storage/v1/object/sign/items/...
    const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/items\/(.+)/);
    if (match && match[1]) {
      // Remove any query parameters from the path (for signed URLs)
      return match[1].split('?')[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Main handler for the Edge Function
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      const error: ApiError = {
        error: {
          message: 'Supabase configuration missing',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optional: Validate secret key for external schedulers
    // This provides basic protection against unauthorized triggers
    const secretKey = Deno.env.get('CLEANUP_SECRET_KEY');
    if (secretKey) {
      const providedKey = req.headers.get('X-Cleanup-Secret');
      if (providedKey !== secretKey) {
        const error: ApiError = {
          error: {
            message: 'Invalid secret key',
            code: 'UNAUTHORIZED',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const response: CleanupResponse = {
      success: true,
      items_found: 0,
      items_deleted: 0,
      storage_files_deleted: 0,
      storage_files_failed: 0,
      errors: [],
      executed_at: now.toISOString(),
    };

    // Step 1: Find items eligible for permanent deletion
    // Items where deleted_at < NOW() - 30 days
    const { data: deletedItems, error: fetchError } = await supabase
      .from('items')
      .select('id, user_id, photo_url, thumbnail_url, name, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', thirtyDaysAgo.toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch deleted items: ${fetchError.message}`);
    }

    if (!deletedItems || deletedItems.length === 0) {
      // No items to clean up
      console.log('cleanup-deleted-items: No items eligible for permanent deletion');
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = deletedItems as DeletedItem[];
    response.items_found = items.length;

    console.log(`cleanup-deleted-items: Found ${items.length} items eligible for permanent deletion`);

    // Step 2: Delete storage files for each item
    const filesToDelete: string[] = [];
    for (const item of items) {
      const photoPath = extractStoragePath(item.photo_url || '');
      const thumbnailPath = extractStoragePath(item.thumbnail_url || '');

      if (photoPath) {
        filesToDelete.push(photoPath);
      }
      if (thumbnailPath) {
        filesToDelete.push(thumbnailPath);
      }
    }

    if (filesToDelete.length > 0) {
      // Delete files from storage in batches (Supabase storage supports batch deletes)
      const { data: deletedFiles, error: storageError } = await supabase
        .storage
        .from('items')
        .remove(filesToDelete);

      if (storageError) {
        response.errors.push(`Storage deletion error: ${storageError.message}`);
        response.storage_files_failed = filesToDelete.length;
        console.error('cleanup-deleted-items: Storage deletion error:', storageError.message);
      } else {
        response.storage_files_deleted = deletedFiles?.length || 0;
        response.storage_files_failed = filesToDelete.length - (deletedFiles?.length || 0);
        console.log(`cleanup-deleted-items: Deleted ${deletedFiles?.length || 0} storage files`);
      }
    }

    // Step 3: Hard delete items from database
    const itemIds = items.map(item => item.id);

    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .in('id', itemIds);

    if (deleteError) {
      throw new Error(`Failed to delete items from database: ${deleteError.message}`);
    }

    response.items_deleted = items.length;
    console.log(`cleanup-deleted-items: Permanently deleted ${items.length} items from database`);

    // Log summary for audit purposes
    console.log('cleanup-deleted-items: Cleanup completed', {
      items_found: response.items_found,
      items_deleted: response.items_deleted,
      storage_files_deleted: response.storage_files_deleted,
      storage_files_failed: response.storage_files_failed,
      executed_at: response.executed_at,
    });

    // Mark as partial success if there were storage errors but items were deleted
    if (response.errors.length > 0) {
      response.success = response.items_deleted > 0;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('cleanup-deleted-items error:', error);

    const apiError: ApiError = {
      error: {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    };

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
