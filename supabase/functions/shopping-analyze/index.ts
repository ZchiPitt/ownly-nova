/**
 * Supabase Edge Function: shopping-analyze
 *
 * Analyzes shopping photos using Amazon Bedrock Nova 2 Lite (vision + text) and
 * compares against user's existing inventory using vector similarity search.
 * Uses Amazon Nova Multimodal Embeddings for embedding generation.
 * Includes rate limiting to manage API costs.
 *
 * @requires AWS_ACCESS_KEY_ID environment variable
 * @requires AWS_SECRET_ACCESS_KEY environment variable
 * @requires AWS_REGION environment variable
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from 'npm:@aws-sdk/client-bedrock-runtime';
import { corsHeaders } from '../_shared/cors.ts';

// Types matching src/types/api.ts
interface DetectedItem {
  name: string;
  category_suggestion: string | null;
  tags: string[];
  brand: string | null;
  confidence: number;
}

interface SimilarItem {
  id: string;
  name: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  location_path: string | null;
  similarity: number;
}

interface ShoppingAnalyzeRequest {
  image_url: string;
}

interface ShoppingAnalyzeResponse {
  detected_item: DetectedItem | null;
  similar_items: SimilarItem[];
  advice: string | null;
  analyzed_at: string;
  usage: {
    photo_count: number;
    photo_limit: number;
  };
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

// Rate limits
const DAILY_PHOTO_LIMIT = 20;

// Nova vision model — must use cross-region inference profile prefix
const NOVA_VISION_MODEL_ID = 'us.amazon.nova-2-lite-v1:0';

// Nova embeddings model — no inference profile prefix required
const NOVA_EMBEDDINGS_MODEL_ID = 'amazon.nova-2-multimodal-embeddings-v1:0';

// Embedding dimension for Nova Multimodal Embeddings
const EMBEDDING_DIMENSION = 1024;

// System categories for matching (from database)
const SYSTEM_CATEGORIES = [
  'Clothing',
  'Food & Beverage',
  'Electronics',
  'Kitchen',
  'Sports & Fitness',
  'Tools',
  'Books & Documents',
  'Personal Care',
  'Home Decor',
  'Other',
];

/**
 * Nova 2 Lite Vision prompt for shopping item detection
 */
const VISION_PROMPT = `You are a smart shopping assistant helping users avoid buying duplicates.

Analyze this image of an item the user is considering buying. Identify the main item and provide:
1. A clear, descriptive name (be specific, e.g., "Blue Cotton T-Shirt" not just "Shirt")
2. A category suggestion from this list: ${SYSTEM_CATEGORIES.join(', ')}
3. Relevant tags (descriptive keywords like color, material, size, style, pattern)
4. Brand name if visible
5. Confidence score from 0.0 to 1.0

Return your analysis as a JSON object with this exact structure:
{
  "item": {
    "name": "item name",
    "category_suggestion": "category from list or null",
    "tags": ["tag1", "tag2", "tag3"],
    "brand": "brand name or null",
    "confidence": 0.95
  }
}

Important rules:
- Focus on the main/primary item being shown
- Be specific with names (include color, material, size when apparent)
- Keep tags concise (single words or short phrases)
- Only include brand if you can actually read/see it
- Return null for item if no clear item can be identified
- Always return valid JSON`;

/**
 * Nova prompt for generating shopping advice based on similar items
 */
function generateAdvicePrompt(
  detectedItem: DetectedItem,
  similarItems: Array<{ name: string | null; similarity: number }>
): string {
  const itemsDesc = similarItems
    .map(
      (item, i) =>
        `${i + 1}. "${item.name || 'Unnamed item'}" (${Math.round(item.similarity * 100)}% match)`
    )
    .join('\n');

  return `The user is considering buying: "${detectedItem.name}"

They already own these similar items:
${itemsDesc || 'No similar items found in their inventory.'}

Provide brief, helpful shopping advice (2-3 sentences max). Consider:
- If they have very similar items (>90% match), gently suggest they might already have this
- If items are somewhat similar (70-90%), note what they have and ask if they need another
- If no similar items or low similarity, encourage the purchase if it seems useful

Be friendly and concise. Start directly with the advice, no greeting needed.`;
}

/**
 * Fetch image URL and return raw bytes as Uint8Array
 */
async function fetchImageAsBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Map a MIME type or URL to the image format string required by Bedrock Converse.
 * Bedrock accepts: 'jpeg' | 'png' | 'gif' | 'webp'.
 * HEIC is not natively supported — fall back to 'jpeg' and let Nova handle it.
 */
function detectImageFormat(url: string): 'jpeg' | 'png' | 'webp' | 'gif' {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.png')) return 'png';
  if (urlLower.includes('.webp')) return 'webp';
  if (urlLower.includes('.gif')) return 'gif';
  // HEIC and JPEG both fall through to 'jpeg'
  return 'jpeg';
}

/**
 * Call Amazon Bedrock Nova 2 Lite (vision) to detect the item in a shopping photo.
 * Uses the Converse API with an image block and returns a structured DetectedItem.
 */
async function detectItemWithNova(
  imageUrl: string,
  client: BedrockRuntimeClient
): Promise<DetectedItem | null> {
  const imageBytes = await fetchImageAsBytes(imageUrl);
  const imageFormat = detectImageFormat(imageUrl);

  const command = new ConverseCommand({
    modelId: NOVA_VISION_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [
          { text: VISION_PROMPT },
          {
            image: {
              format: imageFormat,
              source: { bytes: imageBytes },
            },
          },
        ],
      },
    ],
    inferenceConfig: { temperature: 0.3, maxTokens: 500 },
  });

  const response = await client.send(command);
  const text = response.output?.message?.content?.[0]?.text;

  if (!text) {
    throw new Error('No response content from Nova vision model');
  }

  // Nova may wrap JSON in markdown fences — strip them if present
  const jsonText = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    const item = parsed.item;

    if (!item) {
      return null;
    }

    return {
      name: String(item.name || 'Unknown Item'),
      category_suggestion:
        item.category_suggestion && SYSTEM_CATEGORIES.includes(String(item.category_suggestion))
          ? String(item.category_suggestion)
          : null,
      tags: Array.isArray(item.tags)
        ? item.tags.slice(0, 20).map((t: unknown) => String(t).slice(0, 50))
        : [],
      brand: item.brand ? String(item.brand).slice(0, 100) : null,
      confidence:
        typeof item.confidence === 'number'
          ? Math.min(Math.max(item.confidence, 0), 1)
          : 0.5,
    };
  } catch {
    console.error('Failed to parse Nova vision response:', jsonText);
    return null;
  }
}

/**
 * Generate a 1024-dimension embedding for a detected item using
 * Amazon Nova Multimodal Embeddings (text-only path).
 */
async function generateEmbedding(
  item: DetectedItem,
  client: BedrockRuntimeClient
): Promise<number[]> {
  // Compose a rich text representation for the embedding
  const textParts = [item.name];
  if (item.category_suggestion) {
    textParts.push(item.category_suggestion);
  }
  if (item.tags.length > 0) {
    textParts.push(...item.tags);
  }
  if (item.brand) {
    textParts.push(item.brand);
  }

  const textToEmbed = textParts.join(' ');

  const payload = {
    taskType: 'SINGLE_EMBEDDING',
    singleEmbeddingParams: {
      embeddingPurpose: 'GENERIC_RETRIEVAL',
      embeddingDimension: EMBEDDING_DIMENSION,
      text: { truncationMode: 'END', value: textToEmbed },
    },
  };

  const command = new InvokeModelCommand({
    modelId: NOVA_EMBEDDINGS_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embeddings[0].embedding as number[];
}

/**
 * Generate shopping advice using Amazon Bedrock Nova 2 Lite (text-only).
 */
async function generateAdviceWithNova(
  detectedItem: DetectedItem,
  similarItems: Array<{ name: string | null; similarity: number }>,
  client: BedrockRuntimeClient
): Promise<string | null> {
  try {
    const command = new ConverseCommand({
      modelId: NOVA_VISION_MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: generateAdvicePrompt(detectedItem, similarItems) }],
        },
      ],
      inferenceConfig: { temperature: 0.7, maxTokens: 150 },
    });

    const response = await client.send(command);
    const text = response.output?.message?.content?.[0]?.text;
    return text?.trim() || null;
  } catch (error) {
    console.error('Error generating advice with Nova:', error);
    return null;
  }
}

/**
 * Search for similar items in user's inventory using vector similarity.
 * (unchanged)
 */
async function findSimilarItems(
  embedding: number[],
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<SimilarItem[]> {
  // Create admin client to bypass RLS for server-side search
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Format embedding as PostgreSQL vector string
  const embeddingStr = `[${embedding.join(',')}]`;

  // Call the search function with explicit user_id
  const { data, error } = await supabase.rpc('search_items_by_embedding', {
    query_embedding: embeddingStr,
    match_threshold: 0.6,
    match_count: 5,
    search_user_id: userId,
  });

  if (error) {
    console.error('Error searching similar items:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get location paths for the matching items
  const locationIds = data
    .map((item: { location_id: string | null }) => item.location_id)
    .filter((id: string | null): id is string => id !== null);

  let locationMap: Record<string, string> = {};

  if (locationIds.length > 0) {
    const { data: locations } = await supabase
      .from('locations')
      .select('id, path')
      .in('id', locationIds);

    if (locations) {
      locationMap = Object.fromEntries(
        locations.map((loc: { id: string; path: string }) => [loc.id, loc.path])
      );
    }
  }

  return data.map(
    (item: {
      id: string;
      name: string | null;
      photo_url: string;
      thumbnail_url: string | null;
      location_id: string | null;
      similarity: number;
    }) => ({
      id: item.id,
      name: item.name,
      photo_url: item.photo_url,
      thumbnail_url: item.thumbnail_url,
      location_path: item.location_id ? locationMap[item.location_id] || null : null,
      similarity: item.similarity,
    })
  );
}

/**
 * Get or create daily usage record for user.
 * (unchanged)
 */
async function getDailyUsage(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ photo_count: number; date: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Try to get existing usage record
  const { data: existing } = await supabase
    .from('shopping_usage')
    .select('photo_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  if (existing) {
    return { photo_count: existing.photo_count, date: today };
  }

  // Create new usage record if it doesn't exist
  const { data: created, error } = await supabase
    .from('shopping_usage')
    .insert({ user_id: userId, usage_date: today, photo_count: 0 })
    .select('photo_count')
    .single();

  if (error) {
    // Might fail due to race condition — try to get again
    const { data: retry } = await supabase
      .from('shopping_usage')
      .select('photo_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (retry) {
      return { photo_count: retry.photo_count, date: today };
    }

    console.error('Error getting/creating usage:', error);
    return { photo_count: 0, date: today };
  }

  return { photo_count: created.photo_count, date: today };
}

/**
 * Increment photo usage count.
 * (unchanged)
 */
async function incrementPhotoUsage(
  userId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_shopping_photo_usage', {
    p_user_id: userId,
    p_date: today,
  });
}

/**
 * Validate Supabase auth token.
 * (unchanged)
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
    const awsRegion = Deno.env.get('AWS_REGION') ?? 'us-east-1';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      const error: ApiError = {
        error: {
          message: 'AWS credentials not configured',
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

    // Instantiate the Bedrock client once and share it across all AI calls
    const bedrockClient = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

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

    // Check rate limit
    const usage = await getDailyUsage(auth.userId, supabaseUrl, supabaseServiceKey);

    if (usage.photo_count >= DAILY_PHOTO_LIMIT) {
      const error: ApiError = {
        error: {
          message: "You've reached today's limit. Try again tomorrow!",
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            photo_count: usage.photo_count,
            photo_limit: DAILY_PHOTO_LIMIT,
          },
        },
      };
      return new Response(JSON.stringify(error), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body: ShoppingAnalyzeRequest;
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

    // Validate request
    if (!body.image_url) {
      const error: ApiError = {
        error: {
          message: 'image_url is required',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL format
    try {
      new URL(body.image_url);
    } catch {
      const error: ApiError = {
        error: {
          message: 'Invalid image_url format',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment usage count (before expensive API calls to avoid double-counting on retry)
    await incrementPhotoUsage(auth.userId, supabaseUrl, supabaseServiceKey);
    const newPhotoCount = usage.photo_count + 1;

    // Step 1: Detect item using Nova 2 Lite Vision
    const detectedItem = await detectItemWithNova(body.image_url, bedrockClient);

    // If no item detected, return early
    if (!detectedItem) {
      const response: ShoppingAnalyzeResponse = {
        detected_item: null,
        similar_items: [],
        advice:
          "I couldn't identify a clear item in this photo. Try taking a clearer picture of the item you're considering.",
        analyzed_at: new Date().toISOString(),
        usage: {
          photo_count: newPhotoCount,
          photo_limit: DAILY_PHOTO_LIMIT,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Generate 1024-dim embedding using Nova Multimodal Embeddings
    const embedding = await generateEmbedding(detectedItem, bedrockClient);

    // Step 3: Search for similar items in user's inventory
    const similarItems = await findSimilarItems(
      embedding,
      auth.userId,
      supabaseUrl,
      supabaseServiceKey
    );

    // Step 4: Generate shopping advice using Nova 2 Lite (text)
    const advice = await generateAdviceWithNova(
      detectedItem,
      similarItems.map((item) => ({
        name: item.name,
        similarity: item.similarity,
      })),
      bedrockClient
    );

    // Build response
    const response: ShoppingAnalyzeResponse = {
      detected_item: detectedItem,
      similar_items: similarItems,
      advice: advice,
      analyzed_at: new Date().toISOString(),
      usage: {
        photo_count: newPhotoCount,
        photo_limit: DAILY_PHOTO_LIMIT,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('shopping-analyze error:', error);

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
