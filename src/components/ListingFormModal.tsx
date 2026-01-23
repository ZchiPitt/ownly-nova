/**
 * ListingFormModal - modal form to list an inventory item for sale or share
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useListings } from '@/hooks/useListings';
import { useToast } from '@/hooks/useToast';
import type { ItemCondition, PriceType } from '@/types/database';

export interface ListingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    photo_url: string;
  };
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

const defaultFormData: ListingFormData = {
  price: null,
  price_type: 'fixed',
  condition: '',
  description: '',
};

export function ListingFormModal({ isOpen, onClose, item, onSuccess }: ListingFormModalProps) {
  const { createListing } = useListings();
  const { success, error } = useToast();
  const [formData, setFormData] = useState<ListingFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<{ price?: string; condition?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(defaultFormData);
      setFormErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, item.id]);

  const isFree = formData.price_type === 'free';
  const descriptionCount = formData.description.length;

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!isFree && (formData.price === null || Number.isNaN(formData.price))) return false;
    if (!formData.condition) return false;
    return true;
  }, [formData.condition, formData.price, isFree, isSubmitting]);

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

    const { error: submitError } = await createListing({
      item_id: item.id,
      price: formData.price,
      price_type: formData.price_type,
      condition: formData.condition as ItemCondition,
      description: formData.description.trim(),
    });

    if (submitError) {
      error('Failed to list item');
      setIsSubmitting(false);
      return;
    }

    success('Item listed!');
    onSuccess();
    onClose();
  }, [createListing, error, formData, isFree, item.id, onClose, onSuccess, success]);

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
          <h2 className="text-lg font-semibold text-[#4a3f35]">List item</h2>
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
              src={item.photo_url}
              alt={item.name}
              className="w-14 h-14 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm text-[#a89887]">Listing</p>
              <p className="text-sm font-semibold text-[#4a3f35]">{item.name}</p>
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
                    onChange={() => setFormData((prev) => ({ ...prev, price_type: option.value }))}
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

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#f5ebe0]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#f5ebe0] text-[#8d7b6d] font-medium rounded-xl hover:bg-[#fdf8f2] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-3 bg-[#4a3f35] text-white font-medium rounded-xl hover:bg-[#3d332b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Listing...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
