/**
 * EditListingModal - modal form to edit an existing listing
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useListings, type ListingWithItem } from '@/hooks/useListings';
import { useTransactions, type TransactionWithBuyer } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import type { ItemCondition, ListingStatus, PriceType } from '@/types/database';

export interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ListingWithItem | null;
  onSuccess: () => void;
}

interface ListingFormData {
  price: number | null;
  price_type: PriceType;
  condition: ItemCondition | '';
  description: string;
}

const DESCRIPTION_LIMIT = 500;

const priceTypeOptions: Array<{ label: string; value: PriceType }> = [
  { label: 'Fixed', value: 'fixed' },
  { label: 'Negotiable', value: 'negotiable' },
  { label: 'Free', value: 'free' },
];

const conditionOptions: Array<{ label: string; value: ItemCondition }> = [
  { label: 'New', value: 'new' },
  { label: 'Like New', value: 'like_new' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Poor', value: 'poor' },
];

function formatOfferPrice(price: number | null): string {
  if (price === null) {
    return 'Free';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

export function EditListingModal({ isOpen, onClose, listing, onSuccess }: EditListingModalProps) {
  const { updateListing, markAsSold, removeListing } = useListings();
  const { getTransactionsForListing, acceptTransaction, declineTransaction, completeTransaction } = useTransactions();
  const { success, error } = useToast();
  const confirmDialog = useConfirm();
  const [formData, setFormData] = useState<ListingFormData>({
    price: null,
    price_type: 'fixed',
    condition: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<{ price?: string; condition?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [transactions, setTransactions] = useState<TransactionWithBuyer[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ListingStatus | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!listing) return;
    setIsLoadingTransactions(true);

    try {
      const data = await getTransactionsForListing(listing.id);
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [getTransactionsForListing, listing]);

  useEffect(() => {
    if (isOpen && listing) {
      setFormData({
        price: listing.price,
        price_type: listing.price_type,
        condition: listing.condition,
        description: listing.description ?? '',
      });
      setFormErrors({});
      setIsSubmitting(false);
      setIsActioning(false);
      setCurrentStatus(listing.status);
      fetchTransactions();
    }
  }, [fetchTransactions, isOpen, listing]);

  const isFree = formData.price_type === 'free';
  const descriptionCount = formData.description.length;
  const listingStatus = currentStatus ?? listing?.status ?? 'active';
  const isActive = listingStatus === 'active';
  const pendingRequests = useMemo(() => (
    transactions.filter((transaction) => transaction.status === 'pending')
  ), [transactions]);
  const acceptedRequest = useMemo(() => (
    transactions.find((transaction) => transaction.status === 'accepted')
  ), [transactions]);

  const canSubmit = useMemo(() => {
    if (isSubmitting || isActioning) return false;
    if (!isFree && (formData.price === null || Number.isNaN(formData.price))) return false;
    if (!formData.condition) return false;
    return true;
  }, [formData.condition, formData.price, isFree, isSubmitting, isActioning]);

  const handlePriceChange = useCallback((value: string) => {
    if (value === '') {
      setFormData((prev) => ({ ...prev, price: null }));
      return;
    }
    const parsed = Number(value);
    setFormData((prev) => ({ ...prev, price: Number.isNaN(parsed) ? null : parsed }));
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!listing) return;

    const nextErrors: { price?: string; condition?: string } = {};

    if (!isFree && (formData.price === null || Number.isNaN(formData.price))) {
      nextErrors.price = 'Price is required';
    }

    if (!formData.condition) {
      nextErrors.condition = 'Condition is required';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const updated = await updateListing(listing.id, {
      price: formData.price_type === 'free' ? null : formData.price,
      price_type: formData.price_type,
      condition: formData.condition as ItemCondition,
      description: formData.description.trim() || null,
    });

    if (!updated) {
      error('Failed to update listing');
      setIsSubmitting(false);
      return;
    }

    success('Listing updated');
    onSuccess();
    onClose();
  }, [error, formData, isFree, listing, onClose, onSuccess, success, updateListing]);

  const handleMarkAsSold = useCallback(async () => {
    if (!listing || isActioning) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Mark as sold?',
      message: 'This listing will be marked as sold.',
      confirmText: 'Mark as Sold',
      variant: 'default',
    });

    if (!confirmed) return;

    setIsActioning(true);
    const updated = await markAsSold(listing.id);
    setIsActioning(false);

    if (!updated) {
      error('Failed to mark listing as sold');
      return;
    }

    success('Listing marked as sold');
    onSuccess();
    onClose();
  }, [confirmDialog, error, isActioning, listing, markAsSold, onClose, onSuccess, success]);

  const handleRemoveListing = useCallback(async () => {
    if (!listing || isActioning) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Remove listing?',
      message: 'This listing will be removed from the marketplace.',
      confirmText: 'Remove',
      variant: 'danger',
    });

    if (!confirmed) return;

    setIsActioning(true);
    const updated = await removeListing(listing.id);
    setIsActioning(false);

    if (!updated) {
      error('Failed to remove listing');
      return;
    }

    success('Listing removed');
    onSuccess();
    onClose();
  }, [confirmDialog, error, isActioning, listing, onClose, onSuccess, removeListing, success]);

  const handleAcceptRequest = useCallback(async (transactionId: string) => {
    if (isActioning) return;

    setIsActioning(true);
    const updated = await acceptTransaction(transactionId);
    setIsActioning(false);

    if (!updated) {
      error('Failed to accept request');
      return;
    }

    success('Request accepted');
    setCurrentStatus('reserved');
    await fetchTransactions();
    onSuccess();
  }, [acceptTransaction, error, fetchTransactions, isActioning, onSuccess, success]);

  const handleDeclineRequest = useCallback(async (transactionId: string) => {
    if (isActioning) return;

    setIsActioning(true);
    const updated = await declineTransaction(transactionId);
    setIsActioning(false);

    if (!updated) {
      error('Failed to decline request');
      return;
    }

    success('Request declined');
    await fetchTransactions();
    onSuccess();
  }, [declineTransaction, error, fetchTransactions, isActioning, onSuccess, success]);

  const handleCompleteTransaction = useCallback(async (transactionId: string) => {
    if (isActioning) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Complete transaction?',
      message: 'This will mark the transaction as completed and the listing as sold.',
      confirmText: 'Complete',
      variant: 'default',
    });

    if (!confirmed) return;

    setIsActioning(true);
    const updated = await completeTransaction(transactionId);
    setIsActioning(false);

    if (!updated) {
      error('Failed to complete transaction');
      return;
    }

    success('Transaction completed');
    setCurrentStatus('sold');
    await fetchTransactions();
    onSuccess();
  }, [completeTransaction, confirmDialog, error, fetchTransactions, isActioning, onSuccess, success]);

  if (!isOpen || !listing) {
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
          <h2 className="text-lg font-semibold text-[#4a3f35]">Edit listing</h2>
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
              src={listing.item.thumbnail_url || listing.item.photo_url}
              alt={listing.item.name || 'Listing'}
              className="w-14 h-14 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm text-[#a89887]">Listing</p>
              <p className="text-sm font-semibold text-[#4a3f35]">{listing.item.name || 'Untitled item'}</p>
            </div>
          </div>

          {/* Price type */}
          <div>
            <p className="text-sm font-medium text-[#4a3f35] mb-2">Price type</p>
            <div className="grid grid-cols-3 gap-2">
              {priceTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    formData.price_type === option.value
                      ? 'border-[#4a3f35] bg-[#fdf8f2] text-[#4a3f35]'
                      : 'border-[#f5ebe0] text-[#8d7b6d] hover:border-[#d6ccc2]'
                  }`}
                >
                  <input
                    type="radio"
                    name="price_type"
                    value={option.value}
                    checked={formData.price_type === option.value}
                    onChange={() => setFormData((prev) => ({
                      ...prev,
                      price_type: option.value,
                      price: option.value === 'free' ? null : prev.price,
                    }))}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* Price */}
          {!isFree && (
            <div>
              <label htmlFor="listing-price" className="block text-sm font-medium text-[#4a3f35] mb-2">
                Price
              </label>
              <input
                id="listing-price"
                type="number"
                value={formData.price ?? ''}
                onChange={(event) => handlePriceChange(event.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {formErrors.price && (
                <p className="mt-1 text-xs text-red-600">{formErrors.price}</p>
              )}
            </div>
          )}

          {/* Condition */}
          <div>
            <label htmlFor="listing-condition" className="block text-sm font-medium text-[#4a3f35] mb-2">
              Condition
            </label>
            <select
              id="listing-condition"
              value={formData.condition}
              onChange={(event) => setFormData((prev) => ({
                ...prev,
                condition: event.target.value as ItemCondition,
              }))}
              className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white"
            >
              <option value="" disabled>
                Select condition
              </option>
              {conditionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formErrors.condition && (
              <p className="mt-1 text-xs text-red-600">{formErrors.condition}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="listing-description" className="block text-sm font-medium text-[#4a3f35] mb-2">
              Description (optional)
            </label>
            <textarea
              id="listing-description"
              value={formData.description}
              onChange={(event) => {
                const next = event.target.value.slice(0, DESCRIPTION_LIMIT);
                setFormData((prev) => ({ ...prev, description: next }));
              }}
              rows={4}
              className="w-full px-4 py-3 border border-[#f5ebe0] rounded-xl focus:ring-2 focus:ring-[#d6ccc2] focus:border-[#d6ccc2] outline-none bg-white resize-none"
              placeholder="Add helpful details for buyers"
            />
            <div className="mt-1 text-xs text-[#a89887] text-right">
              {descriptionCount}/{DESCRIPTION_LIMIT}
            </div>
          </div>

          {/* Pending Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#4a3f35]">
                Pending Requests ({pendingRequests.length})
              </h3>
              {isLoadingTransactions && (
                <span className="text-xs text-[#a89887]">Loading...</span>
              )}
            </div>
            {pendingRequests.length === 0 ? (
              <div className="text-sm text-[#a89887] bg-white border border-[#f5ebe0] rounded-xl p-4">
                No pending requests right now.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="border border-[#f5ebe0] rounded-xl p-4 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#4a3f35]">
                          {(transaction.buyer?.display_name ?? 'Buyer')} offered {formatOfferPrice(transaction.agreed_price)}
                        </p>
                        {transaction.message && (
                          <p className="text-sm text-[#8d7b6d] mt-1">
                            &quot;{transaction.message}&quot;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(transaction.id)}
                          disabled={isActioning}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineRequest(transaction.id)}
                          disabled={isActioning}
                          className="px-3 py-1.5 border border-red-500 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {acceptedRequest && listingStatus === 'reserved' && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-emerald-800">Transaction Accepted</h3>
              <p className="text-sm text-emerald-700 mt-1">
                Coordinate pickup and payment with the buyer. Mark the transaction complete after handoff.
              </p>
              <button
                type="button"
                onClick={() => handleCompleteTransaction(acceptedRequest.id)}
                disabled={isActioning}
                className="mt-3 w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Transaction
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[#f5ebe0]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isActioning}
                className="flex-1 px-4 py-3 border border-[#f5ebe0] text-[#8d7b6d] font-medium rounded-xl hover:bg-[#fdf8f2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 px-4 py-3 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {isActive && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMarkAsSold}
                  disabled={isSubmitting || isActioning}
                  className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mark as Sold
                </button>
                <button
                  type="button"
                  onClick={handleRemoveListing}
                  disabled={isSubmitting || isActioning}
                  className="flex-1 px-4 py-3 border border-red-500 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove Listing
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
