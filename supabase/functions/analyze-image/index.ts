/**
 * Supabase Edge Function: analyze-image
 *
 * Analyzes images using Amazon Bedrock Nova 2 Lite to detect items,
 * suggest categories, extract tags, and identify brands.
 *
 * @requires AWS_ACCESS_KEY_ID environment variable
 * @requires AWS_SECRET_ACCESS_KEY environment variable
 * @requires AWS_REGION environment variable
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BedrockRuntimeClient, ConverseCommand } from 'npm:@aws-sdk/client-bedrock-runtime';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Types matching src/types/api.ts
interface DetectedItem {
  name: string;
  category_suggestion: string | null;
  tags: string[];
  brand: string | null;
  confidence: number;
  bbox: [number, number, number, number];
}

interface AnalyzeImageRequest {
  image_url?: string;
  storage_path?: string; // e.g., "items/user-id/filename.jpg"
}

interface AnalyzeImageResponse {
  detected_items: DetectedItem[];
  analysis_model: string;
  analyzed_at: string;
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

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
 * Amazon Nova 2 Lite Vision prompt for item detection
 */
const VISION_PROMPT = `You are an expert inventory assistant analyzing photos of household items.

Analyze this image and identify all distinct items you can see. For each item, provide:
1. A clear, descriptive name (be specific, e.g., "Blue Cotton T-Shirt" not just "Shirt")
2. A category suggestion from this list: ${SYSTEM_CATEGORIES.join(', ')}
3. Relevant tags - IMPORTANT: The FIRST tag MUST be the dominant color of the item (e.g., "blue", "red", "black", "white", "silver", "brown", "beige", "navy", "gray").
   If multiple colors, use the most prominent one.
   If color is unclear, use "multicolor" or "neutral".
   Remaining tags: material, condition, size, style, etc.
   Example: "tags": ["navy blue", "cotton", "casual", "medium"]
4. Brand name if visible on the item
5. Confidence score from 0.0 to 1.0 (how certain you are about the identification)
6. A 2D bounding box for the item in the image. Return the box as "box_2d": [y_min, x_min, y_max, x_max] where coordinates are integers from 0 to 1000 representing the position relative to image dimensions. Be precise - the box should tightly enclose just the item, not the entire image.

Return your analysis as a JSON object with this exact structure:
{
  "items": [
    {
      "name": "item name",
      "category_suggestion": "category from list or null",
      "tags": ["tag1", "tag2", "tag3"],
      "brand": "brand name or null",
      "confidence": 0.95,
      "box_2d": [200, 100, 600, 500]
    }
  ]
}

Important rules:
- Only identify items that are clearly visible
- Be specific with names (include color, material, size when apparent)
- Keep tags concise (single words or short phrases)
- Only include brand if you can actually read/see it
- Set confidence lower if the item is partially obscured or unclear
- Return an empty items array if no items can be identified
- The box_2d MUST tightly enclose just the specific item, not the whole image. For example, if a basket is on the bottom shelf of a rack, the box should only cover the basket area.
- Always return valid JSON`;

const COLOR_WORDS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
  'black', 'white', 'gray', 'grey', 'brown', 'beige', 'tan',
  'navy', 'teal', 'cyan', 'magenta', 'gold', 'silver', 'bronze',
  'cream', 'ivory', 'coral', 'maroon', 'olive', 'turquoise',
  'multicolor', 'neutral', 'clear', 'transparent',
];

const DEFAULT_BBOX: [number, number, number, number] = [0, 0, 100, 100];

// Check if first tag contains a color
function hasColorTag(tags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const firstTag = tags[0].toLowerCase();
  return COLOR_WORDS.some((color) => firstTag.includes(color));
}

/**
 * Convert Nova box_2d [y_min, x_min, y_max, x_max] (0-1000 scale)
 * to our format [x%, y%, width%, height%] (0-100 scale)
 */
function convertBox2dToBbox(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    console.warn('[analyze-image] Invalid box_2d format:', value);
    return DEFAULT_BBOX;
  }

  const numbers = value.map((entry) => Number(entry));
  if (numbers.some((entry) => !Number.isFinite(entry))) {
    console.warn('[analyze-image] Non-finite box_2d values:', value);
    return DEFAULT_BBOX;
  }

  let [yMin, xMin, yMax, xMax] = numbers;

  // Clamp to 0-1000 range
  yMin = Math.max(0, Math.min(yMin, 1000));
  xMin = Math.max(0, Math.min(xMin, 1000));
  yMax = Math.max(0, Math.min(yMax, 1000));
  xMax = Math.max(0, Math.min(xMax, 1000));

  // Ensure min < max
  if (xMax <= xMin || yMax <= yMin) {
    console.warn('[analyze-image] Invalid box_2d dimensions:', { yMin, xMin, yMax, xMax });
    return DEFAULT_BBOX;
  }

  // Convert to [x%, y%, width%, height%] in 0-100 scale
  const x = (xMin / 1000) * 100;
  const y = (yMin / 1000) * 100;
  const width = ((xMax - xMin) / 1000) * 100;
  const height = ((yMax - yMin) / 1000) * 100;

  console.log(`[analyze-image] box_2d [${yMin},${xMin},${yMax},${xMax}] -> bbox [${x.toFixed(1)},${y.toFixed(1)},${width.toFixed(1)},${height.toFixed(1)}]`);

  return [
    Math.round(x * 10) / 10,
    Math.round(y * 10) / 10,
    Math.round(width * 10) / 10,
    Math.round(height * 10) / 10,
  ];
}

/**
 * Map MIME type string to the image format literal expected by Bedrock Converse API.
 * Nova supports: 'jpeg' | 'png' | 'gif' | 'webp'
 */
function mimeTypeToNovaFormat(mimeType: string): 'jpeg' | 'png' | 'gif' | 'webp' {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      // Covers image/jpeg, image/jpg, image/heic (already converted upstream), and unknown types
      return 'jpeg';
  }
}

/**
 * Fetch image from URL and return raw bytes as Uint8Array
 */
async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = detectMimeType(url);
  return { bytes: new Uint8Array(arrayBuffer), mimeType };
}

/**
 * Download image from Supabase Storage using service role key.
 * Returns raw bytes so they can be passed directly to the Nova API.
 */
async function downloadFromStorage(
  storagePath: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  // Create admin client with service role key
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Extract bucket and path from storage_path (format: "bucket/path/to/file.jpg")
  const pathParts = storagePath.split('/');
  const bucket = pathParts[0];
  const filePath = pathParts.slice(1).join('/');

  console.log(`[analyze-image] Downloading from bucket: ${bucket}, path: ${filePath}`);

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error) {
    console.error('[analyze-image] Storage download error:', error);
    throw new Error(`Failed to download image from storage: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from storage');
  }

  const arrayBuffer = await data.arrayBuffer();
  const mimeType = detectMimeType(filePath);

  return { bytes: new Uint8Array(arrayBuffer), mimeType };
}

/**
 * Detect MIME type from URL or default to JPEG
 */
function detectMimeType(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.png')) return 'image/png';
  if (urlLower.includes('.webp')) return 'image/webp';
  if (urlLower.includes('.heic')) return 'image/heic';
  return 'image/jpeg'; // Default
}

/**
 * Call Amazon Bedrock Nova 2 Lite Vision API via the Converse endpoint
 */
async function analyzeWithNova(
  imageData: { bytes: Uint8Array; mimeType: string },
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsRegion: string
): Promise<DetectedItem[]> {
  const client = new BedrockRuntimeClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  const { bytes, mimeType } = imageData;
  const imageFormat = mimeTypeToNovaFormat(mimeType);

  console.log(`[analyze-image] Calling Nova 2 Lite with format: ${imageFormat}, bytes: ${bytes.length}`);

  const command = new ConverseCommand({
    modelId: 'us.amazon.nova-2-lite-v1:0',
    messages: [
      {
        role: 'user',
        content: [
          { text: VISION_PROMPT },
          {
            image: {
              format: imageFormat,
              source: {
                bytes: bytes,
              },
            },
          },
        ],
      },
    ],
    inferenceConfig: {
      temperature: 0.3,
      maxTokens: 2000,
    },
  });

  const novaResponse = await client.send(command);
  let text = novaResponse.output?.message?.content?.[0]?.text;

  if (!text) {
    throw new Error('No response content from Nova');
  }

  // Strip markdown code fence if present (```json ... ```)
  text = text.trim();
  if (text.startsWith('```')) {
    // Remove opening fence (```json or ```)
    text = text.replace(/^```(?:json)?\s*\n?/, '');
    // Remove closing fence
    text = text.replace(/\n?```\s*$/, '');
  }

  console.log(`[analyze-image] Cleaned Nova response: ${text.substring(0, 200)}...`);

  try {
    const parsed = JSON.parse(text);
    const items = parsed.items || [];

    // Validate and sanitize response
    return items.map((item: Record<string, unknown>) => {
      const tags = Array.isArray(item.tags)
        ? item.tags.slice(0, 20).map((t) => String(t).slice(0, 50)) // Max 20 tags, 50 chars each
        : [];

      if (!hasColorTag(tags)) {
        console.warn('[analyze-image] Missing color tag on first tag:', tags);
      }

      return {
        name: String(item.name || 'Unknown Item'),
        category_suggestion:
          item.category_suggestion && SYSTEM_CATEGORIES.includes(String(item.category_suggestion))
            ? String(item.category_suggestion)
            : null,
        tags,
        brand: item.brand ? String(item.brand).slice(0, 100) : null, // Max 100 chars
        confidence:
          typeof item.confidence === 'number'
            ? Math.min(Math.max(item.confidence, 0), 1) // Clamp to 0-1
            : 0.5,
        bbox: convertBox2dToBbox(item.box_2d),
      };
    }) as DetectedItem[];
  } catch {
    console.error('Failed to parse Nova response:', text);
    throw new Error('Failed to parse AI analysis result');
  }
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

  // Create Supabase client with the user's token
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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

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

    if (!supabaseUrl || !supabaseKey) {
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
    const auth = await validateAuth(authHeader, supabaseUrl, supabaseKey);

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
    let body: AnalyzeImageRequest;
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

    // Validate request - require either image_url or storage_path
    if (!body.image_url && !body.storage_path) {
      const error: ApiError = {
        error: {
          message: 'Either image_url or storage_path is required',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get image data - either from URL or storage
    let imageData: { bytes: Uint8Array; mimeType: string };

    if (body.storage_path) {
      // Download from Supabase Storage using service role key
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceRoleKey) {
        const error: ApiError = {
          error: {
            message: 'Service role key not configured',
            code: 'CONFIGURATION_ERROR',
          },
        };
        return new Response(JSON.stringify(error), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[analyze-image] Using storage_path: ${body.storage_path}`);
      imageData = await downloadFromStorage(body.storage_path, supabaseUrl, serviceRoleKey);
    } else if (body.image_url) {
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

      console.log(`[analyze-image] Using image_url: ${body.image_url}`);
      imageData = await fetchImageAsBytes(body.image_url);
    } else {
      throw new Error('No image source provided');
    }

    // Call Amazon Bedrock Nova 2 Lite Vision API
    const detectedItems = await analyzeWithNova(imageData, awsAccessKeyId, awsSecretAccessKey, awsRegion);

    // Build response
    const response: AnalyzeImageResponse = {
      detected_items: detectedItems,
      analysis_model: 'amazon.nova-2-lite-v1:0',
      analyzed_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('analyze-image error:', error);

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
