'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';

type Props = {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
  children: React.ReactNode;
};

export default function IntlProvider({ locale, messages, timeZone, children }: Props) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      onError={(error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(error);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Missing translation: ${fullKey}`);
        }
        return fullKey;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
