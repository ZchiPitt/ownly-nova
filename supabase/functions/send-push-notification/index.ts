/**
 * Supabase Edge Function: send-push-notification
 *
 * Sends Web Push notifications to user devices when notifications are created.
 * Called by database trigger on notifications table INSERT.
 *
 * @requires SUPABASE_URL environment variable
 * @requires SUPABASE_SERVICE_ROLE_KEY environment variable
 * @requires VAPID_PUBLIC_KEY environment variable
 * @requires VAPID_PRIVATE_KEY environment variable
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Web Push requires these libraries for Deno
// Using the web-push compatible implementation for Deno
import * as base64 from 'https://deno.land/std@0.208.0/encoding/base64.ts';

// Types
interface SendPushRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  type?: string;
  notification_id?: string;
  sound_enabled?: boolean; // Whether to play sound/vibrate (fetched from user settings if not provided)
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
}

interface SubscriptionResult {
  subscription_id: string;
  endpoint: string;
  success: boolean;
  error?: string;
}

interface SendPushResponse {
  success: boolean;
  sent_count: number;
  failed_count: number;
  removed_count: number;
  results: SubscriptionResult[];
}

interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Converts a URL-safe base64 string to a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Converts a Uint8Array to a URL-safe base64 string
 */
function uint8ArrayToUrlBase64(array: Uint8Array): string {
  const base64String = base64.encodeBase64(array);
  return base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Import a raw P-256 public key for ECDH
 */
async function importP256PublicKey(keyData: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Import a PKCS8 private key for ECDSA signing
 */
async function importVapidPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  // VAPID private key is a raw 32-byte key, need to wrap it in PKCS8 format
  const privateKeyBytes = urlBase64ToUint8Array(privateKeyBase64);

  // P-256 PKCS8 prefix for a 32-byte private key
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  // P-256 PKCS8 suffix (public key placeholder)
  const pkcs8Suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00, 0x04,
    // 64 bytes of zeros as placeholder for public key
    ...new Array(64).fill(0),
  ]);

  const pkcs8Key = new Uint8Array(pkcs8Prefix.length + privateKeyBytes.length + pkcs8Suffix.length);
  pkcs8Key.set(pkcs8Prefix, 0);
  pkcs8Key.set(privateKeyBytes, pkcs8Prefix.length);
  pkcs8Key.set(pkcs8Suffix, pkcs8Prefix.length + privateKeyBytes.length);

  return await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );
}

/**
 * Create VAPID JWT token for Web Push authorization
 */
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: CryptoKey
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 12 * 60 * 60; // 12 hours

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: expires,
    sub: subject,
  };

  const headerB64 = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(new TextEncoder().encode(JSON.stringify(payload)));

  const unsignedToken = `${headerB64}.${payloadB64}`;
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s)
  const signature = new Uint8Array(signatureBuffer);
  const signatureB64 = uint8ArrayToUrlBase64(signature);

  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Encrypt payload using Web Push encryption (aes128gcm)
 */
async function encryptPayload(
  payload: string,
  subscriptionPublicKey: string,
  subscriptionAuth: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export server public key
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  // Import subscription public key
  const clientPublicKeyBytes = urlBase64ToUint8Array(subscriptionPublicKey);
  const clientPublicKey = await importP256PublicKey(clientPublicKeyBytes);

  // Derive shared secret
  const sharedSecretBuffer = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeys.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBuffer);

  // Import auth secret
  const authSecret = urlBase64ToUint8Array(subscriptionAuth);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive PRK using HKDF
  const authInfo = new TextEncoder().encode('WebPush: info\x00');
  const authInfoFull = new Uint8Array(authInfo.length + clientPublicKeyBytes.length + serverPublicKey.length);
  authInfoFull.set(authInfo, 0);
  authInfoFull.set(clientPublicKeyBytes, authInfo.length);
  authInfoFull.set(serverPublicKey, authInfo.length + clientPublicKeyBytes.length);

  // HKDF extract
  const authHkdfKey = await crypto.subtle.importKey(
    'raw',
    authSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // For the IKM, we need to use the shared secret properly
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive PRK from auth secret and shared secret
  const prkBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: authSecret,
      info: authInfoFull,
    },
    ikmKey,
    256
  );
  const prk = new Uint8Array(prkBits);

  // Import PRK for further derivation
  const prkKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive content encryption key (CEK)
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
  const cekBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: cekInfo,
    },
    prkKey,
    128
  );
  const cek = new Uint8Array(cekBits);

  // Derive nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');
  const nonceBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: nonceInfo,
    },
    prkKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  // Prepare payload with padding
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 2; // Delimiter
  paddedPayload[payloadBytes.length + 1] = 0; // Padding

  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );

  return {
    encrypted: new Uint8Array(ciphertext),
    salt,
    serverPublicKey,
  };
}

/**
 * Send a Web Push notification to a single subscription
 */
async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: SendPushRequest,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  soundEnabled: boolean
): Promise<{ success: boolean; shouldRemove: boolean; error?: string }> {
  try {
    // Parse endpoint URL to get audience
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    // Create notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      type: payload.type || 'system',
      notification_id: payload.notification_id,
      sound_enabled: soundEnabled, // Include sound preference for service worker
    });

    // Encrypt payload
    const { encrypted, salt, serverPublicKey } = await encryptPayload(
      notificationPayload,
      subscription.p256dh,
      subscription.auth
    );

    // Import VAPID private key for signing
    const privateKey = await importVapidPrivateKey(vapidPrivateKey);

    // Create VAPID JWT
    const jwt = await createVapidJwt(audience, vapidSubject, vapidPublicKey, privateKey);

    // Build aes128gcm encrypted body
    // Header: salt (16) + record size (4) + keyid length (1) + keyid (65)
    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, 4096, false);

    const body = new Uint8Array(16 + 4 + 1 + serverPublicKey.length + encrypted.length);
    body.set(salt, 0);
    body.set(recordSize, 16);
    body[20] = serverPublicKey.length;
    body.set(serverPublicKey, 21);
    body.set(encrypted, 21 + serverPublicKey.length);

    // Send push request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': body.length.toString(),
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Urgency': 'normal',
      },
      body: body,
    });

    if (response.ok || response.status === 201) {
      return { success: true, shouldRemove: false };
    }

    // Handle error responses
    const statusCode = response.status;
    const responseText = await response.text();

    console.error(`[send-push] Push failed with status ${statusCode}: ${responseText}`);

    // 404, 410 = subscription expired/invalid, should be removed
    if (statusCode === 404 || statusCode === 410) {
      return {
        success: false,
        shouldRemove: true,
        error: `Subscription expired or invalid (${statusCode})`,
      };
    }

    // 429 = rate limited, don't remove
    if (statusCode === 429) {
      return {
        success: false,
        shouldRemove: false,
        error: 'Rate limited by push service',
      };
    }

    // Other errors
    return {
      success: false,
      shouldRemove: false,
      error: `Push failed with status ${statusCode}: ${responseText}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[send-push] Error sending push:`, error);
    return {
      success: false,
      shouldRemove: false,
      error: errorMessage,
    };
  }
}

/**
 * Remove invalid subscriptions from the database
 */
async function removeSubscription(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('id', subscriptionId);

  if (error) {
    console.error(`[send-push] Failed to remove subscription ${subscriptionId}:`, error);
  } else {
    console.log(`[send-push] Removed invalid subscription ${subscriptionId}`);
  }
}

/**
 * Update last_used_at for successful subscriptions
 */
async function updateSubscriptionLastUsed(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) {
    console.error(`[send-push] Failed to update last_used_at for ${subscriptionId}:`, error);
  }
}

/**
 * Mark notification as pushed after successful delivery
 */
async function markNotificationAsPushed(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_pushed: true,
      pushed_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error(`[send-push] Failed to mark notification ${notificationId} as pushed:`, error);
  } else {
    console.log(`[send-push] Marked notification ${notificationId} as pushed`);
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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

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

    if (!vapidPublicKey || !vapidPrivateKey) {
      const error: ApiError = {
        error: {
          message: 'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Supabase secrets.',
          code: 'CONFIGURATION_ERROR',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // VAPID subject should be a mailto: or https: URL
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@ownly.app';

    // Parse request body
    let body: SendPushRequest;
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

    // Validate required fields
    if (!body.user_id || !body.title || !body.body) {
      const error: ApiError = {
        error: {
          message: 'Missing required fields: user_id, title, body',
          code: 'INVALID_REQUEST',
        },
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-push] Sending push to user ${body.user_id}: ${body.title}`);

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine sound_enabled preference
    // If explicitly provided in request, use that value; otherwise fetch from user settings
    let soundEnabled = body.sound_enabled;
    if (soundEnabled === undefined) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('notification_sound_enabled')
        .eq('user_id', body.user_id)
        .single();

      // Default to true if user settings not found or column not set
      soundEnabled = userSettings?.notification_sound_enabled ?? true;
      console.log(`[send-push] User sound preference: ${soundEnabled}`);
    }

    // Get all active subscriptions for the user
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, is_active')
      .eq('user_id', body.user_id)
      .eq('is_active', true);

    if (subscriptionsError) {
      throw new Error(`Failed to fetch subscriptions: ${subscriptionsError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[send-push] No active subscriptions for user ${body.user_id}`);
      const response: SendPushResponse = {
        success: true,
        sent_count: 0,
        failed_count: 0,
        removed_count: 0,
        results: [],
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-push] Found ${subscriptions.length} active subscription(s)`);

    // Send push to all subscriptions
    const results: SubscriptionResult[] = [];
    const subscriptionsToRemove: string[] = [];
    const subscriptionsSuccessful: string[] = [];

    for (const subscription of subscriptions as PushSubscription[]) {
      const result = await sendPushToSubscription(
        subscription,
        body,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject,
        soundEnabled
      );

      results.push({
        subscription_id: subscription.id,
        endpoint: subscription.endpoint,
        success: result.success,
        error: result.error,
      });

      if (result.shouldRemove) {
        subscriptionsToRemove.push(subscription.id);
      } else if (result.success) {
        subscriptionsSuccessful.push(subscription.id);
      }
    }

    // Remove invalid subscriptions
    for (const subscriptionId of subscriptionsToRemove) {
      await removeSubscription(supabase, subscriptionId);
    }

    // Update last_used_at for successful subscriptions
    for (const subscriptionId of subscriptionsSuccessful) {
      await updateSubscriptionLastUsed(supabase, subscriptionId);
    }

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    // Mark notification as pushed if at least one push was successful
    if (sentCount > 0 && body.notification_id) {
      await markNotificationAsPushed(supabase, body.notification_id);
    }

    console.log(`[send-push] Completed: ${sentCount} sent, ${failedCount} failed, ${subscriptionsToRemove.length} removed`);

    const response: SendPushResponse = {
      success: sentCount > 0 || results.length === 0,
      sent_count: sentCount,
      failed_count: failedCount,
      removed_count: subscriptionsToRemove.length,
      results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-push] Error:', error);

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
