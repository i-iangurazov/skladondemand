'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { icons } from '@/components/icons';

const UserIcon = icons.user;

type ProfileState = 'unknown' | 'authed' | 'guest';

export default function ProfileLink() {
  const pathname = usePathname();
  const [state, setState] = useState<ProfileState>('unknown');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setState(data?.user ? 'authed' : 'guest');
      })
      .catch(() => {
        if (!active) return;
        setState('guest');
      });
    return () => {
      active = false;
    };
  }, []);

  const href = useMemo(() => {
    if (state === 'authed') return '/account';
    const next = pathname || '/account';
    return `/account/login?next=${encodeURIComponent(next)}`;
  }, [pathname, state]);

  return (
    <Link
      href={href}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-border text-foreground transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-10 sm:w-10"
      aria-label="Profile"
    >
      <UserIcon className="size-4" />
    </Link>
  );
}
