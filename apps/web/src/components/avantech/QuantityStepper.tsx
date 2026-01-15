'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChange: (value: number) => void;
  increaseLabel: string;
  decreaseLabel: string;
  className?: string;
};

export default function QuantityStepper({
  value,
  onIncrement,
  onDecrement,
  onChange,
  increaseLabel,
  decreaseLabel,
  className,
}: Props) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange(0);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setInputValue(value.toString());
      return;
    }
    onChange(Math.max(0, Math.floor(parsed)));
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 bg-white',
        className
      )}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        onClick={onDecrement}
        disabled={value <= 0}
        className="flex size-11 items-center justify-center rounded-2xl border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={() => commitValue(inputValue)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitValue(inputValue);
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            setInputValue(value.toString());
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => event.currentTarget.select()}
        aria-label="Quantity"
        className="h-11 w-16 rounded-xl border border-border bg-white text-center text-base font-semibold text-foreground"
      />
      <button
        type="button"
        aria-label={increaseLabel}
        onClick={onIncrement}
        className="flex size-11 items-center justify-center rounded-2xl bg-[#FF2800] text-white shadow-sm transition hover:bg-[#e62500]"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
