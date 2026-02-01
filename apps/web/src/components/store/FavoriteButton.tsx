'use client';

import { icons } from '@/components/icons';
import { useFavorites } from './FavoritesProvider';

type FavoriteButtonProps = {
  productHandle: string;
  className?: string;
  size?: 'sm' | 'md';
};

const HeartIcon = icons.heart;

export default function FavoriteButton({
  productHandle,
  className,
  size = 'md',
}: FavoriteButtonProps) {
  const { status, isFavorited, toggle, isBusy } = useFavorites();
  const favorited = isFavorited(productHandle);
  const pending = isBusy(productHandle);
  const ready = status !== 'loading';
  const dimension = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await toggle(productHandle);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={favorited}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-disabled={pending}
      className={`inline-flex ${dimension} items-center justify-center border border-border transition-colors hover:border-foreground hover:bg-hover hover:text-foreground cursor-pointer ${ready ? '' : 'opacity-0'} ${pending ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`}
    >
      <HeartIcon
        className={favorited ? 'size-4 fill-black text-black' : 'size-4 text-foreground'}
        strokeWidth={1.5}
      />
    </button>
  );
}
