import type { Metadata } from 'next';
import { Jost } from 'next/font/google';
import './globals.css';
import StoreFooter from '@/components/store/StoreFooter';
import StoreHeader from '@/components/store/StoreHeader';
import { FavoritesProvider } from '@/components/store/FavoritesProvider';

const font = Jost({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jost',
});

export const metadata: Metadata = {
  title: 'skladondemand',
  description: 'Sharp essentials and everyday clothing, shipped from Shopify.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${font.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <FavoritesProvider>
          <StoreHeader />
          <main className="flex-1">{children}</main>
          <StoreFooter />
        </FavoritesProvider>
      </body>
    </html>
  );
}
