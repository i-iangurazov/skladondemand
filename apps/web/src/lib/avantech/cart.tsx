'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';

const STORAGE_KEY = 'avantech_cart';

type CartState = {
  items: Record<string, number>;
};

type CartAction =
  | { type: 'hydrate'; items: Record<string, number> }
  | { type: 'set'; variantId: string; quantity: number }
  | { type: 'increment'; variantId: string }
  | { type: 'decrement'; variantId: string }
  | { type: 'clear' };

type CartContextValue = {
  items: Record<string, number>;
  setQuantity: (variantId: string, quantity: number) => void;
  increment: (variantId: string) => void;
  decrement: (variantId: string) => void;
  clear: () => void;
};

const sanitizeItems = (items: Record<string, number>) => {
  const next: Record<string, number> = {};
  Object.entries(items).forEach(([variantId, qty]) => {
    if (!Number.isFinite(qty)) return;
    const normalized = Math.max(0, Math.floor(qty));
    if (normalized > 0) next[variantId] = normalized;
  });
  return next;
};

const applyQuantity = (state: CartState, variantId: string, quantity: number): CartState => {
  const next = { ...state.items };
  if (quantity <= 0) {
    delete next[variantId];
  } else {
    next[variantId] = quantity;
  }
  return { items: next };
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'hydrate':
      return { items: sanitizeItems(action.items) };
    case 'set':
      return applyQuantity(state, action.variantId, action.quantity);
    case 'increment': {
      const current = state.items[action.variantId] ?? 0;
      return applyQuantity(state, action.variantId, current + 1);
    }
    case 'decrement': {
      const current = state.items[action.variantId] ?? 0;
      return applyQuantity(state, action.variantId, current - 1);
    }
    case 'clear':
      return { items: {} };
    default:
      return state;
  }
};

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: {} });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, number>;
        dispatch({ type: 'hydrate', items: parsed });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [hydrated, state.items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      setQuantity: (variantId, quantity) => dispatch({ type: 'set', variantId, quantity }),
      increment: (variantId) => dispatch({ type: 'increment', variantId }),
      decrement: (variantId) => dispatch({ type: 'decrement', variantId }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state.items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
};
