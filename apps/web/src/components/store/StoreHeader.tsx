import Link from 'next/link';
import { getCart } from '@/lib/shopify/cart';
import { getCartIdFromCookies } from '@/lib/shopify/cart-cookie';
import { getStorefrontContext } from '@/lib/shopify/context';
import { getAllCollections, getMenu } from '@/lib/shopify/storefront';
import NavDropdown from './NavDropdown';
import NavLink from './NavLink';
import MobileMenu from './MobileMenu';
import SearchBox from './SearchBox';
import ProfileLink from './ProfileLink';
import { Container } from '@/components/layout/Container';
import { icons } from '@/components/icons';

const CartIcon = icons.cart;
const HeartIcon = icons.heart;

type MenuNode = NonNullable<Awaited<ReturnType<typeof getMenu>>>[number];
type NavItem = { title: string; href?: string | null; items?: NavItem[] };

const parseCollectionHandle = (url: string) => {
  try {
    const path = new URL(url, 'https://example.com').pathname;
    const match = path.match(/\/collections\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const resolveHref = (url?: string | null) => {
  if (!url) return null;
  const handle = parseCollectionHandle(url);
  if (handle) return `/collections/${handle}`;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
};

const mapMenuItems = (items?: MenuNode[]): NavItem[] => {
  if (!items?.length) return [];
  return items
    .map((item) => {
      const href = resolveHref(item.url);
      const children = mapMenuItems(item.items);
      return {
        title: item.title,
        href,
        items: children.length ? children : undefined,
      };
    })
    .filter((item) => item.title);
};

const shouldExcludeNavItem = (item: NavItem) => {
  const title = item.title.trim().toLowerCase();
  const href = item.href?.toLowerCase() ?? '';
  const excludedTitles = new Set([
    'contact',
    'return & shipping policy',
    'returns & shipping policy',
    'return and shipping policy',
    'returns and shipping policy',
    'return policy',
    'returns policy',
    'shipping policy',
  ]);

  if (excludedTitles.has(title)) return true;
  if (href.includes('/pages/contact')) return true;
  if (href.includes('/policies/')) return true;
  if (href.includes('/pages/returns') || href.includes('/pages/return')) return true;
  return false;
};

const filterNavItems = (items: NavItem[]): NavItem[] =>
  items.flatMap((item) => {
    if (shouldExcludeNavItem(item)) return [];
    const children = item.items?.length ? filterNavItems(item.items) : undefined;
    return [
      {
        ...item,
        items: children?.length ? children : undefined,
      },
    ];
  });

const renderLink = (
  href: string | null | undefined,
  className: string,
  children: React.ReactNode,
  hasPopup = false
) => {
  if (!href) {
    return (
      <button type="button" className={`${className} cursor-pointer`} aria-haspopup={hasPopup ? 'true' : undefined}>
        {children}
      </button>
    );
  }

  if (href.startsWith('http')) {
    return (
      <a href={href} className={`${className} cursor-pointer`} rel="noreferrer">
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
    >
      {children}
    </NavLink>
  );
};

export default async function StoreHeader() {
  const context = await getStorefrontContext();
  let menu: MenuNode[] | null = null;
  try {
    menu = await getMenu('main-menu', context);
  } catch {
    menu = null;
  }
  let navItems: NavItem[] = [];
  if (menu?.length) {
    navItems = mapMenuItems(menu);
  } else {
    try {
      const collections = await getAllCollections(context);
      navItems = collections.map(
        (collection): NavItem => ({
          title: collection.title,
          href: `/collections/${collection.handle}`,
        })
      );
    } catch {
      navItems = [];
    }
  }
  const filteredNavItems = filterNavItems(navItems);

  const cartId = await getCartIdFromCookies();
  let cart = null;
  if (cartId) {
    try {
      cart = await getCart(cartId, context);
    } catch {
      cart = null;
    }
  }
  const itemCount = cart?.totalQuantity ?? 0;
  const navLinkClass =
    "relative cursor-pointer border-0 border-b border-transparent bg-transparent px-0 py-0 pb-1 text-[12px] font-medium uppercase tracking-[0.2em] text-neutral-700 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:scale-x-0 after:bg-black after:transition-transform after:duration-150 hover:after:scale-x-100";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white">
      <Container>
        <div className="flex h-14 items-center justify-between gap-4 sm:h-16">
          <div className="flex items-center gap-3">
            <MobileMenu items={filteredNavItems} country={context.country} />
            <Link
              href="/"
              className="cursor-pointer text-sm font-semibold uppercase tracking-[0.16em] sm:text-base"
            >
              SKLADONDEMAND
            </Link>
          </div>
          <nav
            className="hidden items-center gap-4 text-[12px] text-muted-foreground xl:flex xl:gap-6"
            aria-label="Primary"
          >
          {filteredNavItems.map((item, index) =>
            item.items?.length ? (
              <NavDropdown key={`${item.title}-${index}`} label={item.title} href={item.href} items={item.items} />
            ) : (
              <span key={`${item.title}-${index}`}>
                {renderLink(
                  item.href,
                  navLinkClass,
                  item.title
                )}
              </span>
            )
          )}
          </nav>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <SearchBox country={context.country} className="hidden w-48 md:block lg:w-64" />
            <ProfileLink />
            <Link
              href="/favorites"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-border text-foreground transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-10 sm:w-10"
              aria-label="Favorites"
            >
              <HeartIcon className="size-4" />
            </Link>
            <Link
              href="/cart"
              className="relative inline-flex h-9 cursor-pointer items-center justify-center gap-2 border border-border px-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:h-10"
              aria-label="Cart"
            >
              <CartIcon className="size-4" />
              {itemCount > 0 && (
                <span className="ml-1 border border-border bg-hover px-2 text-[11px] font-semibold">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
