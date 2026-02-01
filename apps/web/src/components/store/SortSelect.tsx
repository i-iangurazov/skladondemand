'use client';

import type { SortDirection, SortKeyParam } from '@/lib/shopify/sort';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const options: Array<{ label: string; sort: SortKeyParam; dir?: SortDirection }> = [
  { label: 'Featured', sort: 'featured' },
  { label: 'Best selling', sort: 'bestSelling' },
  { label: 'Alphabetically A–Z', sort: 'alpha', dir: 'asc' },
  { label: 'Alphabetically Z–A', sort: 'alpha', dir: 'desc' },
  { label: 'Price low → high', sort: 'price', dir: 'asc' },
  { label: 'Price high → low', sort: 'price', dir: 'desc' },
  { label: 'Date new → old', sort: 'date', dir: 'desc' },
  { label: 'Date old → new', sort: 'date', dir: 'asc' },
];

type SortSelectProps = {
  value: { sort: SortKeyParam; dir?: SortDirection };
  onChange: (next: { sort: SortKeyParam; dir?: SortDirection }) => void;
};

export default function SortSelect({ value, onChange }: SortSelectProps) {
  const currentValue = `${value.sort}:${value.dir ?? ''}`;

  return (
    <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      <span className="text-[10px]">Sort</span>
      <Select
        value={currentValue}
        onValueChange={(value) => {
          const [sort, dir] = value.split(':');
          const selected = options.find((option) => option.sort === sort && (option.dir ?? '') === (dir ?? ''));
          if (selected) {
            onChange({ sort: selected.sort, dir: selected.dir });
          }
        }}
      >
        <SelectTrigger className="w-full min-w-[180px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={`${option.sort}-${option.dir ?? 'featured'}`} value={`${option.sort}:${option.dir ?? ''}`}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
