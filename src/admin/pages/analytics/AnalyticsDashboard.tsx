/**
 * Analytics — charts + KPIs from Firestore orders.
 */

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, LineChart as LineIcon, PieChart } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { StatCard } from '../../components/shared/Components';
import { useSalesAnalytics } from '../../hooks/useAdmin';
import { formatCurrency } from '../../utils/helpers';
import type { ProductSales } from '../../types';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const { analytics, loading } = useSalesAnalytics(dateRange.from, dateRange.to);

  const trend = analytics?.salesTrend?.map((d) => ({
    day: d.date.slice(5),
    revenue: Math.round(d.revenue),
    orders: d.orders,
  }));

  const cats = analytics?.salesByCategory?.map((c) => ({
    name: c.category.length > 12 ? `${c.category.slice(0, 12)}…` : c.category,
    revenue: Math.round(c.sales),
  }));

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
            <p className="mt-1 text-slate-600">Sales, revenue, and category mix from recent orders.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-sm font-medium text-slate-700">Date range</label>
            <input
              type="date"
              value={dateRange.from.toISOString().split('T')[0]}
              onChange={(e) => setDateRange((r) => ({ ...r, from: new Date(e.target.value) }))}
              className="admin-control-inline min-w-[10rem]"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={dateRange.to.toISOString().split('T')[0]}
              onChange={(e) => setDateRange((r) => ({ ...r, to: new Date(e.target.value) }))}
              className="admin-control-inline min-w-[10rem]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total revenue"
              value={formatCurrency(analytics?.totalRevenue || 0)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              label="Total orders"
              value={analytics?.totalOrders || 0}
              icon={BarChart3}
              color="blue"
            />
            <StatCard
              label="Avg order value"
              value={formatCurrency(analytics?.averageOrderValue || 0)}
              icon={LineIcon}
              color="violet"
            />
            <StatCard
              label="Refund / return rate"
              value={`${(analytics?.refundRate ?? 0).toFixed(1)}%`}
              icon={PieChart}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Sales trend</h2>
              <div className="h-72">
                {loading ? (
                  <p className="text-slate-500">Loading…</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="orders" name="Orders" stroke="#0ea5e9" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Revenue by category</h2>
              <div className="h-72">
                {loading ? (
                  <p className="text-slate-500">Loading…</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cats} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {analytics?.topProducts && analytics.topProducts.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Top products</h2>
              <div className="space-y-3">
                {analytics.topProducts.map((product: ProductSales, index: number) => (
                  <div key={index} className="flex items-center justify-between border-b border-slate-200 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{product.productName}</p>
                      <p className="text-xs text-slate-500">{product.unitsSold} units</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
