/**
 * Admin Orders Page
 */

import { useState } from 'react';
import { Eye, Download } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { DataTable, Button, Badge } from '../../components/shared/Components';
import { useAdminOrders } from '../../hooks/useAdmin';
import { formatCurrency, formatDate, getOrderStatusColor } from '../../utils/helpers';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AdminOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const { orders, loading } = useAdminOrders({ status: statusFilter || undefined });

  const columns = [
    {
      key: 'orderNumber' as const,
      label: 'Order #',
      sortable: true,
      width: 'w-24',
    },
    {
      key: 'createdAt' as const,
      label: 'Date',
      render: (date: any) => formatDate(date),
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
      key: 'paymentStatus' as const,
      label: 'Payment',
      render: (status: string) => (
        <Badge
          text={status}
          variant={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'default'}
        />
      ),
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (status: string) => (
        <Badge
          text={status}
          variant={status === 'delivered' ? 'success' : status === 'cancelled' ? 'error' : 'info'}
        />
      ),
    },
    {
      key: 'id' as const,
      label: 'Actions',
      render: (_, order) => (
        <button
          onClick={() => navigate(`/admin/orders/${order.id}`)}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <Eye className="w-4 h-4 text-slate-600" />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
            <p className="text-slate-600 mt-1">Manage and track all orders</p>
          </div>
          <Button variant="secondary" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          {[
            { value: '', label: 'All Orders', count: orders.length },
            { value: 'pending', label: 'Pending', count: orders.filter((o) => o.status === 'pending').length },
            { value: 'processing', label: 'Processing', count: orders.filter((o) => o.status === 'processing').length },
            { value: 'shipped', label: 'Shipped', count: orders.filter((o) => o.status === 'shipped').length },
            { value: 'delivered', label: 'Delivered', count: orders.filter((o) => o.status === 'delivered').length },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => {
                if (status.value) {
                  navigate(`/admin/orders?status=${status.value}`);
                } else {
                  navigate('/admin/orders');
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {status.label}
              <span className="ml-2 text-xs opacity-70">({status.count})</span>
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <DataTable
            columns={columns}
            data={orders}
            loading={loading}
            searchPlaceholder="Search by order number or customer..."
          />
        </div>
      </div>
    </AdminLayout>
  );
}
