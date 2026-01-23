/**
 * Supabase Edge Function: process-batched-notifications
 *
 * Processes pending batched notifications after the 5-second batching window.
 * Should be called periodically by a scheduled job (every 5 seconds).
 *
 * US-005: Implement message batching for rapid messages
 *
 * @requires SUPABASE_URL environment variable
 * @requires SUPABASE_SERVICE_ROLE_KEY environment variable
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface PendingBatch {
  id: string;
  user_id: string;
  sender_id: string;
  sender_name: string | null;
  listing_id: string;
  item_name: string | null;
  message_count: number;
  first_message_preview: string | null;
  first_message_at: string;
  last_message_at: string;
}

interface ProcessResult {
  batch_id: string;
  user_id: string;
  message_count: number;
  success: boolean;
  error?: string;
}

interface ApiError {
  error: {
    message: string;
    code?: string;
  };
}

/**
 * Format batched notification content
 */
function formatBatchedNotification(batch: PendingBatch): { title: string; body: string } {
  const senderName = batch.sender_name ?? 'Someone';
  const messageCount = batch.message_count;

  if (messageCount === 1) {
    // Single message - use standard format with preview
    const preview = batch.first_message_preview ?? '';
    const truncatedPreview = preview.length > 50
      ? `${preview.slice(0, 50)}...`
      : preview;

    return {
      title: `New message from ${senderName}`,
      body: truncatedPreview || `Message about ${batch.item_name ?? 'a listing'}`,
    };
  }

  // Multiple messages - use batched format
  return {
    title: `${senderName} sent ${messageCount} messages`,
    body: batch.item_name
      ? `About: ${batch.item_name}`
      : 'Tap to view the conversation',
  };
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

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all pending batches where last_message_at is older than 5 seconds
    const batchWindow = 5; // seconds
    const cutoffTime = new Date(Date.now() - batchWindow * 1000).toISOString();

    const { data: pendingBatches, error: fetchError } = await supabase
      .from('pending_push_notifications')
      .select('*')
      .lt('last_message_at', cutoffTime)
      .order('first_message_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch pending batches: ${fetchError.message}`);
    }

    if (!pendingBatches || pendingBatches.length === 0) {
      console.log('[process-batched] No pending batches to process');
      return new Response(JSON.stringify({
        success: true,
        processed_count: 0,
        results: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-batched] Processing ${pendingBatches.length} pending batches`);

    const results: ProcessResult[] = [];
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    for (const batch of pendingBatches as PendingBatch[]) {
      try {
        // Format the batched notification
        const { title, body } = formatBatchedNotification(batch);

        // Send push notification via the send-push-notification function
        const pushPayload = {
          user_id: batch.user_id,
          title,
          body,
          type: 'new_message',
          data: {
            type: 'new_message',
            listing_id: batch.listing_id,
            sender_id: batch.sender_id,
            message_count: batch.message_count,
            batched: true,
          },
        };

        const pushResponse = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(pushPayload),
        });

        if (!pushResponse.ok) {
          const errorText = await pushResponse.text();
          throw new Error(`Push failed: ${pushResponse.status} - ${errorText}`);
        }

        // Delete the processed batch
        const { error: deleteError } = await supabase
          .from('pending_push_notifications')
          .delete()
          .eq('id', batch.id);

        if (deleteError) {
          console.error(`[process-batched] Failed to delete batch ${batch.id}:`, deleteError);
        }

        results.push({
          batch_id: batch.id,
          user_id: batch.user_id,
          message_count: batch.message_count,
          success: true,
        });

        console.log(`[process-batched] Sent batched notification: ${batch.message_count} messages from ${batch.sender_name ?? batch.sender_id} to user ${batch.user_id}`);

      } catch (batchError) {
        const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error';
        console.error(`[process-batched] Error processing batch ${batch.id}:`, batchError);

        results.push({
          batch_id: batch.id,
          user_id: batch.user_id,
          message_count: batch.message_count,
          success: false,
          error: errorMessage,
        });

        // Don't delete failed batches - they'll be retried on next run
        // But if they're too old (> 1 hour), delete them to prevent buildup
        const batchAge = Date.now() - new Date(batch.first_message_at).getTime();
        if (batchAge > 60 * 60 * 1000) { // 1 hour
          const { error: deleteError } = await supabase
            .from('pending_push_notifications')
            .delete()
            .eq('id', batch.id);

          if (deleteError) {
            console.error(`[process-batched] Failed to delete stale batch ${batch.id}:`, deleteError);
          } else {
            console.log(`[process-batched] Deleted stale batch ${batch.id} (age > 1 hour)`);
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[process-batched] Completed: ${successCount} sent, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: successCount > 0 || results.length === 0,
      processed_count: results.length,
      success_count: successCount,
      failed_count: failedCount,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-batched] Error:', error);

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
