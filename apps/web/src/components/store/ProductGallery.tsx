'use client';

import type { KeyboardEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ShopifyImage from './ShopifyImage';

type GalleryImage = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

export default function ProductGallery({ images }: { images: Array<GalleryImage | null> }) {
  const safeImages = useMemo(
    () => images.filter((image): image is GalleryImage => Boolean(image?.url)),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex >= safeImages.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, safeImages.length]);

  if (safeImages.length === 0) {
    return (
      <div className="relative aspect-[4/5] w-full border border-border bg-muted">
        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          No image
        </div>
      </div>
    );
  }

  const activeImage = safeImages[activeIndex] ?? safeImages[0];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % safeImages.length);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + safeImages.length) % safeImages.length);
    }
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchEndX.current = null;
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    touchEndX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null || touchEndX.current == null) return;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      setActiveIndex((index) => (index + 1) % safeImages.length);
    } else {
      setActiveIndex((index) => (index - 1 + safeImages.length) % safeImages.length);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      onKeyDown={handleKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      tabIndex={0}
      aria-label="Product image gallery"
    >
      <div className="relative aspect-[3/4] w-full border border-border bg-muted">
        <ShopifyImage
          src={activeImage.url}
          alt={activeImage.altText ?? 'Product image'}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority={activeIndex === 0}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:pb-0">
        {safeImages.slice(0, 8).map((image, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${image.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-[3/4] w-24 shrink-0 cursor-pointer border sm:w-auto ${
                isActive ? 'border-foreground' : 'border-border'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20`}
              aria-pressed={isActive}
              aria-label={`View image ${index + 1}`}
            >
              <ShopifyImage
                src={image.url}
                alt={image.altText ?? 'Product thumbnail'}
                fill
                sizes="(max-width: 1024px) 30vw, 15vw"
                className="object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
