'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidPhone } from '@/lib/auth/validation';
import { cn } from '@/lib/utils';

type ErrorState = { scope: 'auth' | 'errors'; key: string } | null;

const parseErrorCode = (code?: string | null): ErrorState => {
  if (!code) return { scope: 'errors', key: 'generic' };
  if (code.startsWith('avantech.auth.')) {
    return { scope: 'auth', key: code.replace('avantech.auth.', '') };
  }
  if (code.startsWith('errors.')) {
    return { scope: 'errors', key: code.replace('errors.', '') };
  }
  return { scope: 'errors', key: 'generic' };
};

export default function LoginForm() {
  const tAuth = useTranslations('avantech.auth');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorMessage = error ? (error.scope === 'auth' ? tAuth(error.key) : tErrors(error.key)) : null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedPhone = phone.trim();
    const normalizedPassword = password.trim();

    if (!normalizedPhone || !normalizedPassword) {
      setError({ scope: 'auth', key: 'required' });
      return;
    }

    if (!isValidPhone(normalizedPhone)) {
      setError({ scope: 'auth', key: 'invalidPhone' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, password: normalizedPassword }),
      });
      const payload = (await response.json().catch(() => null)) as { code?: string } | null;

      if (!response.ok) {
        setError(parseErrorCode(payload?.code ?? null));
        return;
      }

      router.replace('/');
    } catch {
      setError({ scope: 'errors', key: 'generic' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md rounded-3xl border-border/70 bg-white/90 shadow-lg backdrop-blur">
      <CardHeader className="space-y-2 px-6 pt-6">
        <CardTitle className="text-2xl">{tAuth('title')}</CardTitle>
        <CardDescription>{tAuth('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            {tAuth('phoneLabel')}
            <Input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (error) setError(null);
              }}
              placeholder={tAuth('phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errorMessage)}
              className={cn('h-11 rounded-2xl', error && 'border-destructive/60 focus-visible:ring-destructive/30')}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            {tAuth('passwordLabel')}
            <Input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              placeholder={tAuth('passwordPlaceholder')}
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errorMessage)}
              className={cn('h-11 rounded-2xl', error && 'border-destructive/60 focus-visible:ring-destructive/30')}
            />
          </label>
          {errorMessage && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
          <Button type="submit" className="h-11 w-full rounded-full text-sm font-semibold" disabled={isSubmitting}>
            {isSubmitting ? tAuth('submitting') : tAuth('submit')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="px-6 pb-6">
        <div className="text-xs text-muted-foreground">{tAuth('helper')}</div>
      </CardFooter>
    </Card>
  );
}
