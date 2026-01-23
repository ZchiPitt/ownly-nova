/**
 * PurchaseRequestModal - modal for sending a purchase request to seller
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/useToast';
import type { PriceType } from '@/types/database';

export interface PurchaseRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: {
    id: string;
    price: number | null;
    price_type: PriceType;
    item: { name: string; photo_url: string };
    seller_id: string;
  };
  onSuccess: () => void;
}

interface PurchaseRequestForm {
  offer_price: number | null;
  message: string;
}

const MESSAGE_LIMIT = 200;

function formatPrice(price: number | null, priceType: PriceType): string {
  if (priceType === 'free' || price === null) {
    return 'Free';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

export function PurchaseRequestModal({
  isOpen,
  onClose,
  listing,
  onSuccess,
}: PurchaseRequestModalProps) {
  const { createTransaction } = useTransactions();
  const { success, error } = useToast();
  const [formData, setFormData] = useState<PurchaseRequestForm>({
    offer_price: null,
    message: '',
  });
  const [formErrors, setFormErrors] = useState<{ offer_price?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ offer_price: null, message: '' });
      setFormErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, listing.id]);

  const isNegotiable = listing.price_type === 'negotiable';
  const messageCount = formData.message.length;

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (isNegotiable && (formData.offer_price === null || Number.isNaN(formData.offer_price))) return false;
    return true;
  }, [formData.offer_price, isNegotiable, isSubmitting]);

  const handleOfferChange = useCallback((value: string) => {
    if (value === '') {
      setFormData((prev) => ({ ...prev, offer_price: null }));
      return;
    }
    const parsed = Number(value);
    setFormData((prev) => ({ ...prev, offer_price: Number.isNaN(parsed) ? null : parsed }));
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: { offer_price?: string } = {};

    if (isNegotiable && (formData.offer_price === null || Number.isNaN(formData.offer_price))) {
      nextErrors.offer_price = 'Offer price is required';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const agreedPrice = (() => {
      if (listing.price_type === 'free') return null;
      if (listing.price_type === 'negotiable') return formData.offer_price;
      return listing.price;
    })();

    setIsSubmitting(true);

    const { error: submitError } = await createTransaction({
      listing_id: listing.id,
      seller_id: listing.seller_id,
      agreed_price: agreedPrice,
      message: formData.message.trim(),
    });

    if (submitError) {
      error('Failed to send request');
      setIsSubmitting(false);
      return;
    }

    success('Request sent to seller');
    onSuccess();
    onClose();
  }, [createTransaction, error, formData.message, formData.offer_price, isNegotiable, listing.id, listing.price, listing.price_type, listing.seller_id, onClose, onSuccess, success]);

  if (!isOpen) {
    return null;
  }

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
          <h2 className="text-lg font-semibold text-[#4a3f35]">Purchase request</h2>
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
          {/* Item preview */}
          <div className="flex items-center gap-3 p-3 bg-white border border-[#f5ebe0] rounded-xl">
            <img
              src={listing.item.photo_url}
              alt={listing.item.name}
              className="w-14 h-14 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm text-[#a89887]">Item</p>
              <p className="text-sm font-semibold text-[#4a3f35]">{listing.item.name}</p>
              <p className="text-xs text-[#a89887] mt-1">
                {formatPrice(listing.price, listing.price_type)}
              </p>
            </div>
          </div>

          {/* Offer */}
          {isNegotiable && (
            <div>
              <label htmlFor="offer-price" className="block text-sm font-medium text-[#4a3f35] mb-2">
                Your Offer
              </label>
              <input
                id="offer-price"
                type="number"
                value={formData.offer_price ?? ''}
                onChange={(event) => handleOfferChange(event.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {formErrors.offer_price && (
                <p className="mt-1 text-xs text-red-600">{formErrors.offer_price}</p>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <label htmlFor="offer-message" className="block text-sm font-medium text-[#4a3f35] mb-2">
              Message to seller (optional)
            </label>
            <textarea
              id="offer-message"
              value={formData.message}
              onChange={(event) => {
                const next = event.target.value.slice(0, MESSAGE_LIMIT);
                setFormData((prev) => ({ ...prev, message: next }));
              }}
              rows={4}
              className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white resize-none"
              placeholder="Add a note for the seller"
            />
            <div className="mt-1 text-xs text-[#a89887] text-right">
              {messageCount}/{MESSAGE_LIMIT}
            </div>
          </div>

          {/* Actions */}
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
              {isSubmitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
