/**
 * Returns — mark delivered/shipped orders as returned and restock SKUs (transaction).
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, Button, Badge } from '../../components/shared/Components';
import { formatCurrency, coerceDate } from '../../utils/helpers';
import { orderService } from '../../services/orderService';
import type { StoreOrder, StoreOrderStatus } from '../../types/store';

export default function OrdersReturnsPage() {
  const [eligible, setEligible] = useState<StoreOrder[]>([]);
  const [returned, setReturned] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [shipRes, delRes, retRes] = await Promise.all([
        orderService.fetchPage({ status: 'shipped', pageSize: 40 }),
        orderService.fetchPage({ status: 'delivered', pageSize: 40 }),
        orderService.fetchPage({ status: 'returned', pageSize: 40 }),
      ]);
      const merged = [...shipRes.items, ...delRes.items].filter(
        (o, i, arr) => arr.findIndex((x) => x.id === o.id) === i
      );
      setEligible(merged);
      setReturned(retRes.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markReturned = async (order: StoreOrder) => {
    try {
      setBusyId(order.id);
      await orderService.markReturnedWithRestock(order.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process return');
    } finally {
      setBusyId(null);
    }
  };

  const columns = (mode: 'eligible' | 'returned') => [
    {
      key: 'orderId' as const,
      label: 'Order',
      sortable: true,
    },
    {
      key: 'customerName' as const,
      label: 'Customer',
    },
    {
      key: 'customerEmail' as const,
      label: 'Email',
    },
    {
      key: 'returnRequest' as const,
      label: 'Return req.',
      render: (_: unknown, row: StoreOrder) => {
        const s = row.returnRequest?.status;
        if (!s || s === 'completed') return <span className="text-xs text-slate-400">—</span>;
        return <Badge text={s} variant={s === 'pending' ? 'warning' : s === 'approved' ? 'success' : 'error'} />;
      },
    },
    {
      key: 'totalAmount' as const,
      label: 'Total',
      render: (v: number) => formatCurrency(v),
    },
    {
      key: 'status' as const,
      label: 'Fulfillment',
      render: (s: StoreOrderStatus) => (
        <Badge
          text={s}
          variant={s === 'returned' ? 'warning' : s === 'delivered' ? 'success' : 'info'}
        />
      ),
    },
    {
      key: 'createdAt' as const,
      label: 'Date',
      render: (v: unknown) => coerceDate(v).toLocaleDateString(),
    },
    {
      key: 'customerId' as const,
      label: '',
      render: (_: unknown, row: StoreOrder) =>
        mode === 'eligible' ? (
          <Button size="sm" variant="secondary" loading={busyId === row.id} onClick={() => void markReturned(row)}>
            Mark returned + restock
          </Button>
        ) : (
          <span className="text-xs text-slate-400">Recorded</span>
        ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Returns</h1>
            <p className="mt-1 text-slate-600">
              Mark eligible orders as returned. Inventory is incremented in a Firestore transaction per SKU.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Eligible orders</h2>
            <p className="text-sm text-slate-500">Shipped or delivered — not yet returned.</p>
            <div className="mt-4">
              <DataTable columns={columns('eligible')} data={eligible} loading={loading} />
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Returned history</h2>
            <div className="mt-4">
              <DataTable columns={columns('returned')} data={returned} loading={loading} />
            </div>
          </section>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
