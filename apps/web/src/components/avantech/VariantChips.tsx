'use client';

import { useTranslations } from 'next-intl';
import type { CatalogVariant } from '@/lib/avantech/catalogApi';
import { cn } from '@/lib/utils';

type Props = {
  variants: CatalogVariant[];
  selectedVariantId?: string | null;
  onSelect: (variantId: string) => void;
  formatPrice: (price: number) => string;
};

export default function VariantChips({ variants, selectedVariantId, onSelect, formatPrice }: Props) {
  const t = useTranslations('avantech');

  return (
    <div className="flex flex-wrap gap-2">
      {variants.map((variant) => {
        const label = variant.label;
        const isSelected = variant.id === selectedVariantId;
        return (
          <button
            key={variant.id}
            type="button"
            aria-pressed={isSelected}
            aria-label={t('actions.selectVariant', { variant: label })}
            onClick={() => onSelect(variant.id)}
            className={cn(
              'flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
              isSelected
                ? 'border-[#FF2800] bg-[#FF2800] text-white shadow-sm'
                : 'border-border bg-white text-foreground hover:border-[#FF2800]/40 hover:bg-[#FF2800]/5'
            )}
          >
            <span>{label}</span>
            <span className={cn('text-xs', isSelected ? 'text-white/80' : 'text-muted-foreground')}>
              {formatPrice(variant.price)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
