/**
 * Save (wishlist) button for marketplace listings
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedListings } from '@/hooks/useSavedListings';
import { useToast } from '@/hooks/useToast';

interface SaveButtonProps {
  listingId: string;
  initialSaved?: boolean;
  size?: 'sm' | 'md';
  onToggle?: (saved: boolean) => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      />
    </svg>
  );
}

export function SaveButton({
  listingId,
  initialSaved,
  size = 'sm',
  onToggle,
}: SaveButtonProps) {
  const { user } = useAuth();
  const { isListingSaved, saveListing, unsaveListing } = useSavedListings();
  const { success, error } = useToast();
  const [saved, setSaved] = useState<boolean>(initialSaved ?? false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (initialSaved !== undefined) {
      setSaved(initialSaved);
      return undefined;
    }

    if (!user || !listingId) {
      setSaved(false);
      return undefined;
    }

    const loadSaved = async () => {
      const isSaved = await isListingSaved(listingId);
      if (isActive) {
        setSaved(isSaved);
      }
    };

    loadSaved();

    return () => {
      isActive = false;
    };
  }, [initialSaved, isListingSaved, listingId, user]);

  const handleToggle = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (!user) {
      error('Please sign in to save listings.');
      return;
    }

    if (isLoading) return;

    const nextSaved = !saved;
    setSaved(nextSaved);
    setIsLoading(true);

    const successResult = nextSaved
      ? await saveListing(listingId)
      : await unsaveListing(listingId);

    setIsLoading(false);

    if (!successResult) {
      setSaved(!nextSaved);
      error('Unable to update saved listing.');
      return;
    }

    if (nextSaved) {
      success('Saved!');
    } else {
      success('Removed from saved');
    }

    onToggle?.(nextSaved);
  }, [error, isLoading, listingId, onToggle, saveListing, saved, success, unsaveListing, user]);

  const sizeClasses = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const iconClasses = saved ? 'text-rose-500' : 'text-[#d6ccc2]';

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center justify-center rounded-full bg-white/90 backdrop-blur shadow-sm border border-white/60 hover:bg-white transition-colors ${sizeClasses} ${iconClasses}`}
      aria-label={saved ? 'Remove from saved listings' : 'Save listing'}
      aria-pressed={saved}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
