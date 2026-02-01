'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MenuIcon, ChevronDownIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import SearchBox from './SearchBox';

type NavItem = {
  title: string;
  href?: string | null;
  items?: NavItem[];
};

type MobileMenuProps = {
  items: NavItem[];
  country: string;
};

const resolveLinkProps = (href?: string | null) => {
  if (!href) return { href: '' };
  if (href.startsWith('http')) return { href, external: true };
  return { href, external: false };
};

export default function MobileMenu({ items, country }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderedItems = useMemo(() => items.filter((item) => item.title), [items]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-10 sm:w-10 xl:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full max-w-[90vw] border-r border-border bg-white">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Menu</span>
        </div>
        <div className="px-4 pt-6">
          <SearchBox country={country} />
        </div>
        <nav className="flex flex-col gap-2 px-4 py-6 text-sm">
          {renderedItems.map((item, index) => {
            const key = `${item.title}-${index}`;
            const hasChildren = !!item.items?.length;
            const isOpen = expanded[key];
            const linkProps = resolveLinkProps(item.href);

            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {linkProps.href ? (
                    linkProps.external ? (
                      <a
                        href={linkProps.href}
                        className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground"
                        rel="noreferrer"
                        onClick={() => setOpen(false)}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <Link
                        href={linkProps.href}
                        className="cursor-pointer text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground"
                        onClick={() => setOpen(false)}
                      >
                        {item.title}
                      </Link>
                    )
                  ) : (
                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground">
                      {item.title}
                    </span>
                  )}
                  {hasChildren ? (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                      aria-expanded={isOpen}
                      aria-label={`Toggle ${item.title}`}
                      onClick={() => toggleExpanded(key)}
                    >
                      <ChevronDownIcon className={`size-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  ) : null}
                </div>
                {hasChildren && isOpen ? (
                  <div className="flex flex-col gap-2 border-l border-border pl-4">
                    {item.items?.map((child, childIndex) => {
                      const childKey = `${key}-${child.title}-${childIndex}`;
                      const childHasChildren = !!child.items?.length;
                      const childOpen = expanded[childKey];
                      const childLink = resolveLinkProps(child.href);

                      return (
                        <div key={childKey} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            {childLink.href ? (
                              childLink.external ? (
                              <a
                                href={childLink.href}
                                className="cursor-pointer text-xs uppercase tracking-[0.18em] text-foreground"
                                rel="noreferrer"
                                onClick={() => setOpen(false)}
                              >
                                  {child.title}
                                </a>
                              ) : (
                                <Link
                                  href={childLink.href}
                                  className="cursor-pointer text-xs uppercase tracking-[0.18em] text-foreground"
                                  onClick={() => setOpen(false)}
                                >
                                  {child.title}
                                </Link>
                              )
                            ) : (
                              <span className="text-xs uppercase tracking-[0.18em] text-foreground">
                                {child.title}
                              </span>
                            )}
                            {childHasChildren ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                                aria-expanded={childOpen}
                                aria-label={`Toggle ${child.title}`}
                                onClick={() => toggleExpanded(childKey)}
                              >
                                <ChevronDownIcon className={`size-4 transition ${childOpen ? 'rotate-180' : ''}`} />
                              </button>
                            ) : null}
                          </div>
                          {childHasChildren && childOpen ? (
                            <div className="flex flex-col gap-2 border-l border-border pl-4">
                              {child.items?.map((grandchild, grandIndex) => {
                                const grandLink = resolveLinkProps(grandchild.href);
                                const grandKey = `${childKey}-${grandchild.title}-${grandIndex}`;
                                return grandLink.href ? (
                                  grandLink.external ? (
                                    <a
                                      key={grandKey}
                                      href={grandLink.href}
                                      className="cursor-pointer text-sm text-muted-foreground"
                                      rel="noreferrer"
                                      onClick={() => setOpen(false)}
                                    >
                                      {grandchild.title}
                                    </a>
                                  ) : (
                                    <Link
                                      key={grandKey}
                                      href={grandLink.href}
                                      className="cursor-pointer text-sm text-muted-foreground"
                                      onClick={() => setOpen(false)}
                                    >
                                      {grandchild.title}
                                    </Link>
                                  )
                                ) : (
                                  <span key={grandKey} className="text-sm text-muted-foreground">
                                    {grandchild.title}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
