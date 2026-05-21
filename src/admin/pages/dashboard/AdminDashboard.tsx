/**
 * Admin Dashboard Page
 */

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { StatCard, Button } from '../../components/shared/Components';
import { useSalesAnalytics, useAdminOrders, useAdminProducts, useAdminCustomers } from '../../hooks/useAdmin';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { DataTable } from '../../components/shared/DataTable';

export default function AdminDashboard() {
  const { analytics, loading: analyticsLoading } = useSalesAnalytics();
  const { orders, loading: ordersLoading } = useAdminOrders({ status: 'pending' });
  const { products } = useAdminProducts();
  const { customers } = useAdminCustomers({ status: 'active' });

  const lowStockProducts = products.filter(
    (p) => p.inventory?.availableStock! < 10
  );

  const orderColumns = [
    {
      key: 'orderNumber' as const,
      label: 'Order #',
      width: 'w-20',
    },
    {
      key: 'customerEmail' as const,
      label: 'Customer',
    },
    {
      key: 'total' as const,
      label: 'Amount',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'status' as const,
      label: 'Status',
    },
  ];

  const productColumns = [
    {
      key: 'name' as const,
      label: 'Product',
    },
    {
      key: 'inventory' as const,
      label: 'Stock',
      render: (inv: any) => inv?.availableStock || 0,
    },
    {
      key: 'price' as const,
      label: 'Price',
      render: (price: any) => formatCurrency(price?.retail || 0),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here's your business overview.</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(analytics?.totalRevenue || 0)}
            icon={DollarSign}
            trend="up"
            change="12% from last month"
            color="green"
          />
          <StatCard
            label="Total Orders"
            value={analytics?.totalOrders || 0}
            icon={ShoppingCart}
            trend="up"
            change="8% from last month"
            color="blue"
          />
          <StatCard
            label="Total Customers"
            value={analytics?.totalCustomers || 0}
            icon={Users}
            trend="up"
            change="15% from last month"
            color="violet"
          />
          <StatCard
            label="Low Stock Items"
            value={lowStockProducts.length}
            icon={AlertTriangle}
            trend="down"
            change="Needs attention"
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pending Orders */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Pending Orders</h2>
                <Button variant="secondary" size="sm">
                  View All
                </Button>
              </div>
              <DataTable columns={orderColumns} data={orders.slice(0, 5)} loading={ordersLoading} />
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Top Products</h2>
                <Button variant="secondary" size="sm">
                  View All
                </Button>
              </div>
              <DataTable
                columns={productColumns}
                data={products.slice(0, 5)}
                loading={analyticsLoading}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-3">
                  ⚠️ Low Stock Alert
                </h3>
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div key={product.id} className="text-sm text-orange-700">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-orange-600">
                        {product.inventory?.availableStock} in stock
                      </p>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-4">
                  Manage Inventory
                </Button>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Avg Order Value</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(analytics?.averageOrderValue || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Conversion Rate</span>
                  <span className="font-semibold text-slate-900">
                    {analytics?.conversionRate?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Refund Rate</span>
                  <span className="font-semibold text-slate-900">
                    {analytics?.refundRate?.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
