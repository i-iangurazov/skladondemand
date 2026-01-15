import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import { getLocale, getMessages, getTranslations, getTimeZone } from 'next-intl/server';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import IntlProvider from '@/components/IntlProvider';

const font = Open_Sans({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-open-sans',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('common.meta.title'),
    description: t('common.meta.description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();

  return (
    <html lang={locale}>
      <body className={`${font.variable} font-sans antialiased`}>
        <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
          {children}
          <Toaster />
        </IntlProvider>
      </body>
    </html>
  );
}
