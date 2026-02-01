'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type ShopifyImageProps = {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  fallbackText?: string;
  fallbackClassName?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
};

export default function ShopifyImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  fallbackText = 'No image',
  fallbackClassName,
  priority,
  loading,
}: ShopifyImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground',
          fill ? 'absolute inset-0' : null,
          fallbackClassName
        )}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      className={className}
      unoptimized
      priority={priority}
      loading={priority ? 'eager' : loading}
      onError={() => setHasError(true)}
    />
  );
}
