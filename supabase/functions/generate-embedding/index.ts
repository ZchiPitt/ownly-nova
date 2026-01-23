/**
 * Supabase Edge Function: generate-embedding
 *
 * Generates embeddings for items using Amazon Bedrock Nova Multimodal Embeddings
 * (amazon.nova-2-multimodal-embeddings-v1:0, 1024-dimensional vectors).
 * Can accept either an item ID (to fetch and generate embedding for an existing item)
 * or a text description (to generate embedding for custom text).
 *
 * This function is designed to be called asynchronously after item creation
 * (non-blocking) to populate the embedding field for similarity search.
 *
 * @requires AWS_ACCESS_KEY_ID environment variable
 * @requires AWS_SECRET_ACCESS_KEY environment variable
 * @requires AWS_REGION environment variable
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BedrockRuntimeClient, InvokeModelCommand } from 'npm:@aws-sdk/client-bedrock-runtime';
import { corsHeaders } from '../_shared/cors.ts';

// Types
interface GenerateEmbeddingRequest {
  item_id?: string;
  text?: string;
}

interface GenerateEmbeddingResponse {
  success: boolean;
  item_id?: string;
  embedding?: number[];
  embedding_dimensions: number;
  generated_at: string;
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

interface ItemData {
  id: string;
  name: string | null;
  description: string | null;
  tags: string[];
  brand: string | null;
  user_id: string;
}

/**
 * Generate text representation of an item for embedding
 */
function buildEmbeddingText(item: ItemData): string {
  const parts: string[] = [];

  // Add item name (primary identifier)
  if (item.name) {
    parts.push(item.name);
  }

  // Add description
  if (item.description) {
    parts.push(item.description);
  }

  // Add tags
  if (item.tags && item.tags.length > 0) {
    parts.push(...item.tags);
  }

  // Add brand
  if (item.brand) {
    parts.push(item.brand);
  }

  // If no meaningful text, return empty string
  if (parts.length === 0) {
    return '';
  }

  return parts.join(' ');
}

/**
 * Call Amazon Bedrock Nova Multimodal Embeddings API
 *
 * Uses GENERIC_INDEX purpose for storing item embeddings (to be paired with
 * GENERIC_RETRIEVAL on the query side for asymmetric search).
 */
async function generateEmbeddingWithBedrock(
  text: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsRegion: string
): Promise<number[]> {
  // Truncate text if too long (conservative limit to stay within token budget)
  const maxLength = 8000;
  const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;

  const client = new BedrockRuntimeClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  const payload = {
    taskType: 'SINGLE_EMBEDDING',
    singleEmbeddingParams: {
      embeddingPurpose: 'GENERIC_INDEX', // Use GENERIC_INDEX for storing, GENERIC_RETRIEVAL for searching
      embeddingDimension: 1024,
      text: {
        truncationMode: 'END',
        value: truncatedText,
      },
    },
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-2-multimodal-embeddings-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Response format: { embeddings: [{ embeddingType: "TEXT", embedding: [...] }] }
  if (!responseBody.embeddings?.[0]?.embedding) {
    throw new Error('No embedding returned from Amazon Bedrock Nova');
  }

  return responseBody.embeddings[0].embedding as number[];
}

/**
 * Validate Supabase auth token
 */
async function validateAuth(
  authHeader: string | null,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { userId: user.id };
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
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsRegion = Deno.env.get('AWS_REGION');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
      const error: ApiError = {
        error: {
          message: 'AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
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

    // Validate auth token
    const authHeader = req.headers.get('Authorization');
    const auth = await validateAuth(authHeader, supabaseUrl, supabaseAnonKey);

    if (!auth) {
      const error: ApiError = {
        error: {
          message: 'Invalid or missing authentication token',
          code: 'UNAUTHORIZED',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body: GenerateEmbeddingRequest;
    try {
      body = await req.json();
    } catch {
      const error: ApiError = {
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate request - need either item_id or text
    if (!body.item_id && !body.text) {
      const error: ApiError = {
        error: {
          message: 'Either item_id or text is required',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let textToEmbed: string;
    let itemId: string | undefined;

    if (body.item_id) {
      // Fetch item from database
      const { data: item, error: fetchError } = await supabaseAdmin
        .from('items')
        .select('id, name, description, tags, brand, user_id')
        .eq('id', body.item_id)
        .single();

      if (fetchError || !item) {
        const error: ApiError = {
          error: {
            message: 'Item not found',
            code: 'NOT_FOUND',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the item belongs to the authenticated user
      if (item.user_id !== auth.userId) {
        const error: ApiError = {
          error: {
            message: 'You do not have permission to modify this item',
            code: 'FORBIDDEN',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build text representation
      textToEmbed = buildEmbeddingText(item as ItemData);
      itemId = body.item_id;

      // If no meaningful text to embed, skip
      if (!textToEmbed.trim()) {
        const error: ApiError = {
          error: {
            message: 'Item has no text content for embedding generation',
            code: 'NO_CONTENT',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Use provided text directly
      textToEmbed = body.text!;

      if (!textToEmbed.trim()) {
        const error: ApiError = {
          error: {
            message: 'Text cannot be empty',
            code: 'INVALID_REQUEST',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate embedding using Amazon Bedrock Nova Multimodal Embeddings
    const embedding = await generateEmbeddingWithBedrock(
      textToEmbed,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion
    );

    // If we have an item_id, update the item with the embedding
    if (itemId) {
      // Format embedding as PostgreSQL vector string
      const embeddingStr = `[${embedding.join(',')}]`;

      const { error: updateError } = await supabaseAdmin
        .from('items')
        .update({ embedding: embeddingStr })
        .eq('id', itemId);

      if (updateError) {
        console.error('Error updating item embedding:', updateError);
        const error: ApiError = {
          error: {
            message: 'Failed to update item with embedding',
            code: 'DATABASE_ERROR',
            details: updateError.message,
          },
        };
        return new Response(JSON.stringify(error), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build response
    // Include embedding in response only for text queries (not item_id)
    // This allows the client to use the embedding for search
    const response: GenerateEmbeddingResponse = {
      success: true,
      item_id: itemId,
      embedding: itemId ? undefined : embedding, // Only return embedding for text queries
      embedding_dimensions: 1024,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-embedding error:', error);

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
