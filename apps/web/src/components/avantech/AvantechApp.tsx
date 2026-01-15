'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toastError, toastSuccess } from '@/lib/toast';
import { useLanguage } from '@/lib/useLanguage';
import { CartProvider, useCart } from '@/lib/avantech/cart';
import {
  buildSearchEntries,
  indexCatalog,
  type CatalogCategory,
  type CatalogResponse,
  type SearchEntry,
} from '@/lib/avantech/catalogApi';
import { formatPrice } from '@/lib/avantech/format';
import Header from './Header';
import CategorySection from './CategorySection';
import ProductCard from './ProductCard';
import FloatingCartBar from './FloatingCartBar';
import { Button } from '@/components/ui/button';

const HIGHLIGHT_MS = 1200;

type CartLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
};

function AvantechContent() {
  const { lang } = useLanguage();
  const t = useTranslations('avantech');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { items, increment, decrement, clear, setQuantity } = useCart();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isOrdering, setIsOrdering] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [autoSelectVariantId, setAutoSelectVariantId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const highlightTimerRef = useRef<number | null>(null);

  const currencyLabel = tCommon('labels.currency');
  const formatPriceLocalized = (amount: number) => formatPrice(amount, lang, currencyLabel);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadCatalog = async () => {
      setIsLoadingCatalog(true);
      setCatalogError(false);

      try {
        const response = await fetch(`/api/catalog?locale=${lang}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load catalog (${response.status})`);
        }
        const payload = (await response.json()) as CatalogResponse;
        if (!isActive) return;
        setCategories(payload.categories ?? []);
      } catch (error) {
        if (!isActive) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setCatalogError(true);
      } finally {
        if (isActive) {
          setIsLoadingCatalog(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [lang, reloadToken]);

  const { productsById, variantsById } = useMemo(() => indexCatalog(categories), [categories]);

  useEffect(() => {
    if (selectedCategoryId === 'all') return;
    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId('all');
    }
  }, [categories, selectedCategoryId]);

  const visibleCategories = useMemo(() => {
    if (selectedCategoryId === 'all') return categories;
    return categories.filter((category) => category.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const visibleVariants = useMemo(
    () => visibleCategories.flatMap((category) => category.products.flatMap((product) => product.variants)),
    [visibleCategories]
  );

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories]
  );

  const searchEntries = useMemo(() => {
    if (isLoadingCatalog || catalogError) return [];
    return buildSearchEntries(visibleVariants, productsById);
  }, [catalogError, isLoadingCatalog, productsById, visibleVariants]);

  const cartLines = useMemo<CartLine[]>(() => {
    return Object.entries(items).reduce<CartLine[]>((acc, [variantId, quantity]) => {
      if (quantity <= 0) return acc;
      const variant = variantsById[variantId];
      if (!variant) return acc;
      const product = productsById[variant.productId];
      if (!product) return acc;
      acc.push({
        variantId,
        productName: product.name,
        variantLabel: variant.label,
        unitPrice: variant.price,
        quantity,
      });
      return acc;
    }, []);
  }, [items, productsById, variantsById]);

  const totalPriceNumber = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cartLines]
  );

  const totalCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines]
  );

  const handleSearchSelect = (entry: SearchEntry) => {
    setAutoSelectVariantId(entry.variantId);
    setHighlightedProductId(entry.productId);

    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedProductId((current) => (current === entry.productId ? null : current));
    }, HIGHLIGHT_MS);

    const target = document.getElementById(`product-${entry.productId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const handleOrder = async () => {
    if (cartLines.length === 0 || isOrdering) return;
    setIsOrdering(true);

    try {
      const response = await fetch('/api/telegram-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: lang,
          items: cartLines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t('cart.orderFailed'));
      }

      toastSuccess(t('cart.orderSuccess'));
      clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('cart.orderFailed');
      toastError(message);
    } finally {
      setIsOrdering(false);
    }
  };

  const getQuantity = (variantId: string) => items[variantId] ?? 0;

  return (
    <div className="relative min-h-screen bg-white text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,40,0,0.12),transparent_55%),radial-gradient(circle_at_right,_rgba(67,37,135,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#0000000f_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <Header
          entries={searchEntries}
          onSelect={handleSearchSelect}
          formatPrice={formatPriceLocalized}
          categories={categoryOptions}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
        />
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 md:px-6">
          {isLoadingCatalog ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              {tCommon('states.loading')}
            </div>
          ) : catalogError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              <span>{tErrors('generic')}</span>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-4 text-xs"
                onClick={() => setReloadToken((prev) => prev + 1)}
              >
                {tCommon('actions.refresh')}
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              {tCommon('states.empty')}
            </div>
          ) : (
            visibleCategories.map((category) => (
              <CategorySection
                key={category.id}
                id={`category-${category.id}`}
                title={category.name}
                count={category.products.length}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {category.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variants={product.variants}
                      highlight={highlightedProductId === product.id}
                      autoSelectVariantId={autoSelectVariantId}
                      getQuantity={getQuantity}
                      setQuantity={setQuantity}
                      onIncrement={increment}
                      onDecrement={decrement}
                      formatPrice={formatPriceLocalized}
                    />
                  ))}
                </div>
              </CategorySection>
            ))
          )}
        </main>

        <FloatingCartBar
          totalLabel={t('cart.total')}
          totalPrice={formatPriceLocalized(totalPriceNumber)}
          itemCount={totalCount}
          orderLabel={t('cart.order')}
          sendingLabel={t('cart.sending')}
          isOrdering={isOrdering}
          disabled={cartLines.length === 0}
          onOrder={handleOrder}
        />
      </div>
    </div>
  );
}

export default function AvantechApp() {
  return (
    <CartProvider>
      <AvantechContent />
    </CartProvider>
  );
}
