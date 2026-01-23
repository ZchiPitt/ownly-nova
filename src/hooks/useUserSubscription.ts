/**
 * Hook for fetching the current user's subscription plan.
 * Returns the plan slug (free, basic, pro) based on active user_subscriptions.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type PlanSlug = 'free' | 'basic' | 'pro';

interface UseUserSubscriptionReturn {
  /** Current plan slug; 'free' when no active paid subscription */
  plan: PlanSlug;
  isLoading: boolean;
  refetch: () => void;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export function useUserSubscription(): UseUserSubscriptionReturn {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanSlug>('free');
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: sub, error: subError } = await (supabase
        .from('user_subscriptions') as ReturnType<typeof supabase.from>)
        .select('subscription_uuid')
        .eq('user_uuid', user.id)
        .in('status', ['active', 'trialing'])
        .or(`end_date.is.null,end_date.gte.${TODAY()}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const subData = sub as { subscription_uuid: string } | null;
      if (subError || !subData?.subscription_uuid) {
        setPlan('free');
        return;
      }

      const { data: planRow, error: planError } = await (supabase
        .from('subscription_plans') as ReturnType<typeof supabase.from>)
        .select('slug')
        .eq('id', subData.subscription_uuid)
        .maybeSingle();

      const planData = planRow as { slug: string } | null;
      if (planError || !planData?.slug) {
        setPlan('free');
        return;
      }

      const slug = planData.slug;
      setPlan(slug === 'basic' || slug === 'pro' ? slug : 'free');
    } catch {
      setPlan('free');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { plan, isLoading, refetch: fetchSubscription };
}
