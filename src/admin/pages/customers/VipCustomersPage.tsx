/**
 * VIP customers — highest lifetime spend from `customers` collection.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, Badge } from '../../components/shared/Components';
import { useAdminCustomers } from '../../hooks/useAdmin';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { AdminCustomer } from '../../types';

const VIP_MIN_SPEND = 250;

export default function VipCustomersPage() {
  const { customers, loading, error } = useAdminCustomers();

  const vip = useMemo(() => {
    return [...customers]
      .filter((c) => (c.totalSpent ?? 0) >= VIP_MIN_SPEND)
      .sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0));
  }, [customers]);

  const columns = [
    {
      key: 'email' as const,
      label: 'Email',
      render: (_: string, c: AdminCustomer) => (
        <Link to={`/admin/customers/${c.id}`} className="font-medium text-violet-600 hover:underline">
          {c.email}
        </Link>
      ),
    },
    {
      key: 'firstName' as const,
      label: 'Name',
      render: (_: unknown, c: AdminCustomer) => `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    },
    {
      key: 'totalSpent' as const,
      label: 'Lifetime spend',
      render: (v: number) => formatCurrency(v ?? 0),
    },
    {
      key: 'totalOrders' as const,
      label: 'Orders',
    },
    {
      key: 'registeredAt' as const,
      label: 'Member since',
      render: (d: unknown) => formatDate(d),
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (s: string) => <Badge text={s} variant={s === 'active' ? 'success' : 'default'} />,
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <Link to="/admin/customers" className="inline-flex items-center text-sm font-medium text-violet-600 hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All customers
          </Link>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">VIP customers</h1>
              <p className="mt-1 text-slate-600">
                Customers with at least {formatCurrency(VIP_MIN_SPEND)} total spend (loaded from your Firestore list).
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <DataTable columns={columns} data={vip} loading={loading} searchPlaceholder="Search VIP list…" />
            {!loading && vip.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">No customers meet the VIP threshold yet.</p>
            )}
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
