'use client';

import { useId, useState } from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
  value: number;
  onChange: (next: number) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
};

const clamp = (value: number, allowZero: boolean) =>
  Math.min(5, Math.max(allowZero ? 0 : 1, value));

export default function StarRating({
  value,
  onChange,
  size = 'md',
  disabled = false,
  className,
  name,
  required = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const groupId = useId();
  const iconSize = size === 'sm' ? 16 : 20;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const allowZero = !required;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clamp(value + 1, allowZero));
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(clamp(value - 1, allowZero));
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(clamp(value, allowZero));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onChange(allowZero ? 0 : 1);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onChange(5);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div
        role="radiogroup"
        aria-label="Rating"
        aria-required={required || undefined}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setHoverValue(null)}
        className={`inline-flex items-center gap-1 ${disabled ? 'opacity-50' : ''}`}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const filled = starValue <= displayValue;
          return (
            <button
              key={`${groupId}-${starValue}`}
              type="button"
              role="radio"
              aria-checked={starValue === value}
              aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
              disabled={disabled}
              onPointerEnter={() => setHoverValue(starValue)}
              onFocus={() => setHoverValue(starValue)}
              onBlur={() => setHoverValue(null)}
              onClick={() => onChange(starValue)}
              className={`p-0.5 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              <Star
                size={iconSize}
                className={
                  filled
                    ? 'text-black fill-black'
                    : 'text-black/30 fill-transparent'
                }
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <span className="sr-only">{value} out of 5 stars</span>
    </div>
  );
}
