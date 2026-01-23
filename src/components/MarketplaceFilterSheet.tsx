/**
 * Marketplace filter bottom sheet
 */

import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useCategories } from '@/hooks/useCategories';
import type { MarketplaceFilters } from '@/hooks/useMarketplace';

interface MarketplaceFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MarketplaceFilters;
  onApply: (filters: MarketplaceFilters) => void;
  onClear: () => void;
}

const conditionOptions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

function CheckboxRow({
  label,
  checked,
  onToggle,
  icon,
  meta,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  icon?: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fdf8f2]"
    >
      <div
        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? 'bg-[#4a3f35] border-[#4a3f35]' : 'border-2 border-[#f5ebe0]'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
      <span className={`flex-1 truncate ${checked ? 'font-medium' : ''}`}>{label}</span>
      {meta && (
        <span className="flex-shrink-0 text-xs bg-[#fdf8f2] text-[#8d7b6d] px-2 py-0.5 rounded-full">
          {meta}
        </span>
      )}
    </button>
  );
}

export function MarketplaceFilterSheet({
  isOpen,
  onClose,
  filters,
  onApply,
  onClear,
}: MarketplaceFilterSheetProps) {
  const { categories, isLoading } = useCategories();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [priceType, setPriceType] = useState<'all' | 'free'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setSelectedCategoryIds(new Set(filters.categories));
    setSelectedConditions(new Set(filters.conditions));
    setPriceType(filters.priceType);
    setMinPrice(filters.minPrice !== null ? String(filters.minPrice) : '');
    setMaxPrice(filters.maxPrice !== null ? String(filters.maxPrice) : '');
  }, [filters, isOpen]);

  const sortedCategories = useMemo(() => {
    const system = categories.filter((category) => category.is_system);
    const user = categories.filter((category) => !category.is_system);
    return [...system, ...user];
  }, [categories]);

  const handleApply = () => {
    const parsedMin = minPrice.trim() === '' ? null : Number(minPrice);
    const parsedMax = maxPrice.trim() === '' ? null : Number(maxPrice);

    onApply({
      ...filters,
      categories: Array.from(selectedCategoryIds),
      conditions: Array.from(selectedConditions),
      priceType,
      minPrice: Number.isNaN(parsedMin) ? null : parsedMin,
      maxPrice: Number.isNaN(parsedMax) ? null : parsedMax,
    });
    onClose();
  };

  const handleClear = () => {
    setSelectedCategoryIds(new Set());
    setSelectedConditions(new Set());
    setPriceType('all');
    setMinPrice('');
    setMaxPrice('');
    onClear();
    onClose();
  };

  const footer = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClear}
        className="flex-1 px-4 py-2.5 text-sm font-medium text-[#8d7b6d] bg-[#fdf8f2] rounded-lg hover:bg-[#f5ebe0] transition-colors"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={handleApply}
        className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#4a3f35] rounded-lg hover:bg-[#3d332b] transition-colors"
      >
        Apply Filters
      </button>
    </div>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filters"
      footer={footer}
    >
      <div className="pb-safe">
        <div className="px-4 pt-4">
          <h3 className="text-sm font-semibold text-[#4a3f35]">Categories</h3>
        </div>
        <div className="py-2">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-[#a89887]">Loading categories...</div>
          ) : sortedCategories.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#a89887]">No categories available.</div>
          ) : (
            sortedCategories.map((category) => (
              <CheckboxRow
                key={category.id}
                label={category.name}
                icon={category.icon}
                checked={selectedCategoryIds.has(category.id)}
                onToggle={() => {
                  setSelectedCategoryIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(category.id)) {
                      next.delete(category.id);
                    } else {
                      next.add(category.id);
                    }
                    return next;
                  });
                }}
              />
            ))
          )}
        </div>

        <div className="px-4 pt-2">
          <h3 className="text-sm font-semibold text-[#4a3f35]">Condition</h3>
        </div>
        <div className="py-2">
          {conditionOptions.map((condition) => (
            <CheckboxRow
              key={condition.value}
              label={condition.label}
              checked={selectedConditions.has(condition.value)}
              onToggle={() => {
                setSelectedConditions((prev) => {
                  const next = new Set(prev);
                  if (next.has(condition.value)) {
                    next.delete(condition.value);
                  } else {
                    next.add(condition.value);
                  }
                  return next;
                });
              }}
            />
          ))}
        </div>

        <div className="px-4 pt-2">
          <h3 className="text-sm font-semibold text-[#4a3f35]">Price Type</h3>
          <div className="mt-3 inline-flex w-full rounded-lg border border-[#f5ebe0] overflow-hidden">
            <button
              type="button"
              onClick={() => setPriceType('all')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                priceType === 'all'
                  ? 'bg-[#4a3f35] text-white'
                  : 'bg-white text-[#8d7b6d] hover:bg-[#fdf8f2]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setPriceType('free')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                priceType === 'free'
                  ? 'bg-[#4a3f35] text-white'
                  : 'bg-white text-[#8d7b6d] hover:bg-[#fdf8f2]'
              }`}
            >
              Free Only
            </button>
          </div>
        </div>

        <div className="px-4 pt-4">
          <h3 className="text-sm font-semibold text-[#4a3f35]">Price Range</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#a89887] mb-1">Min</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="$0"
                className="w-full px-3 py-2 text-sm border border-[#f5ebe0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d6ccc2]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#a89887] mb-1">Max</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="$500"
                className="w-full px-3 py-2 text-sm border border-[#f5ebe0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d6ccc2]"
              />
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </BottomSheet>
  );
}
