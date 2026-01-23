/**
 * Dashboard Page - Home screen of the app (Ownly Style)
 */

import { useState, useCallback } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useExpiringItems } from '@/hooks/useExpiringItems';
import { useRecentItems } from '@/hooks/useRecentItems';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { Toast } from '@/components/Toast';
import { HeroSection } from '@/components/dashboard/HeroSection';
import { MarketplaceSection } from '@/components/dashboard/MarketplaceSection';
import { AgentSection } from '@/components/dashboard/AgentSection';

export function DashboardPage() {
  const { stats, refetch: refetchStats } = useDashboardStats();
  const { refetch: refetchExpiring } = useExpiringItems(7, 3);
  const { items: recentItems, isLoading: recentLoading, refetch: refetchRecent } = useRecentItems(5);

  // Toast state for refresh feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      // Refresh all data in parallel
      await Promise.all([
        refetchStats(),
        refetchExpiring(),
        refetchRecent(),
      ]);
    } catch {
      setToast({ message: 'Refresh failed', type: 'error' });
    }
  }, [refetchStats, refetchExpiring, refetchRecent]);

  // Pull-to-refresh hook
  const {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    threshold,
  } = usePullToRefresh({ onRefresh: handleRefresh });

  return (
    <div
      className="min-h-full p-3 sm:p-4 space-y-4 sm:space-y-6 max-w-2xl mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        threshold={threshold}
        isPulling={isPulling}
        isRefreshing={isRefreshing}
      />

      {/* Hero Section: View/Edit/Find my belongings */}
      <HeroSection
        recentItems={recentItems}
        isLoading={recentLoading}
        totalItems={stats.totalItems} // Fallback nicely inside component if loading
      />

      {/* Marketplace Section: Buy & sell with neighbors */}
      <MarketplaceSection />

      {/* Agent Section: Talk to the Ownly Agent! */}
      <AgentSection />

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
