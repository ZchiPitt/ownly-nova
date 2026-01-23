/**
 * Plans Page
 * Three cards: current tier (Free), Basic, Pro. ChatGPT-style layout.
 * Pro = green theme; Basic = black/white; Free = current plan, no subscribe.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { SkeletonCard } from '@/components/Skeleton';

const FREE_FEATURES = [
  '500 items in inventory',
  '5 AI requests per day',
];

const BASIC_FEATURES = [
  'Store up to 5k items/photos in Inventory',
  'AI message usage limited to 50 requests per day',
  'Standard item listing and Marketplace access',
  'No identity verification',
];

const PRO_FEATURES = [
  'Unlimited inventory photos/items',
  'Unlimited AI usage quota',
  'Identity verification badge displayed on Marketplace',
  'Access to advanced features (e.g. priority AI responses, richer item insights)',
  'Increased trust and visibility in Marketplace listings',
];

function ChevronLeftIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}



function ChevronRightIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

type PlanSlug = 'free' | 'basic' | 'pro';

interface PlanCardProps {
  slug: PlanSlug;
  title: string;
  price?: string;
  tagline: string;
  features: string[];
  onSubscribe?: (plan: 'basic' | 'pro') => void;
  checkoutLoading: 'basic' | 'pro' | null;
  isCurrent?: boolean;
}

function PlanCard({ slug, title, price, tagline, features, onSubscribe, checkoutLoading, isCurrent }: PlanCardProps) {
  const isPro = slug === 'pro';

  // Ownly Styling: rounded-[2.5rem], soft shadow, white bg, thin cream border
  const cardWrapperClass = isPro
    ? 'rounded-[2.5rem] bg-white shadow-xl ring-1 ring-[#d6ccc2]/50 lg:scale-[1.03] z-10 overflow-hidden relative transform-gpu transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:ring-[#b8cda0]/60 hover:lg:scale-[1.05] active:scale-[1.01]'
    : 'rounded-[2.5rem] bg-white shadow-sm border border-[#f5ebe0] overflow-hidden opacity-95 transform-gpu transition-all duration-300 hover:opacity-100 hover:-translate-y-1 hover:shadow-xl hover:border-[#d6ccc2] hover:ring-1 hover:ring-[#e3ead3]/70 active:scale-[0.995]';

  return (
    <article className={`flex flex-col ${cardWrapperClass}`}>
      <div className="p-8 pb-5 flex-1 flex flex-col">
        <div className="mb-2">
          {/* Title Color: Brown */}
          <h2 className={`text-2xl font-black tracking-tight ${isPro ? 'text-[#4a3f35]' : 'text-[#4a3f35]'}`}>{title}</h2>
          <p className="text-sm mt-1 text-[#8d7b6d] font-medium">{tagline}</p>
        </div>

        {/* Price */}
        {price ? (
          <div className="mt-4 mb-6 flex items-baseline gap-1">
            <span className="text-4xl font-black text-[#4a3f35] tracking-tight">{price.split('/')[0]}</span>
            <span className="text-sm text-[#8d7b6d] font-medium">/ month</span>
          </div>
        ) : (
          <div className="mt-4 mb-6 flex items-baseline gap-1">
            <span className="text-4xl font-black text-[#4a3f35] tracking-tight">Free</span>
          </div>
        )}

        {/* Divider */}
        <div className="w-full h-px bg-[#f5ebe0] mb-6" />

        <ul className="space-y-4 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[#4a3f35]">
              <div className={`mt-0.5 rounded-full p-0.5 ${isPro ? 'bg-[#d6ccc2]/30 text-[#4a3f35]' : 'bg-[#f5ebe0] text-[#8d7b6d]'}`}>
                <CheckIcon />
              </div>
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto p-8 pt-0">
        {isCurrent ? (
          <div className="w-full py-4 rounded-2xl bg-[#f5ebe0] text-[#4a3f35] text-center text-sm font-bold tracking-wide">
            CURRENT PLAN
          </div>
        ) : (slug === 'basic' || slug === 'pro') && onSubscribe ? (
          <button
            type="button"
            onClick={() => onSubscribe(slug === 'basic' ? 'basic' : 'pro')}
            disabled={checkoutLoading !== null}
            className={
              isPro
                ? 'w-full py-4 rounded-2xl font-bold text-sm text-white bg-[#4a3f35] hover:bg-[#3d332b] shadow-lg shadow-[#4a3f35]/10 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed'
                : 'w-full py-4 rounded-2xl font-bold text-sm text-[#4a3f35] bg-white border-2 border-[#f5ebe0] hover:border-[#d6ccc2] hover:bg-[#f9f5f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {checkoutLoading === (slug === 'basic' ? 'basic' : 'pro') ? 'Redirecting…' : 'Subscribe'}
          </button>
        ) : (
          <div className="w-full py-4 text-center text-sm font-medium text-[#8d7b6d]">
            —
          </div>
        )}
      </div>
    </article>
  );
}

export function PlansPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState<'basic' | 'pro' | null>(null);
  const { plan: currentPlan, isLoading: subscriptionLoading, refetch: refetchSubscription } = useUserSubscription();

  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      success('Subscription activated. Thank you!');
      setSearchParams({}, { replace: true });
      refetchSubscription();
    }
  }, [searchParams, setSearchParams, success, refetchSubscription]);

  const handleSubscribe = async (plan: 'basic' | 'pro') => {
    setCheckoutLoading(plan);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        error('Please sign in to subscribe.');
        return;
      }
      const { data: { session: freshSession }, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
      const token = (refreshError ? session : freshSession)?.access_token;
      if (!token) {
        error('Session expired. Please sign in again.');
        return;
      }
      const baseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
      if (!baseUrl) {
        error('App misconfiguration: VITE_SUPABASE_URL is not set.');
        return;
      }
      const res = await fetch(`${baseUrl}/functions/v1/subscriptions-create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/plans?subscription=success`,
          cancel_url: `${window.location.origin}/plans`,
        }),
      });
      let data: { url?: string; error?: { message?: string } };
      try {
        data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        error(res.ok ? 'Invalid response from server.' : `Checkout failed (${res.status} ${res.statusText}). Is the function deployed?`);
        return;
      }
      if (!res.ok) {
        const msg = data?.error?.message || `Checkout failed (${res.status}).`;
        error(msg);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      error('No checkout URL returned.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Checkout failed.';
      error(msg.includes('fetch') ? 'Network error. Is the function deployed and reachable?' : msg);
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f5f1]">
      {/* Header */}
      <div className="px-6 py-8 sm:px-8 border-b border-[#f5ebe0]/0">
        <div className="max-w-7xl mx-auto relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center p-3 rounded-full text-[#8d7b6d] hover:bg-[#f5ebe0] transition-colors"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-black text-[#4a3f35] tracking-tight">Subscription Plans</h1>
            <p className="text-[#8d7b6d] mt-1 font-medium">Unlock the full potential of your inventory.</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-10 sm:px-8 sm:pb-12">
        {/* Spacer so gap below header is always visible */}
        <div className="h-8 sm:h-10 shrink-0" aria-hidden />
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 lg:gap-12 items-stretch pb-12">
            {subscriptionLoading ? (
              <>
                <SkeletonCard showImage={false} lines={5} className="rounded-[2.5rem] h-96 bg-white soft-shadow" />
                <SkeletonCard showImage={false} lines={5} className="rounded-[2.5rem] h-96 bg-white soft-shadow" />
                <SkeletonCard showImage={false} lines={5} className="rounded-[2.5rem] h-96 bg-white soft-shadow" />
              </>
            ) : (
              <>
                <PlanCard
                  slug="free"
                  title="Free Plan"
                  price="$0 / month"
                  tagline="Get started with core features."
                  features={FREE_FEATURES}
                  checkoutLoading={checkoutLoading}
                  isCurrent={currentPlan === 'free'}
                />
                <PlanCard
                  slug="basic"
                  title="Basic Plan"
                  price="$2.99"
                  tagline="Designed for light or casual users."
                  features={BASIC_FEATURES}
                  onSubscribe={handleSubscribe}
                  checkoutLoading={checkoutLoading}
                  isCurrent={currentPlan === 'basic'}
                />
                <PlanCard
                  slug="pro"
                  title="Pro Plan"
                  price="$9.99 / month"
                  tagline="For power users & frequent sellers."
                  features={PRO_FEATURES}
                  onSubscribe={handleSubscribe}
                  checkoutLoading={checkoutLoading}
                  isCurrent={currentPlan === 'pro'}
                />
              </>
            )}
          </div>
        </div>

        <div className="mx-auto mt-12 w-full max-w-7xl">
          <Link
            to="/settings"
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#f5ebe0] bg-white text-[#4a3f35] hover:bg-[#fdf8f2]"
          >
            <span className="text-base font-medium">Back to Settings</span>
            <ChevronRightIcon className="w-5 h-5 text-[#d6ccc2]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
