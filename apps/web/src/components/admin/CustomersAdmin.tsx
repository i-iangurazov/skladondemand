'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Customer = {
  id: string;
  name: string | null;
  phone: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
};

type ApiError = { field: string; code: string; message: string };

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const extractErrorMessage = (payload: { errors?: ApiError[] } | null) => {
  if (payload?.errors?.length) {
    return payload.errors.map((err) => err.message).join(' ');
  }
  return 'Something went wrong.';
};

export default function CustomersAdmin() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    password: '',
  });

  const hasCustomers = customers.length > 0;

  const totalActive = useMemo(() => customers.filter((customer) => customer.isActive).length, [customers]);

  const resetForm = () => {
    setForm({ name: '', phone: '', address: '', password: '' });
    setFormError(null);
    setTempPassword(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/customers');
      const payload = (await response.json().catch(() => null)) as { users?: Customer[] } | null;
      if (!response.ok) {
        setError('Unable to load customers.');
        return;
      }
      setCustomers(payload?.users ?? []);
    } catch {
      setError('Unable to load customers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: Customer; tempPassword?: string; errors?: ApiError[] }
        | null;

      if (!response.ok) {
        setFormError(extractErrorMessage(payload));
        return;
      }

      if (payload?.user) {
        setCustomers((prev) => [payload.user!, ...prev]);
      }

      if (payload?.tempPassword) {
        setTempPassword(payload.tempPassword);
      } else {
        handleDialogChange(false);
      }
    } catch {
      setFormError('Unable to create customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">Create and manage customer accounts.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Customers</CardTitle>
              <div className="text-xs text-muted-foreground">
                {totalActive} active · {customers.length} total
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>Create customer</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading customers...</div>
            ) : hasCustomers ? (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[768px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="transition-colors odd:bg-muted/20 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-foreground">{customer.name ?? '—'}</td>
                        <td className="px-3 py-2">{customer.phone}</td>
                        <td className="px-3 py-2">{customer.address ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={customer.isActive ? 'secondary' : 'destructive'} className="font-normal">
                            {customer.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{formatDate(customer.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No customers yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create customer</DialogTitle>
            <DialogDescription>Set customer name, phone, and optional address.</DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <div className="font-semibold">Temporary password</div>
                <div className="mt-2 rounded-md border border-emerald-200 bg-white px-3 py-2 font-mono text-base">
                  {tempPassword}
                </div>
                <p className="mt-2 text-xs text-emerald-700">
                  Share this password now. It is shown only once.
                </p>
              </div>
              <Button className="w-full" onClick={() => handleDialogChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleCreate}>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Name
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Customer name"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Phone
                <Input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+996XXXXXXXXX"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Address (optional)
                <Input
                  value={form.address}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Street, building"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                Password (optional)
                <Input
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Leave blank to generate"
                />
              </label>
              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create customer'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
