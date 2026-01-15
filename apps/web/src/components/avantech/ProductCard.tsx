'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CatalogProduct, CatalogVariant } from '@/lib/avantech/catalogApi';
import { cn } from '@/lib/utils';
import VariantChips from './VariantChips';
import QuantityStepper from './QuantityStepper';

type Props = {
  product: CatalogProduct;
  variants: CatalogVariant[];
  highlight?: boolean;
  autoSelectVariantId?: string | null;
  getQuantity: (variantId: string) => number;
  setQuantity: (variantId: string, quantity: number) => void;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  formatPrice: (price: number) => string;
};

const attributePriority = ['diameter', 'thread', 'length', 'pressure', 'angle', 'width', 'volume', 'material'];

export default function ProductCard({
  product,
  variants,
  highlight,
  autoSelectVariantId,
  getQuantity,
  setQuantity,
  onIncrement,
  onDecrement,
  formatPrice,
}: Props) {
  const t = useTranslations('avantech');
  const tAttr = useTranslations('avantech.attributes');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const prevQuantityRef = useRef(0);
  const prevVariantRef = useRef<string | null>(null);

  const activeVariants = useMemo(() => variants.filter((variant) => variant.isActive), [variants]);

  useEffect(() => {
    if (!autoSelectVariantId) return;
    if (activeVariants.some((variant) => variant.id === autoSelectVariantId)) {
      setSelectedVariantId(autoSelectVariantId);
    }
  }, [activeVariants, autoSelectVariantId]);

  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? null;
  const quantity = selectedVariant ? getQuantity(selectedVariant.id) : 0;

  useEffect(() => {
    if (selectedVariantId !== prevVariantRef.current) {
      prevVariantRef.current = selectedVariantId;
      prevQuantityRef.current = quantity;
      return;
    }
    if (!selectedVariantId) {
      prevQuantityRef.current = 0;
      return;
    }
    if (prevQuantityRef.current > 0 && quantity === 0) {
      setSelectedVariantId(null);
    }
    prevQuantityRef.current = quantity;
  }, [quantity, selectedVariantId]);

  const attributePairs = useMemo(() => {
    if (!selectedVariant) return [] as Array<{ key: string; value: string | number }>;
    return attributePriority
      .filter((key) => selectedVariant.attributes[key] !== undefined)
      .slice(0, 2)
      .map((key) => ({ key, value: selectedVariant.attributes[key]! }));
  }, [selectedVariant]);

  const handleSelectVariant = (variantId: string) => {
    if (variantId === selectedVariantId) {
      setSelectedVariantId(null);
      if (getQuantity(variantId) > 0) {
        setQuantity(variantId, 0);
      }
      return;
    }
    setSelectedVariantId(variantId);
  };

  const handleDecrement = () => {
    if (!selectedVariant) return;
    const currentQty = getQuantity(selectedVariant.id);
    onDecrement(selectedVariant.id);
    if (currentQty <= 1) {
      setSelectedVariantId(null);
    }
  };

  return (
    <article
      id={`product-${product.id}`}
      className={cn(
        'flex h-full flex-col gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm transition',
        highlight && 'ring-2 ring-[#FF2800]/40 motion-safe:animate-[avantech-highlight_1.1s_ease-in-out]'
      )}
    >
      <div className="flex gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#FF2800]/5">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#FF2800]/10 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{product.name}</h3>
          {product.description && (
            <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
          )}
        </div>
      </div>

      <VariantChips
        variants={activeVariants}
        selectedVariantId={selectedVariantId}
        onSelect={handleSelectVariant}
        formatPrice={formatPrice}
      />

      {selectedVariant && (
        <div className="mt-auto flex flex-col gap-3">
          {attributePairs.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {attributePairs.map(({ key, value }) => (
                <span key={key} className="rounded-full border border-border px-2 py-1">
                  {tAttr(key)}: {value}
                </span>
              ))}
            </div>
          )}
          <QuantityStepper
            value={quantity}
            onIncrement={() => onIncrement(selectedVariant.id)}
            onDecrement={handleDecrement}
            onChange={(next) => setQuantity(selectedVariant.id, next)}
            increaseLabel={t('actions.increaseQty')}
            decreaseLabel={t('actions.decreaseQty')}
          />
        </div>
      )}
    </article>
  );
}
