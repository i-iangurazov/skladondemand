'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/account';
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Registration failed.');
      }
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Email
        <input
          type="email"
          required
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          First name
          <input
            value={form.firstName}
            onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Last name
          <input
            value={form.lastName}
            onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Phone
        <input
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
        />
      </label>
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Password
        <input
          type="password"
          required
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="h-10 border border-border bg-white px-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create account'}
      </button>
    </form>
  );
}
