import Link from 'next/link';
import { Container } from '@/components/layout/Container';

const buildStoreUrl = (path: string) => {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) return path;
  return `https://${domain}${path}`;
};

const footerLinks = [
  { label: 'Contact', path: '/pages/contact' },
  { label: 'Return & Shipping Policy', path: '/policies/shipping-policy' },
  { label: 'Privacy', path: '/policies/privacy-policy' },
  { label: 'Terms', path: '/policies/terms-of-service' },
];

export default function StoreFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <Container>
        <div className="flex w-full flex-col gap-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">skladondemand</p>
          <nav className="flex flex-wrap gap-4 text-[12px] uppercase tracking-[0.2em]" aria-label="Footer">
            {footerLinks.map((link) => {
              const href = buildStoreUrl(link.path);
              const isExternal = href.startsWith('http');
              return isExternal ? (
                <a key={link.label} href={href} className="cursor-pointer transition hover:text-foreground" rel="noreferrer">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={href} className="cursor-pointer transition hover:text-foreground">
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
