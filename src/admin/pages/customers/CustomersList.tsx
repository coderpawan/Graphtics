/**
 * Admin Customers Page
 */

import { useState } from 'react';
import { Eye, Ban } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, Badge } from '../../components/shared/Components';
import { useAdminCustomers } from '../../hooks/useAdmin';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';
import type { AdminCustomer } from '../../types';

export default function AdminCustomers() {
  const navigate = useNavigate();
  const { customers, loading, error } = useAdminCustomers();
  const [filters, setFilters] = useState({
    status: 'active',
  });

  const filteredCustomers = customers.filter((c) => {
    if (filters.status && c.status !== filters.status) return false;
    return true;
  });

  const columns = [
    {
      key: 'email' as const,
      label: 'Email',
      sortable: true,
    },
    {
      key: 'firstName' as const,
      label: 'Name',
      render: (_value: unknown, customer: AdminCustomer) =>
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    },
    {
      key: 'phone' as const,
      label: 'Phone',
    },
    {
      key: 'phoneAlt' as const,
      label: 'Alt phone',
      render: (_: unknown, customer: AdminCustomer) => customer.phoneAlt || '—',
    },
    {
      key: 'totalOrders' as const,
      label: 'Orders',
      sortable: true,
    },
    {
      key: 'totalSpent' as const,
      label: 'Total Spent',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'registeredAt' as const,
      label: 'Registered',
      render: (date: any) => formatDate(date),
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (status: string) => (
        <Badge
          text={status}
          variant={
            status === 'active'
              ? 'success'
              : status === 'suspended'
              ? 'warning'
              : 'error'
          }
        />
      ),
    },
    {
      key: 'id' as const,
      label: 'Actions',
      render: (_value: unknown, customer: AdminCustomer) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/customers/${customer.id}`)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-600" />
          </button>
          {customer.status === 'active' && (
            <button className="p-1 hover:bg-red-50 rounded transition-colors">
              <Ban className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-600 mt-1">Manage customer profiles and interactions</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          {[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'blocked', label: 'Blocked' },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilters({ status: status.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.status === status.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Customers Table */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <DataTable
            columns={columns}
            data={filteredCustomers}
            loading={loading}
            searchPlaceholder="Search by email or name..."
          />
        </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
