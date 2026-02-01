'use client';

import type { ReactNode, Ref } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import NavLink from './NavLink';

type NavItem = {
  title: string;
  href?: string | null;
  items?: NavItem[];
};

type NavDropdownProps = {
  label: string;
  href?: string | null;
  items: NavItem[];
};

const CLOSE_DELAY_MS = 180;

const resolveLink = (
  href: string | null | undefined,
  className: string,
  children: ReactNode,
  ref?: Ref<HTMLAnchorElement | HTMLButtonElement>,
  hasPopup = false
) => {
  if (!href) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={`${className} cursor-pointer`}
        aria-haspopup={hasPopup ? 'true' : undefined}
      >
        {children}
      </button>
    );
  }

  if (href.startsWith('http')) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={`${className} cursor-pointer`}
        rel="noreferrer"
        aria-haspopup={hasPopup ? 'true' : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <NavLink
      href={href}
      className={className}
      activeClassName="text-foreground after:scale-x-100"
      exact
      hasPopup={hasPopup}
      ref={ref as Ref<HTMLAnchorElement>}
    >
      {children}
    </NavLink>
  );
};

export default function NavDropdown({ label, href, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);

  const clearClose = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearClose();
    setOpen(true);
  }, [clearClose]);

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearClose]);

  useEffect(() => () => clearClose(), [clearClose]);

  return (
    <div
      className="relative"
      onPointerEnter={openMenu}
      onPointerLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {resolveLink(
        href,
        "relative border-0 border-b border-transparent bg-transparent px-0 py-0 pb-1 text-[12px] font-medium uppercase tracking-[0.2em] text-neutral-700 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:scale-x-0 after:bg-black after:transition-transform after:duration-150 hover:after:scale-x-100",
        label,
        triggerRef,
        true
      )}
      <div
        className={[
          'absolute left-0 top-full z-20 mt-4 w-[min(680px,calc(100vw-2rem))] translate-y-2 border border-border bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition duration-150',
          open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="absolute -top-4 left-0 h-4 w-full" aria-hidden />
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((child, childIndex) => (
            <div key={`${child.title}-${childIndex}`} className="flex flex-col gap-2">
              {resolveLink(
                child.href,
                "relative border-0 bg-transparent px-0 py-0 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-700 transition-colors hover:text-black after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:scale-x-0 after:bg-black after:transition-transform after:duration-150 hover:after:scale-x-100",
                child.title
              )}
              {child.items?.length ? (
                <div className="flex flex-col gap-1">
                  {child.items.map((grandchild, grandIndex) => (
                    <div key={`${grandchild.title}-${grandIndex}`}>
                      {resolveLink(
                        grandchild.href,
                        "relative border-0 bg-transparent px-0 py-0 text-sm text-neutral-700 transition-colors hover:text-black after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:scale-x-0 after:bg-black after:transition-transform after:duration-150 hover:after:scale-x-100",
                        grandchild.title
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
