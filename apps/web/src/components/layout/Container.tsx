import type { ReactNode } from 'react';

export function Container({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">{children}</div>;
}

export function PageSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`w-full ${className}`.trim()}>{children}</section>;
}
