/**
 * ReviewModal - prompt user to leave a review after transaction
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReviews } from '@/hooks/useReviews';
import { useToast } from '@/hooks/useToast';
import { StarRating } from '@/components/StarRating';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    listing: { item_name: string | null };
    other_user: { id: string; display_name: string | null };
  };
  onSuccess: () => void;
}

const COMMENT_LIMIT = 500;

export function ReviewModal({ isOpen, onClose, transaction, onSuccess }: ReviewModalProps) {
  const { createReview } = useReviews();
  const { success, error } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setComment('');
      setIsSubmitting(false);
    }
  }, [isOpen, transaction.id]);

  const canSubmit = useMemo(() => rating > 0 && !isSubmitting, [isSubmitting, rating]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!rating) {
      error('Please select a rating.');
      return;
    }

    setIsSubmitting(true);
    const created = await createReview({
      transaction_id: transaction.id,
      reviewee_id: transaction.other_user.id,
      rating,
      comment: comment.trim() || undefined,
    });

    if (!created) {
      error('Unable to submit review.');
      setIsSubmitting(false);
      return;
    }

    success('Review submitted.');
    onSuccess();
    onClose();
  }, [comment, createReview, error, onClose, onSuccess, rating, success, transaction.id, transaction.other_user.id]);

  if (!isOpen) {
    return null;
  }

  const displayName = transaction.other_user.display_name ?? 'User';
  const itemName = transaction.listing.item_name ?? 'Transaction';
  const commentCount = comment.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#4a3f35]/20 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-[#fdf8f2] sm:rounded-xl rounded-t-xl shadow-xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f5ebe0] flex-shrink-0">
          <h2 className="text-lg font-semibold text-[#4a3f35]">
            Rate your experience with {displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-[#d6ccc2] hover:text-[#8d7b6d]"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div className="flex items-center gap-3 p-3 bg-white border border-[#f5ebe0] rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-[#fdf8f2] border border-[#f5ebe0] flex items-center justify-center text-[#8d7b6d]">
              ⭐
            </div>
            <div>
              <p className="text-sm text-[#a89887]">Transaction</p>
              <p className="text-sm font-semibold text-[#4a3f35]">{itemName}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#4a3f35] mb-2">Your rating</p>
            <StarRating rating={rating} onChange={setRating} size="lg" />
            {!rating && (
              <p className="text-xs text-[#a89887] mt-2">Tap a star to select your rating.</p>
            )}
          </div>

          <div>
            <label htmlFor="review-comment" className="block text-sm font-medium text-[#4a3f35] mb-2">
              Comment (optional)
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(event) => {
                const next = event.target.value.slice(0, COMMENT_LIMIT);
                setComment(next);
              }}
              rows={4}
              className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white resize-none"
              placeholder="Share details about your experience"
            />
            <div className="mt-1 text-xs text-[#a89887] text-right">
              {commentCount}/{COMMENT_LIMIT}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-[#f5ebe0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-[#f5ebe0] text-[#8d7b6d] font-medium rounded-xl hover:bg-[#fdf8f2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-3 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
