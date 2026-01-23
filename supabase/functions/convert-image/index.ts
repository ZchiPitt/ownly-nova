import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertRequest {
  image_base64: string;
  mime_type: string;
}

interface ConvertResponse {
  converted_base64: string;
  mime_type: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user with Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ConvertRequest = await req.json();

    if (!body.image_base64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing image_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate base64 size (max 10MB)
    const base64Size = (body.image_base64.length * 3) / 4;
    if (base64Size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Image too large (max 10MB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[convert-image] Processing image, size:', Math.round(base64Size / 1024), 'KB');

    // Decode base64 to binary
    const imageData = Uint8Array.from(atob(body.image_base64), (c) => c.charCodeAt(0));

    // For HEIC conversion, we'll use a simple approach:
    // Convert via ImageMagick-compatible service or return as-is if already JPEG
    let convertedData: Uint8Array;
    let outputMimeType = 'image/jpeg';

    if (body.mime_type === 'image/heic' || body.mime_type === 'image/heif') {
      // Use Deno's built-in image processing or external service
      // For now, we'll try using a canvas-like approach with Deno
      try {
        // Try using the imagescript library for Deno
        // @ts-expect-error - Dynamic import
        const { decode } = await import('https://deno.land/x/imagescript@1.2.15/mod.ts');

        const image = await decode(imageData);
        convertedData = await image.encodeJPEG(85);

        console.log('[convert-image] Successfully converted HEIC to JPEG');
      } catch (conversionError) {
        console.error('[convert-image] HEIC conversion failed:', conversionError);

        // Fallback: return error asking user to take a new photo
        return new Response(
          JSON.stringify({
            success: false,
            error: 'HEIC conversion not supported. Please take a new photo or use JPEG/PNG.',
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Already a supported format, return as-is
      convertedData = imageData;
      outputMimeType = body.mime_type || 'image/jpeg';
    }

    // Encode result back to base64
    const convertedBase64 = btoa(String.fromCharCode(...convertedData));

    const response: ConvertResponse = {
      converted_base64: convertedBase64,
      mime_type: outputMimeType,
      success: true,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[convert-image] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
