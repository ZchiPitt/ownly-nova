/**
 * Supabase Edge Function: subscriptions-create-checkout
 *
 * Creates a Stripe Checkout Session for subscription (Basic or Pro).
 * Requires auth; sets client_reference_id to user id for webhook.
 */

import Stripe from "https://esm.sh/stripe@11.2.0?target=deno";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
  : null;


Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: { message: 'Missing or invalid authorization' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: { message: 'Server configuration error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!stripe) {
    return new Response(
      JSON.stringify({ error: { message: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid or expired session' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: { plan?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON body' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const plan = body.plan === 'basic' || body.plan === 'pro' ? body.plan : null;
  if (!plan) {
    return new Response(
      JSON.stringify({ error: { message: 'Missing or invalid plan (use "basic" or "pro")' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prefer price from subscription_plans (Stripe catalog values)
  const { data: planRow } = await supabase
    .from('subscription_plans')
    .select('stripe_price_id')
    .eq('slug', plan)
    .maybeSingle();

  const priceId =
    (planRow?.stripe_price_id && planRow.stripe_price_id.trim() !== ''
      ? planRow.stripe_price_id
      : null);

  if (!priceId) {
    return new Response(
      JSON.stringify({
        error: {
          message: `No price configured for plan "${plan}". Set stripe_price_id on the plan in subscription_plans (copy Price ID from Stripe Dashboard → Products), or set STRIPE_PRICE_ID_${plan === 'pro' ? 'PRO' : 'BASIC'}.`,
        },
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const successUrl = typeof body.success_url === 'string' ? body.success_url : undefined;
  const cancelUrl = typeof body.cancel_url === 'string' ? body.cancel_url : undefined;
  if (!successUrl || !cancelUrl) {
    return new Response(
      JSON.stringify({ error: { message: 'Missing success_url or cancel_url' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Optional: use existing Stripe customer if we have one on the profile
  let customerId: string | undefined;
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.stripe_customer_id) {
    customerId = profile.stripe_customer_id;
  }

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
    };
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return new Response(
        JSON.stringify({ error: { message: 'Checkout session has no URL' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe checkout failed';
    return new Response(
      JSON.stringify({ error: { message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
