/**
 * Admin dashboard — aggregates + live pending orders snapshot.
 */

import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DollarSign, ShoppingCart, Package, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { StatCard, Button } from '../../components/shared/Components';
import { DataTable } from '../../components/shared/DataTable';
import {
  useDashboardSnapshot,
  usePendingOrdersListener,
  useSalesAnalytics,
} from '../../hooks/useAdmin';
import { formatCurrency, coerceDate } from '../../utils/helpers';

export default function AdminDashboard() {
  const { snapshot, error: snapErr } = useDashboardSnapshot();
  const { orders: livePending, error: liveErr } = usePendingOrdersListener();
  const { analytics, loading: trendLoading } = useSalesAnalytics();

  const chartData =
    analytics?.salesTrend?.slice(-14).map((d) => ({
      label: d.date.slice(5),
      revenue: Math.round(d.revenue),
    })) ?? [];

  const pendingColumns = [
    { key: 'orderId' as const, label: 'Order #' },
    { key: 'customerName' as const, label: 'Customer' },
    {
      key: 'totalAmount' as const,
      label: 'Amount',
      render: (v: number) => formatCurrency(v),
    },
    {
      key: 'createdAt' as const,
      label: 'Placed',
      render: (v: unknown) => coerceDate(v).toLocaleString(),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-slate-600">Revenue snapshot (recent paid orders) and live pending shipping.</p>
          </div>

          {(snapErr || liveErr) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {snapErr || liveErr}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total revenue (sample)"
              value={formatCurrency(snapshot?.revenue ?? 0)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              label="Paid orders (sample)"
              value={snapshot?.orderCount ?? 0}
              icon={ShoppingCart}
              color="blue"
            />
            <StatCard
              label="Out-of-stock SKUs (sample)"
              value={snapshot?.outOfStockSkus ?? 0}
              icon={Package}
              color="orange"
            />
            <StatCard
              label="Pending shipping (recent)"
              value={snapshot?.pendingShippingCount ?? 0}
              icon={AlertTriangle}
              color="violet"
            />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Sales trend (last points)</h2>
              <div className="h-64">
                {trendLoading ? (
                  <p className="text-slate-500">Loading chart…</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Live pending orders</h2>
                <Link to="/admin/orders?status=pending">
                  <Button variant="secondary" size="sm">
                    Open queue
                  </Button>
                </Link>
              </div>
              <DataTable columns={pendingColumns} data={livePending} loading={false} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-bold text-slate-900">Top categories (paid / fulfilled)</h2>
            <div className="space-y-3">
              {(analytics?.salesByCategory ?? []).slice(0, 6).map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{c.category}</span>
                    <span className="text-slate-500">{c.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, c.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!trendLoading && !(analytics?.salesByCategory?.length) && (
                <p className="text-sm text-slate-500">No category data yet — include `categories` on order line items when checking out.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin/inventory/alerts">
              <Button variant="secondary">Low stock</Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="secondary">Export reports</Button>
            </Link>
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
