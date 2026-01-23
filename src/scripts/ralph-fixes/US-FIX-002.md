# US-FIX-002: Server-side HEIC Fallback

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
When client-side HEIC conversion fails even after retries, users have no option but to use a different image. We should try server-side conversion as a fallback.

## Your Task
1. Create an Edge Function for server-side HEIC conversion
2. Update the frontend to call this as a fallback when client-side fails

## Files to Create/Modify
1. `supabase/functions/convert-image/index.ts` (new)
2. `src/lib/imageUtils.ts` - add server fallback

## Requirements

### 1. Create supabase/functions/convert-image/index.ts

```typescript
/**
 * Supabase Edge Function: convert-image
 * 
 * Converts HEIC/HEIF images to JPEG server-side as a fallback
 * when client-side conversion fails.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ConvertImageRequest {
  base64: string;
  mimeType: string;
}

interface ConvertImageResponse {
  converted: string;
  mimeType: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ConvertImageRequest = await req.json();
    
    if (!body.base64 || !body.mimeType) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing base64 or mimeType' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check file size (10MB limit)
    const sizeInBytes = (body.base64.length * 3) / 4;
    if (sizeInBytes > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: { message: 'File too large. Maximum size is 10MB.' } }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, since Deno doesn't have native HEIC support,
    // we'll return an error indicating server conversion is not available.
    // In production, you would use an external service or library.
    
    // Check if it's actually a HEIC file
    const isHeic = body.mimeType.includes('heic') || body.mimeType.includes('heif');
    
    if (!isHeic) {
      // If it's already JPEG/PNG, just return it
      return new Response(
        JSON.stringify({
          converted: body.base64,
          mimeType: body.mimeType,
        } as ConvertImageResponse),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // HEIC conversion not supported server-side yet
    // Return a helpful error message
    return new Response(
      JSON.stringify({ 
        error: { 
          message: 'Server-side HEIC conversion is not yet implemented. Please try a JPEG or PNG image.',
          code: 'HEIC_NOT_SUPPORTED'
        } 
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[convert-image] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 2. Update src/lib/imageUtils.ts

Add a function to call the server fallback:

```typescript
/**
 * Attempts server-side HEIC conversion as a fallback.
 * @param file - The HEIC file to convert
 * @returns Promise with the converted JPEG Blob, or throws if not available
 */
export async function serverConvertHeic(file: File): Promise<Blob> {
  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  const base64 = btoa(binary);

  console.log('[imageUtils] Attempting server-side HEIC conversion...');

  const { data, error } = await supabase.functions.invoke<{ converted: string; mimeType: string }>(
    'convert-image',
    {
      body: {
        base64,
        mimeType: file.type || 'image/heic',
      },
    }
  );

  if (error) {
    console.error('[imageUtils] Server conversion failed:', error);
    throw new Error(error.message || 'Server conversion failed');
  }

  if (!data?.converted) {
    throw new Error('No converted image returned from server');
  }

  // Convert base64 back to Blob
  const binaryString = atob(data.converted);
  const len = binaryString.length;
  const bytesArray = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytesArray[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytesArray], { type: data.mimeType || 'image/jpeg' });
}
```

### 3. Update convertHeicToJpeg to use server fallback

Modify the existing `convertHeicToJpeg` function to call `serverConvertHeic` as a last resort:

After the client-side retries fail (before throwing the final error), add:

```typescript
  // Try server-side conversion as last resort
  try {
    console.log('[imageUtils] Trying server-side conversion as fallback...');
    return await serverConvertHeic(file);
  } catch (serverError) {
    console.error('[imageUtils] Server-side conversion also failed:', serverError);
  }

  // All attempts failed
  throw new Error(...);
```

## Acceptance Criteria
- [ ] Edge Function `convert-image` exists and handles CORS
- [ ] Function validates authentication
- [ ] Function validates file size (10MB max)
- [ ] Function returns appropriate error for HEIC (501 Not Implemented)
- [ ] Frontend has `serverConvertHeic()` function
- [ ] `convertHeicToJpeg()` tries server as last fallback
- [ ] `npm run build` passes
- [ ] `npm run lint` passes

## Verification
Run these commands and verify they succeed:
```bash
cd ~/work/ownly && npm run build && npm run lint
```

When completely finished, output a summary of changes made.
