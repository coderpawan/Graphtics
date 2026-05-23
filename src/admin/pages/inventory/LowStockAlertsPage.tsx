/**
 * Low stock — uses SKU subcollection (`isLowStock`) when deployed; falls back gracefully.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable } from '../../components/shared/DataTable';
import { skuInventoryService } from '../../services/skuInventoryService';
import type { ProductSkuDoc } from '../../types/store';

export default function LowStockAlertsPage() {
  const [rows, setRows] = useState<ProductSkuDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void skuInventoryService
      .listLowStockSkus(300)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'skuCode' as const, label: 'SKU', sortable: true },
    { key: 'productName' as const, label: 'Product', sortable: true },
    {
      key: 'attributes' as const,
      label: 'Variant',
      render: (a: ProductSkuDoc['attributes']) => (
        <span className="text-slate-700">
          {(a?.color ?? '') + (a?.size ? ` · ${a.size}` : '')}
        </span>
      ),
    },
    {
      key: 'available' as const,
      label: 'Available',
      sortable: true,
      render: (n: number) => (
        <span className={n <= 0 ? 'font-semibold text-red-600' : n <= 5 ? 'font-semibold text-amber-700' : 'text-slate-900'}>
          {n}
        </span>
      ),
    },
    {
      key: 'safetyStock' as const,
      label: 'Safety stock',
      sortable: true,
    },
    {
      key: 'onHand' as const,
      label: 'On hand',
    },
    {
      key: 'id' as const,
      label: 'Gap',
      render: (_: string, row: ProductSkuDoc) => {
        const gap = row.available - row.safetyStock;
        return <span className="font-medium text-slate-700">{gap}</span>;
      },
    },
    {
      key: 'productId' as const,
      label: '',
      render: (productId: string) => (
        <Link
          to="/admin/inventory"
          className="text-sm font-medium text-violet-600 hover:text-violet-800"
          title="Open inventory matrix"
        >
          Matrix
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Low stock alerts</h1>
            <p className="mt-1 text-slate-600">
              SKUs where available quantity is at or below the SKU&apos;s safety threshold (set per product, per SKU
              after sync, or derived from stock levels when unset).
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <DataTable columns={columns} data={rows} loading={loading} searchPlaceholder="Search SKU or product…" />
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
