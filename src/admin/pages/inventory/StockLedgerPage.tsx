/**
 * Append-only stock ledger — accountability trail.
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, FormInput } from '../../components/shared/Components';
import { skuInventoryService } from '../../services/skuInventoryService';
import { coerceDate, formatDateTime } from '../../utils/helpers';
import type { StockLedgerEntry } from '../../types/store';

export default function StockLedgerPage() {
  const [rows, setRows] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const data = await skuInventoryService.fetchLedgerPage({ max: 150, skuCode: skuFilter.trim() || undefined });
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load ledger');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skuFilter]);

  const columns = [
    {
      key: 'timestamp' as const,
      label: 'When',
      sortable: true,
      render: (_: unknown, row: StockLedgerEntry) => formatDateTime(coerceDate(row.timestamp)),
    },
    { key: 'reasonCode' as const, label: 'Reason', sortable: true },
    { key: 'skuCode' as const, label: 'SKU', sortable: true },
    {
      key: 'deltaOnHand' as const,
      label: 'Δ Qty',
      sortable: true,
      render: (n: number) => <span className={n < 0 ? 'text-red-600' : 'text-emerald-700'}>{n > 0 ? `+${n}` : n}</span>,
    },
    { key: 'balanceOnHandAfter' as const, label: 'On hand after', sortable: true },
    { key: 'balanceAvailableAfter' as const, label: 'Available after' },
    { key: 'userId' as const, label: 'User' },
    { key: 'source' as const, label: 'Source' },
    {
      key: 'notes' as const,
      label: 'Notes',
      render: (t: string) => (
        <span className="block max-w-xs truncate" title={t}>
          {t}
        </span>
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stock ledger</h1>
            <p className="mt-1 text-slate-600">Every on-hand change is recorded with reason, user, and balances.</p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <FormInput
              label="Filter by SKU"
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              placeholder="Exact or partial SKU code"
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <DataTable columns={columns} data={rows} loading={loading} searchPlaceholder=" " />
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
