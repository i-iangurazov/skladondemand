'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductSummary } from '@/lib/shopify/schemas';
import ProductCard from './ProductCard';
import { useFavorites } from './FavoritesProvider';

type FavoritesClientProps = {
  country: string;
};

const normalizeHandles = (handles: string[]) =>
  handles.map((handle) => handle.trim().toLowerCase()).filter(Boolean);

export default function FavoritesClient({ country }: FavoritesClientProps) {
  const { handles: handleSet, status } = useFavorites();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handles = useMemo(() => normalizeHandles(Array.from(handleSet)), [handleSet]);

  useEffect(() => {
    if (status !== 'ready') return;
    if (!handles.length) {
      setProducts([]);
      return;
    }
    setProducts((prev) =>
      prev.filter((product) => handles.includes(product.handle.toLowerCase()))
    );
    let active = true;
    setLoading(true);
    setError(null);
    fetch('/api/storefront/products-by-handles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handles, country }),
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setProducts(data?.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError('Failed to load favorites.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [country, handles, status]);

  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading favorites…</p>;
  }

  if (!handles.length && !loading) {
    return <p className="text-sm text-muted-foreground">No favorites yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {products.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : handles.length ? (
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading favorites…' : 'Favorites saved, but items could not be loaded.'}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No favorites yet.</p>
      )}
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
