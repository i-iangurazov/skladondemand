'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatDate = (value: string) => new Date(value).toLocaleString();
const formatTotal = (value: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} KGS`;

type NotificationSummary = {
  status: 'SENT' | 'FAILED' | 'PENDING';
  lastError: string | null;
  counts: { sent: number; failed: number; pending: number };
};

type OrderRow = {
  id: string;
  createdAt: string;
  total: number;
  itemsSummary: string;
  customer: { id: string; name: string | null; phone: string | null; address: string | null } | null;
  notifications: { telegram: NotificationSummary; whatsapp: NotificationSummary };
};

const getStatusVariant = (status: NotificationSummary['status']) => {
  if (status === 'SENT') return 'secondary';
  if (status === 'FAILED') return 'destructive';
  return 'outline';
};

const buildCountsLabel = (counts: NotificationSummary['counts']) => {
  const parts: string[] = [];
  if (counts.sent) parts.push(`${counts.sent} sent`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  return parts.length ? parts.join(' · ') : 'No jobs';
};

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const hasOrders = orders.length > 0;
  const failedCount = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.notifications.telegram.counts.failed > 0 || order.notifications.whatsapp.counts.failed > 0
      ).length,
    [orders]
  );

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/orders');
      const payload = (await response.json().catch(() => null)) as { orders?: OrderRow[] } | null;
      if (!response.ok) {
        setError('Unable to load orders.');
        return;
      }
      setOrders(payload?.orders ?? []);
    } catch {
      setError('Unable to load orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleRetry = async (orderId: string) => {
    setRetryingId(orderId);
    try {
      const response = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) {
        setError('Failed to retry notifications.');
        return;
      }
      await loadOrders();
    } catch {
      setError('Failed to retry notifications.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Orders</h1>
            <p className="text-sm text-muted-foreground">
              {failedCount} orders need notification retry · {orders.length} total
            </p>
          </div>
          <Button variant="outline" onClick={loadOrders} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Order notifications</CardTitle>
              <div className="text-xs text-muted-foreground">Latest {orders.length} orders</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading orders...</div>
            ) : hasOrders ? (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[1024px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Order</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Total</th>
                      <th className="px-3 py-2 text-left">Items</th>
                      <th className="px-3 py-2 text-left">Notifications</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orders.map((order) => {
                      const telegram = order.notifications.telegram;
                      const whatsapp = order.notifications.whatsapp;
                      const hasFailure = telegram.counts.failed > 0 || whatsapp.counts.failed > 0;

                      return (
                        <tr key={order.id} className="transition-colors odd:bg-muted/20 hover:bg-muted/30">
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-foreground" title={order.id}>
                              #{order.id.slice(0, 8)}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-foreground">
                              {order.customer?.name ?? 'Guest'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {order.customer?.phone ?? '—'}
                            </div>
                            {order.customer?.address ? (
                              <div className="text-xs text-muted-foreground">{order.customer.address}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top font-medium">{formatTotal(order.total)}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="max-w-[220px] truncate text-xs text-muted-foreground" title={order.itemsSummary}>
                              {order.itemsSummary}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Telegram</div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusVariant(telegram.status)}>{telegram.status}</Badge>
                                  <span className="text-xs text-muted-foreground">{buildCountsLabel(telegram.counts)}</span>
                                </div>
                                {telegram.lastError ? (
                                  <div className="text-xs text-destructive">{telegram.lastError}</div>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">WhatsApp</div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusVariant(whatsapp.status)}>{whatsapp.status}</Badge>
                                  <span className="text-xs text-muted-foreground">{buildCountsLabel(whatsapp.counts)}</span>
                                </div>
                                {whatsapp.lastError ? (
                                  <div className="text-xs text-destructive">{whatsapp.lastError}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Button
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              disabled={!hasFailure || retryingId === order.id}
                              onClick={() => handleRetry(order.id)}
                            >
                              {retryingId === order.id ? 'Retrying...' : 'Retry failed'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No orders yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
