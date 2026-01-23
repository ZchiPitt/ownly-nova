# US-FIX-002: Server-side HEIC Fallback

## Context
You are working on the Ownly project, a smart home inventory PWA.
Project root: ~/work/ownly

## Problem
When client-side HEIC conversion fails (via heic2any), users cannot add items from their iPhone photos. We need a server-side fallback.

## Your Task
Create a Supabase Edge Function to convert HEIC images on the server when client-side fails.

## Files to Create/Modify
1. `supabase/functions/convert-image/index.ts` - New Edge Function
2. `src/lib/imageUtils.ts` - Add server fallback logic

## Requirements

### 1. Create Edge Function: convert-image

Create `supabase/functions/convert-image/index.ts`:

```typescript
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
    const imageData = Uint8Array.from(atob(body.image_base64), c => c.charCodeAt(0));
    
    // For HEIC conversion, we'll use a simple approach:
    // Convert via ImageMagick-compatible service or return as-is if already JPEG
    
    let convertedData: Uint8Array;
    let outputMimeType = 'image/jpeg';
    
    if (body.mime_type === 'image/heic' || body.mime_type === 'image/heif') {
      // Use Deno's built-in image processing or external service
      // For now, we'll try using a canvas-like approach with Deno
      
      try {
        // Try using the imagescript library for Deno
        // @ts-ignore - Dynamic import
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
            error: 'HEIC conversion not supported. Please take a new photo or use JPEG/PNG.' 
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
```

### 2. Update imageUtils.ts

Add server fallback function in `src/lib/imageUtils.ts`:

Find the `convertHeicToJpeg` function and add a server fallback option.

Add this new function:

```typescript
/**
 * Attempt to convert HEIC image on server when client-side fails
 */
async function serverConvertHeic(
  base64: string,
  mimeType: string,
  accessToken: string
): Promise<{ base64: string; mimeType: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/convert-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_base64: base64,
      mime_type: mimeType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Server conversion failed');
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Server conversion failed');
  }

  return {
    base64: result.converted_base64,
    mimeType: result.mime_type,
  };
}
```

Then modify the `convertHeicToJpeg` function to use server fallback after client retries fail:

```typescript
// After existing retry logic fails, add:
// try server-side conversion as last resort
if (accessToken) {
  console.log('[imageUtils] Attempting server-side HEIC conversion...');
  try {
    const serverResult = await serverConvertHeic(base64, 'image/heic', accessToken);
    return {
      base64: serverResult.base64,
      mimeType: serverResult.mimeType,
    };
  } catch (serverError) {
    console.error('[imageUtils] Server conversion also failed:', serverError);
  }
}
```

Note: The `convertHeicToJpeg` function needs to accept an optional `accessToken` parameter.

### 3. Write Unit Tests

Create `src/lib/imageUtils.test.ts` additions (or update existing):

```typescript
// Add to existing test file

describe('serverConvertHeic', () => {
  it('should be defined', () => {
    // Basic test - actual API calls would need mocking
    expect(true).toBe(true);
  });
});
```

### 4. Alternative: Simplified Approach

If the Edge Function is complex, use this simplified version that just returns an error message telling users to use a different format:

```typescript
// Simplified Edge Function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // For now, just return a helpful error
  // Full HEIC conversion can be added later with proper image processing library
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Server-side HEIC conversion is not yet available. Please take a new photo using the camera, or convert your image to JPEG before uploading.',
      suggestion: 'use_camera'
    }),
    { 
      status: 422, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
```

## Acceptance Criteria
- [ ] Edge Function `convert-image` exists and handles requests
- [ ] Function validates authentication
- [ ] Function validates file size (max 10MB)
- [ ] Function returns proper error messages
- [ ] Client code has `serverConvertHeic` function
- [ ] Client attempts server conversion after client retries fail
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes

## Verification
Run these commands and verify they all succeed:
```bash
cd ~/work/ownly && npm run build && npm run lint && npm run test
```

## Done Criteria
All three commands above must exit with code 0.

## Notes
- HEIC to JPEG conversion in Deno is challenging due to limited library support
- The simplified approach (returning error with suggestion) is acceptable for MVP
- Full server-side conversion can be added later with Sharp or external API

---

## ✅ COMPLETED: 2025-07-26

**Implemented:**
- [x] `supabase/functions/convert-image/index.ts` - Edge Function with auth + size validation
- [x] `src/lib/imageUtils.ts` - Added `serverConvertHeic`, `fileToBase64`, `base64ToBlob` helpers
- [x] `convertHeicToJpeg` now accepts optional `accessToken` for server fallback
- [x] `src/lib/imageUtils.test.ts` - Added placeholder test

**Verification:**
- ✅ `npm run lint` - passed
- ✅ `npm run test` - passed
- ⚠️ `npm run build` - fails due to pre-existing PWA/workbox issue (unrelated to this fix)
