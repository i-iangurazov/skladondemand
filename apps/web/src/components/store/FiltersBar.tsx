'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBrandLabel, type Facets } from '@/lib/shopify/facets';

type FilterValues = {
  brand?: string;
  avail?: 'in' | 'out' | '';
  color?: string;
};

type FiltersBarProps = {
  facets: Facets;
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  onClear: () => void;
};

const ControlGroup = ({
  facets,
  values,
  onChange,
  layout = 'stack',
}: {
  facets: Facets;
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  layout?: 'stack' | 'inline';
}) => {
  const hasColors = facets.colors.length > 0 && facets.colorMode !== 'none';
  const colorLabel = 'Color';
  const brandValue = values.brand?.length ? values.brand : 'all';
  const availabilityValue = values.avail?.length ? values.avail : 'all';
  const colorValue = values.color?.length ? values.color : 'all';
  const ensureSelected = (options: string[], selected?: string) => {
    if (!selected) return options;
    if (options.includes(selected)) return options;
    return [selected, ...options];
  };
  const brandOptions = ensureSelected(facets.brands, values.brand ?? '');
  const colorOptions = ensureSelected(facets.colors, values.color ?? '');

  return (
    <div
      className={
        layout === 'inline'
          ? 'flex flex-wrap items-end gap-6 text-sm'
          : 'flex flex-col gap-4 text-sm'
      }
    >
      <label className="flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-[10px]">Brand</span>
        <Select
          value={brandValue}
          onValueChange={(value) => onChange({ ...values, brand: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="h-10 w-full min-w-[160px] text-sm leading-none">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {brandOptions.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {formatBrandLabel(brand)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-[10px]">Availability</span>
        <Select
          value={availabilityValue}
          onValueChange={(value) =>
            onChange({ ...values, avail: value === 'all' ? '' : (value as FilterValues['avail']) })
          }
        >
          <SelectTrigger className="h-10 w-full min-w-[160px] text-sm leading-none">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span className="text-[10px]">{colorLabel}</span>
        <Select
          value={colorValue}
          onValueChange={(value) => onChange({ ...values, color: value === 'all' ? '' : value })}
          disabled={!hasColors}
        >
          <SelectTrigger className="h-10 w-full min-w-[160px] text-sm leading-none">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {colorOptions.map((color) => (
              <SelectItem key={color} value={color}>
                {color}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
};

export default function FiltersBar({ facets, values, onChange, onClear }: FiltersBarProps) {
  const hasActive = Boolean(values.brand || values.avail || values.color);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="hidden items-end gap-6 md:flex">
        <ControlGroup facets={facets} values={values} onChange={onChange} layout="inline" />
        {hasActive ? (
          <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-[10px] text-transparent" aria-hidden>
              Actions
            </span>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-10 items-center justify-center cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground leading-none transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="h-9 cursor-pointer border border-border px-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
            >
              Filters
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-[90vw] border-r border-border bg-white">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Filters</span>
            </div>
            <div className="px-4 py-6">
              <ControlGroup facets={facets} values={values} onChange={onChange} layout="stack" />
              {hasActive ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="mt-6 inline-flex h-10 w-full items-center justify-center cursor-pointer border border-border text-xs uppercase tracking-[0.2em] text-muted-foreground leading-none transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
