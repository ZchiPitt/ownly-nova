/**
 * Seller Profile Page
 * Route: /marketplace/seller/:sellerId
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useReviews } from '@/hooks/useReviews';
import { StarRating } from '@/components/StarRating';
import type { Profile } from '@/types/database';

function BackIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function SellerProfilePage() {
  const navigate = useNavigate();
  const { sellerId } = useParams<{ sellerId: string }>();
  const { getReviewsForUser } = useReviews();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof getReviewsForUser>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!sellerId) {
      setLoadError('Seller not found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await (supabase.from('profiles') as ReturnType<typeof supabase.from>)
        .select(`
          id,
          user_id,
          display_name,
          bio,
          avatar_url,
          location_city,
          seller_rating,
          review_count,
          is_verified,
          total_sold,
          response_rate,
          last_active_at,
          created_at,
          updated_at
        `)
        .eq('id', sellerId)
        .single();

      if (error || !data) {
        setLoadError(error?.message || 'Unable to load seller profile.');
        setProfile(null);
        return;
      }

      setProfile(data as Profile);
      const reviewData = await getReviewsForUser(sellerId);
      setReviews(reviewData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load seller profile.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getReviewsForUser, sellerId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const ratingValue = profile?.seller_rating ?? 0;
  const reviewCount = profile?.review_count ?? 0;
  const ratingLabel = useMemo(() => (reviewCount > 0 ? ratingValue.toFixed(1) : '0.0'), [ratingValue, reviewCount]);
  const recentReviews = useMemo(() => reviews.slice(0, 5), [reviews]);

  return (
    <div className="min-h-screen bg-[#fdf8f2]">
      <div className="sticky top-0 z-10 bg-white border-b border-[#f5ebe0]/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-[#8d7b6d] hover:bg-[#f3ece4] rounded-full transition-colors"
            aria-label="Go back"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-[#4a3f35]">Seller Profile</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="bg-white border border-[#f5ebe0]/60 rounded-2xl p-6 text-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#efe6dc] mx-auto mb-4" />
            <div className="h-4 w-40 bg-[#efe6dc] rounded mx-auto mb-2" />
            <div className="h-3 w-24 bg-[#efe6dc] rounded mx-auto" />
          </div>
        ) : loadError || !profile ? (
          <div className="bg-white border border-[#f5ebe0]/60 rounded-2xl p-6 text-center">
            <p className="text-sm text-[#8d7b6d]">{loadError ?? 'Seller not found.'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-[#f5ebe0]/60 rounded-2xl p-6">
              <div className="flex items-center gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name ?? 'Seller avatar'}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#efe6dc] flex items-center justify-center text-[#8d7b6d] text-xl font-semibold">
                    {(profile.display_name ?? 'S').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-semibold text-[#4a3f35]">
                    {profile.display_name ?? 'Seller'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={ratingValue} />
                    <span className="text-sm font-medium text-[#6f5f52]">
                      {ratingLabel}
                    </span>
                    <span className="text-sm text-[#8d7b6d]">
                      ({reviewCount} review{reviewCount === 1 ? '' : 's'})
                    </span>
                  </div>
                  <div className="text-xs text-[#8d7b6d] mt-2">
                    {profile.location_city && <span>📍 {profile.location_city}</span>}
                    {profile.location_city && <span className="mx-1">·</span>}
                    <span>Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              {profile.bio && (
                <p className="text-sm text-[#8d7b6d] mt-4">{profile.bio}</p>
              )}
            </div>

            <div className="bg-white border border-[#f5ebe0]/60 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#4a3f35]">
                  Reviews ({reviewCount})
                </h2>
              </div>
              {recentReviews.length === 0 ? (
                <p className="text-sm text-[#8d7b6d]">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentReviews.map((review) => (
                    <div
                      key={review.id}
                      className="border border-[#f5ebe0]/60 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="sm" />
                          <p className="text-sm font-semibold text-[#4a3f35]">
                            {review.reviewer?.display_name ?? 'Member'}
                          </p>
                        </div>
                        <span className="text-xs text-[#8d7b6d]">
                          {formatRelativeTime(review.created_at)}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-[#8d7b6d] mt-2">
                          &quot;{review.comment}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
