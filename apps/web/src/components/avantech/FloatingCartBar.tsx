import { Button } from '@/components/ui/button';

type Props = {
  totalLabel: string;
  totalPrice: string;
  itemCount: number;
  orderLabel: string;
  sendingLabel: string;
  isOrdering: boolean;
  disabled?: boolean;
  onOrder: () => void;
};

export default function FloatingCartBar({
  totalLabel,
  totalPrice,
  itemCount,
  orderLabel,
  sendingLabel,
  isOrdering,
  disabled,
  onOrder,
}: Props) {
  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(640px,calc(100%-2rem))] -translate-x-1/2">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-lg">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {totalLabel}
          </div>
          <div className="text-lg font-semibold text-foreground">{totalPrice}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#432587]/10 px-2 py-1 text-xs font-semibold text-[#432587]">
            {itemCount}
          </span>
          <Button
            className="h-11 rounded-full bg-[#FF2800] px-5 text-sm font-semibold text-white hover:bg-[#e62500]"
            onClick={onOrder}
            disabled={disabled || isOrdering}
          >
            {isOrdering ? sendingLabel : orderLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
