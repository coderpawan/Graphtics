/**
 * Customer profile (Firestore `customers` collection shape).
 */

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Badge } from '../../components/shared/Components';
import { useAdminCustomer } from '../../hooks/useAdmin';
import { formatCurrency, formatDate } from '../../utils/helpers';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { customer, loading, error } = useAdminCustomer(id ?? '');

  if (!id) {
    return (
      <AdminLayout>
        <p className="text-slate-600">Missing customer id.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-3xl space-y-6">
          <Link to="/admin/customers" className="inline-flex items-center text-sm font-medium text-violet-600 hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" />
            All customers
          </Link>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {loading && !customer ? (
            <p className="text-slate-600">Loading…</p>
          ) : customer ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {customer.firstName} {customer.lastName}
                  </h1>
                  <p className="mt-1 text-slate-600">{customer.email}</p>
                </div>
                <Badge
                  text={customer.status}
                  variant={
                    customer.status === 'active' ? 'success' : customer.status === 'suspended' ? 'warning' : 'error'
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</h2>
                  <p className="mt-1 text-slate-900">{customer.phone || '—'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered</h2>
                  <p className="mt-1 text-slate-900">{formatDate(customer.registeredAt)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total orders</h2>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{customer.totalOrders}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total spent</h2>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(customer.totalSpent)}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
