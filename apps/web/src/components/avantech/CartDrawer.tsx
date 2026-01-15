'use client';

import { useTranslations } from 'next-intl';
import { SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import QuantityStepper from './QuantityStepper';

type CartLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
};

type Props = {
  lines: CartLine[];
  totalPrice: string;
  formatPrice: (amount: number) => string;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onSetQuantity: (variantId: string, quantity: number) => void;
  onOrder: () => void;
  isOrdering: boolean;
};

export default function CartDrawer({
  lines,
  totalPrice,
  formatPrice,
  onIncrement,
  onDecrement,
  onSetQuantity,
  onOrder,
  isOrdering,
}: Props) {
  const t = useTranslations('avantech');

  return (
    <SheetContent side="bottom" className="rounded-t-3xl border-t border-border px-0 pb-0">
      <SheetHeader className="px-6">
        <SheetTitle className="text-lg">{t('cart.title')}</SheetTitle>
        <p className="text-sm text-muted-foreground">{t('cart.subtitle')}</p>
      </SheetHeader>
      <ScrollArea className="max-h-[50vh] px-6">
        {lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {t('cart.empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-6">
            {lines.map((line) => (
              <div key={line.variantId} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{line.productName}</div>
                    <div className="text-xs text-muted-foreground">{line.variantLabel}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {line.quantity} x {formatPrice(line.unitPrice)}
                    </div>
                  </div>
                  <QuantityStepper
                    value={line.quantity}
                    onIncrement={() => onIncrement(line.variantId)}
                    onDecrement={() => onDecrement(line.variantId)}
                    onChange={(next) => onSetQuantity(line.variantId, next)}
                    increaseLabel={t('actions.increaseQty')}
                    decreaseLabel={t('actions.decreaseQty')}
                    className="min-w-[120px]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <SheetFooter className="border-t border-border bg-white px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t('cart.total')}
            </div>
            <div className="text-lg font-semibold text-foreground">{totalPrice}</div>
          </div>
          <Button
            type="button"
            onClick={onOrder}
            disabled={lines.length === 0 || isOrdering}
            className={cn(
              'h-12 rounded-full px-6 text-sm font-semibold',
              lines.length === 0 && 'cursor-not-allowed'
            )}
          >
            {isOrdering ? t('cart.sending') : t('cart.order')}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  );
}
