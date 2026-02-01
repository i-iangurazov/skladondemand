'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from './AccountProvider';

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

type Address = {
  id: string;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
};

type BonusLedger = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export default function AccountDashboard() {
  const router = useRouter();
  const { user, loading: accountLoading, refresh } = useAccount();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [bonus, setBonus] = useState<{ balance: number; ledger: BonusLedger[] } | null>(null);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [newAddress, setNewAddress] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'GB',
    isDefault: false,
  });
  const [editing, setEditing] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [addressRes, bonusRes] = await Promise.all([
        fetch('/api/me/addresses'),
        fetch('/api/me/bonus'),
      ]);
      const addressJson = addressRes.ok ? await addressRes.json() : null;
      const bonusJson = bonusRes.ok ? await bonusRes.json() : null;

      if (!user) return;

      setProfile({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        phone: user.phone ?? '',
      });
      setAddresses(addressJson?.addresses ?? []);
      setBonus(bonusJson ?? null);
    } catch {
      setError('Failed to load account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accountLoading && !user) {
      router.push('/account/login?next=/account');
      return;
    }
    if (user) {
      load();
    }
  }, [accountLoading, user]);

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!response.ok) {
      setError('Failed to update profile.');
      return;
    }
    await refresh();
  };

  const submitAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload = editing ?? newAddress;
    const response = await fetch(editing ? `/api/me/addresses/${editing.id}` : '/api/me/addresses', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError('Failed to save address.');
      return;
    }
    await load();
    setEditing(null);
    setNewAddress({
      label: '',
      line1: '',
      line2: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: 'GB',
      isDefault: false,
    });
  };

  const setDefault = async (addressId: string) => {
    await fetch(`/api/me/addresses/${addressId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  };

  const removeAddress = async (addressId: string) => {
    await fetch(`/api/me/addresses/${addressId}`, { method: 'DELETE' });
    await load();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/account/login');
  };

  if (loading || accountLoading) {
    return <div className="text-sm text-muted-foreground">Loading account...</div>;
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="flex flex-col gap-4 border border-border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profile</h2>
          <button
            type="button"
            onClick={logout}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            Logout
          </button>
        </div>
        <form onSubmit={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            First name
            <input
              value={profile.firstName}
              onChange={(event) => setProfile((prev) => ({ ...prev, firstName: event.target.value }))}
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Last name
            <input
              value={profile.lastName}
              onChange={(event) => setProfile((prev) => ({ ...prev, lastName: event.target.value }))}
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:col-span-2">
            Phone
            <input
              value={profile.phone}
              onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <button
            type="submit"
            className="h-10 border border-border bg-white px-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground sm:col-span-2"
          >
            Save profile
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4 border border-border p-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Addresses</h2>
        <div className="grid gap-3">
          {addresses.map((address) => (
            <div key={address.id} className="border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{address.label || 'Address'}</p>
                  <p className="text-xs text-muted-foreground">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {address.city}
                    {address.region ? `, ${address.region}` : ''} {address.postalCode},{' '}
                    {address.countryCode}
                  </p>
                </div>
                {address.isDefault ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Default</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!address.isDefault ? (
                  <button
                    type="button"
                    onClick={() => setDefault(address.id)}
                    className="h-8 border border-border px-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
                  >
                    Set default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  className="h-8 border border-border px-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeAddress(address.id)}
                  className="h-8 border border-border px-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submitAddress} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:col-span-2">
            Label
            <input
              value={editing?.label ?? newAddress.label}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, label: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, label: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:col-span-2">
            Line 1
            <input
              required
              value={editing?.line1 ?? newAddress.line1}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, line1: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, line1: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:col-span-2">
            Line 2
            <input
              value={editing?.line2 ?? newAddress.line2}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, line2: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, line2: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            City
            <input
              required
              value={editing?.city ?? newAddress.city}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, city: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, city: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Region
            <input
              value={editing?.region ?? newAddress.region}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, region: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, region: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Postal code
            <input
              required
              value={editing?.postalCode ?? newAddress.postalCode}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, postalCode: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, postalCode: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Country
            <input
              required
              value={editing?.countryCode ?? newAddress.countryCode}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, countryCode: event.target.value })
                  : setNewAddress((prev) => ({ ...prev, countryCode: event.target.value }))
              }
              className="h-10 border border-border bg-white px-3 text-sm text-foreground rounded-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={editing?.isDefault ?? newAddress.isDefault}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, isDefault: event.target.checked })
                  : setNewAddress((prev) => ({ ...prev, isDefault: event.target.checked }))
              }
            />
            Set as default
          </label>
          <button
            type="submit"
            className="h-10 border border-border bg-white px-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:bg-hover hover:text-foreground sm:col-span-2"
          >
            {editing ? 'Update address' : 'Add address'}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4 border border-border p-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bonus</h2>
        <div className="text-2xl font-semibold">{bonus?.balance ?? 0}</div>
        <div className="grid gap-2">
          {(bonus?.ledger ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-[0.2em]">{entry.reason}</span>
              <span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
