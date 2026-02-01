'use client';

import { DEFAULT_CURRENCY, type SupportedCurrency } from '@/lib/shopify/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CurrencySelector({ initialCurrency }: { initialCurrency: SupportedCurrency }) {
  const currency = DEFAULT_CURRENCY ?? initialCurrency;

  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      <span className="sr-only">Currency</span>
      <Select value={currency} disabled>
        <SelectTrigger className="h-9 min-w-[70px] text-[12px] uppercase tracking-[0.2em] sm:h-10">
          <SelectValue aria-label="Currency" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value={DEFAULT_CURRENCY}>{DEFAULT_CURRENCY}</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}
