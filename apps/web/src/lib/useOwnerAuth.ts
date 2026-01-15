'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export const OWNER_TOKEN_KEY = 'owner_token';
export const OWNER_REDIRECT_KEY = 'owner_redirect_to';

const isSafePath = (next?: string | null) => !!next && next.startsWith('/');

export function useOwnerAuth(redirect = true) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(OWNER_TOKEN_KEY) : null
  );

  useEffect(() => {
    if (!token && redirect) {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        const target = isSafePath(next) ? next! : window.location.pathname + window.location.search;
        localStorage.setItem(OWNER_REDIRECT_KEY, target);
      }
      router.replace('/owner/login');
    }
  }, [redirect, router, token]);

  const clear = () => {
    localStorage.removeItem(OWNER_TOKEN_KEY);
    localStorage.removeItem(OWNER_REDIRECT_KEY);
    setToken(null);
    if (redirect) router.replace('/owner/login');
  };

  return { token, setToken, clear };
}
