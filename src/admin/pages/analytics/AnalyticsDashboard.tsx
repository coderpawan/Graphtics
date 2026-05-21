/**
 * Admin Analytics Page
 */

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, LineChart, PieChart } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { StatCard } from '../../components/shared/Components';
import { useSalesAnalytics } from '../../hooks/useAdmin';
import { formatCurrency } from '../../utils/helpers';

export default function AdminAnalytics() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const { analytics, loading } = useSalesAnalytics(dateRange.from, dateRange.to);

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">Track sales, revenue, and customer metrics</p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">Date Range:</label>
          <input
            type="date"
            value={dateRange.from.toISOString().split('T')[0]}
            onChange={(e) =>
              setDateRange({
                ...dateRange,
                from: new Date(e.target.value),
              })
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={dateRange.to.toISOString().split('T')[0]}
            onChange={(e) =>
              setDateRange({
                ...dateRange,
                to: new Date(e.target.value),
              })
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(analytics?.totalRevenue || 0)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            label="Total Orders"
            value={analytics?.totalOrders || 0}
            icon={BarChart3}
            color="blue"
          />
          <StatCard
            label="Avg Order Value"
            value={formatCurrency(analytics?.averageOrderValue || 0)}
            icon={LineChart}
            color="violet"
          />
          <StatCard
            label="Conversion Rate"
            value={`${analytics?.conversionRate?.toFixed(2)}%` || '0%'}
            icon={PieChart}
            color="orange"
          />
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sales Trend</h2>
            <div className="h-64 flex items-center justify-center bg-slate-50 rounded">
              <p className="text-slate-500">Chart coming soon</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Revenue Distribution</h2>
            <div className="h-64 flex items-center justify-center bg-slate-50 rounded">
              <p className="text-slate-500">Chart coming soon</p>
            </div>
          </div>
        </div>

        {/* Top Products */}
        {analytics?.topProducts && analytics.topProducts.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Top Products</h2>
            <div className="space-y-3">
              {analytics.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{product.productName}</p>
                    <p className="text-xs text-slate-500">{product.unitsSold} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-slate-500">{product.returnRate?.toFixed(2)}% returns</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
