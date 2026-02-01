'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type FavoritesStatus = 'loading' | 'ready' | 'anonymous';

type FavoritesContextValue = {
  status: FavoritesStatus;
  handles: Set<string>;
  isFavorited: (handle: string) => boolean;
  isBusy: (handle: string) => boolean;
  toggle: (handle: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const CACHE_KEY = 'favorites:handles';
const CACHE_TTL_MS = 2 * 60 * 1000;

const normalizeHandle = (value: string) => value.trim().toLowerCase();

const readCache = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { ts: number; handles: string[] };
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.handles ?? [];
  } catch {
    return null;
  }
};

const writeCache = (handles: string[]) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), handles }));
};

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<FavoritesStatus>('loading');
  const [handles, setHandles] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const inflight = useRef<Map<string, Promise<void>>>(new Map());
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout((showToast as unknown as { _t?: number })._t);
    (showToast as unknown as { _t?: number })._t = window.setTimeout(() => setToast(null), 2500);
  };

  const loadHandles = useCallback(async () => {
    const cached = readCache();
    if (cached?.length) {
      setHandles(new Set(cached.map(normalizeHandle)));
      setStatus('ready');
    }
    const response = await fetch('/api/favorites/handles', {
      cache: 'no-store',
      credentials: 'include',
    });
    if (response.status === 401) {
      setStatus('anonymous');
      setHandles(new Set());
      return;
    }
    const data = response.ok ? await response.json() : null;
    const list = Array.isArray(data?.handles) ? data.handles : [];
    const normalized = list.map(normalizeHandle).filter(Boolean);
    setHandles(new Set(normalized));
    writeCache(normalized);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!loadPromiseRef.current) {
      loadPromiseRef.current = loadHandles().catch(() => {
        setStatus('anonymous');
        setHandles(new Set());
      });
    }
  }, [loadHandles]);

  const ensureLoaded = useCallback(async () => {
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    loadPromiseRef.current = loadHandles().catch(() => {
      setStatus('anonymous');
      setHandles(new Set());
    });
    await loadPromiseRef.current;
  }, [loadHandles]);

  const isFavorited = useCallback(
    (handle: string) => handles.has(normalizeHandle(handle)),
    [handles]
  );

  const isBusy = useCallback(
    (handle: string) => inflight.current.has(normalizeHandle(handle)),
    []
  );

  const toggle = useCallback(
    async (handle: string) => {
      const normalized = normalizeHandle(handle);
      if (status === 'anonymous') {
        const next = pathname || '/account';
        router.push(`/account/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (inflight.current.has(normalized)) {
        return inflight.current.get(normalized) ?? Promise.resolve();
      }

      const currentlyFavorited = handles.has(normalized);
      const optimistic = new Set(handles);
      if (currentlyFavorited) optimistic.delete(normalized);
      else optimistic.add(normalized);
      setHandles(optimistic);
      writeCache(Array.from(optimistic));

      const promise = fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productHandle: normalized }),
        cache: 'no-store',
        credentials: 'include',
      })
        .then(async (res) => {
          if (res.status === 401) {
            setStatus('anonymous');
            const next = pathname || '/account';
            router.push(`/account/login?next=${encodeURIComponent(next)}`);
            throw new Error('Please sign in to save favorites.');
          }
          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            throw new Error(payload?.error ?? 'Could not update favorites.');
          }
          const data = (await res.json()) as { favorited?: boolean };
          const nextFavorited = data?.favorited ?? !currentlyFavorited;
          setHandles((prev) => {
            const next = new Set(prev);
            if (nextFavorited) next.add(normalized);
            else next.delete(normalized);
            writeCache(Array.from(next));
            return next;
          });
        })
        .catch((error) => {
          setHandles((prev) => {
            const next = new Set(prev);
            if (currentlyFavorited) next.add(normalized);
            else next.delete(normalized);
            writeCache(Array.from(next));
            return next;
          });
          showToast((error as Error).message);
        })
        .finally(() => {
          inflight.current.delete(normalized);
          window.dispatchEvent(
            new CustomEvent('favorites:changed', {
              detail: { handle: normalized },
            })
          );
        });

      inflight.current.set(normalized, promise);
      return promise;
    },
    [ensureLoaded, handles, pathname, router, status]
  );

  const value = useMemo(
    () => ({
      status,
      handles,
      isFavorited,
      isBusy,
      toggle,
    }),
    [handles, isBusy, isFavorited, status, toggle]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 border border-border bg-white px-4 py-3 text-xs uppercase tracking-[0.2em] text-foreground shadow-sm">
          {toast}
        </div>
      ) : null}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return ctx;
};
