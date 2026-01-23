/**
 * StarRating - display or input star ratings
 */

export interface StarRatingProps {
  rating: number;
  max?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

export function StarRating({
  rating,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const isInteractive = Boolean(onChange) && !readOnly;
  const displayRating = Number.isFinite(rating) ? rating : 0;
  const filledCount = Math.floor(displayRating);

  const rootClassName = ['inline-flex items-center gap-1', sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClassName}
      role={isInteractive ? 'radiogroup' : 'img'}
      aria-label="Star rating"
    >
      {Array.from({ length: max }).map((_, index) => {
        const value = index + 1;
        const isFilled = value <= filledCount;
        const star = isFilled ? '⭐' : '☆';

        if (!isInteractive) {
          return (
            <span
              key={value}
              className={isFilled ? 'text-amber-400' : 'text-[#d6ccc2]'}
              aria-hidden="true"
            >
              {star}
            </span>
          );
        }

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange?.(value)}
            className={[
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ccc2] rounded-sm',
              isFilled ? 'text-amber-400' : 'text-[#d6ccc2] hover:text-amber-300',
            ].join(' ')}
            role="radio"
            aria-checked={value === Math.round(displayRating)}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
