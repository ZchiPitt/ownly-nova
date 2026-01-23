/**
 * Supabase Edge Function: stripe-webhook
 *
 * Handles Stripe webhook events for billing and subscriptions:
 * - checkout.session.completed: link customer, create user_subscriptions row
 * - customer.subscription.updated: sync status, end_date, paid_thru
 * - customer.subscription.deleted: mark subscription canceled
 *
 * Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
 * Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * Supabase URL and SERVICE_ROLE_KEY are provided by the runtime.
 */

import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
});

// Required for Web Crypto in Deno when verifying webhook signatures
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing Stripe-Signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verification must use the raw body; do not parse JSON first
  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      stripeWebhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }
      default:
        // Log but do not fail for unhandled event types
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Webhook handler error [${event.type}]:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Handler failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

/**
 * On successful checkout: set profile stripe_customer_id and create user_subscriptions row.
 * Expects client_reference_id to be the Supabase auth user id.
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripeClient: Stripe,
  session: Stripe.Checkout.Session
) {
  const userId = session.client_reference_id as string | null;
  if (!userId) {
    console.warn('checkout.session.completed: missing client_reference_id');
    return;
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  if (customerId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Failed to update profile stripe_customer_id:', profileError);
      throw profileError;
    }
  }

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.warn('checkout.session.completed: no price on subscription');
    return;
  }

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .maybeSingle();

  if (planError || !plan) {
    console.warn('checkout.session.completed: plan not found for price', priceId, planError);
    return;
  }

  const startDate = new Date(subscription.current_period_start * 1000).toISOString().slice(0, 10);
  const paidThru = new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10);
  const status = mapStripeStatus(subscription.status);

  const { error: insertError } = await supabase.from('user_subscriptions').insert({
    user_uuid: userId,
    subscription_uuid: plan.id,
    start_date: startDate,
    end_date: null,
    paid_thru: paidThru,
    stripe_subscription_id: subscription.id,
    status,
  });

  if (insertError) {
    console.error('Failed to insert user_subscriptions:', insertError);
    throw insertError;
  }
}

/**
 * Sync user_subscriptions row when Stripe subscription is updated.
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const { data: row, error: findError } = await supabase
    .from('user_subscriptions')
    .select('uuid')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (findError || !row) {
    return;
  }

  const paidThru = new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10);
  const endDate = subscription.cancel_at_period_end
    ? paidThru
    : null;
  const status = mapStripeStatus(subscription.status);

  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status,
      end_date: endDate,
      paid_thru: paidThru,
    })
    .eq('uuid', row.uuid);

  if (updateError) {
    console.error('Failed to update user_subscriptions:', updateError);
    throw updateError;
  }
}

/**
 * Mark user_subscriptions as canceled when Stripe subscription is deleted.
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const endDate = new Date().toISOString().slice(0, 10);
  const paidThru = new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      end_date: endDate,
      paid_thru: paidThru,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to update user_subscriptions (deleted):', error);
    throw error;
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    case 'incomplete':
      return 'incomplete';
    case 'paused':
      return 'paused';
    default:
      return status;
  }
}
