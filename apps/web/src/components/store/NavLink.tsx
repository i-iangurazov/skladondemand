'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavLinkProps = {
  href: string;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
  hasPopup?: boolean;
  children: React.ReactNode;
};

const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ href, className, activeClassName, exact = true, hasPopup, children }, ref) => {
    const pathname = usePathname();
    const isActive = exact ? pathname === href : pathname.startsWith(href);

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive ? activeClassName : null)}
        aria-current={isActive ? 'page' : undefined}
        aria-haspopup={hasPopup ? 'true' : undefined}
      >
        {children}
      </Link>
    );
  }
);

NavLink.displayName = 'NavLink';

export default NavLink;
