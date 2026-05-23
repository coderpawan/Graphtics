/**
 * Inventory matrix: size × color grid; cell opens a modal to adjust on-hand with reason (ledger).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button, Badge, FormInput, FormTextarea } from '../../components/shared/Components';
import { useAdminAuth } from '../../context/AdminContext';
import { skuInventoryService } from '../../services/skuInventoryService';
import { STOCK_REASON_CODES, STOCK_REASON_LABELS, type StockReasonCode } from '../../../lib/inventorySkuCore';
import type { InventoryMatrixProduct, ProductSkuDoc } from '../../types/store';

/** Reasons allowed for admin matrix adjustments (omit system / checkout codes). */
const MATRIX_REASON_CODES = STOCK_REASON_CODES.filter(
  (c) => c !== 'ECOMMERCE_SALE' && c !== 'MIGRATION_OPENING_BALANCE'
) as StockReasonCode[];

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

function stockTone(s: ProductSkuDoc): 'success' | 'warning' | 'error' {
  if (s.stockStatus === 'out_of_stock') return 'error';
  if (s.stockStatus === 'low_stock') return 'warning';
  return 'success';
}

export default function InventoryList() {
  const { adminUser } = useAdminAuth();
  const userId = adminUser?.id ?? 'admin';

  const [products, setProducts] = useState<InventoryMatrixProduct[]>([]);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  type AdjustModalState = { productId: string; productName: string; cell: ProductSkuDoc };
  const [adjustModal, setAdjustModal] = useState<AdjustModalState | null>(null);
  const [modalNewQty, setModalNewQty] = useState('');
  const [modalReason, setModalReason] = useState<StockReasonCode>('MANUAL_ADJUSTMENT');
  const [modalNotes, setModalNotes] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const closeAdjustModal = useCallback(() => {
    setAdjustModal(null);
    setModalNotes('');
  }, []);

  useEffect(() => {
    if (!adjustModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !adjustSaving) closeAdjustModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adjustModal, adjustSaving, closeAdjustModal]);

  const load = useCallback(async (reset: boolean) => {
    try {
      if (reset) {
        setLoading(true);
        lastDocRef.current = null;
      } else setLoadingMore(true);
      setError(null);
      const res = await skuInventoryService.fetchInventoryMatrixPage({
        pageSize: 10,
        cursor: reset ? null : lastDocRef.current,
      });
      setProducts((prev) => (reset ? res.products : [...prev, ...res.products]));
      lastDocRef.current = res.lastDoc;
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .map((p) => {
        if (!q) return p;
        const hitName = p.productName.toLowerCase().includes(q);
        const hitSku = Object.values(p.cells).some((row) =>
          Object.values(row).some(
            (cell) => cell && (cell.skuCode || '').toLowerCase().includes(q)
          )
        );
        if (hitName || hitSku) return p;
        return null;
      })
      .filter(Boolean) as InventoryMatrixProduct[];
  }, [products, search]);

  const openAdjustModal = (productId: string, productName: string, cell: ProductSkuDoc) => {
    setAdjustModal({ productId, productName, cell });
    setModalNewQty(String(Math.max(0, Math.floor(cell.onHand))));
    setModalReason('MANUAL_ADJUSTMENT');
    setModalNotes('');
  };

  const submitAdjustModal = async () => {
    if (!adjustModal) return;
    const { productId, productName, cell } = adjustModal;
    const baseline = Math.max(0, Math.floor(cell.onHand));
    const draft = modalNewQty.trim();
    if (draft === '') {
      setError('Enter a new on-hand quantity.');
      return;
    }
    const target = Math.max(0, Math.floor(parseInt(draft, 10) || 0));
    const delta = target - baseline;
    if (delta === 0) {
      closeAdjustModal();
      return;
    }
    const notes =
      modalNotes.trim() ||
      `Inventory matrix · ${productName} · ${cell.skuCode || cell.id} · ${cell.attributes?.color ?? ''} / ${cell.attributes?.size ?? ''}`;
    try {
      setAdjustSaving(true);
      setError(null);
      await skuInventoryService.applyStockAdjustment({
        productId,
        skuId: cell.id,
        deltaOnHand: delta,
        reasonCode: modalReason,
        notes,
        userId,
      });
      closeAdjustModal();
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save quantity');
    } finally {
      setAdjustSaving(false);
    }
  };

  const syncProduct = async (productId: string) => {
    try {
      setSyncingId(productId);
      await skuInventoryService.syncSkusForProduct(productId);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const passesFilter = (s: ProductSkuDoc | null): boolean => {
    if (!s) return false;
    if (stockFilter === 'all') return true;
    return s.stockStatus === stockFilter;
  };

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Inventory matrix</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/inventory/ledger"
                className="inline-flex items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300"
              >
                Stock ledger
              </Link>
              <Link
                to="/admin/inventory/alerts"
                className="inline-flex items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300"
              >
                Low stock
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <FormInput
              label="Search"
              className="min-w-[220px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product name or SKU…"
            />
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Stock view</p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStockFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                      stockFilter === f
                        ? 'bg-slate-900 text-white ring-slate-900'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {loading && <p className="text-slate-500">Loading catalog…</p>}
            {!loading && filteredProducts.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-600 shadow-sm">
                No products with inventory rows match this page. If you expected a list here, confirm products are
                published (not draft), include variants or SKU documents, and that Firestore rules allow reads. Use
                &quot;Load more&quot; if the first batch had no stockable items.
              </p>
            )}
            {!loading &&
              filteredProducts.map((p) => (
                <div
                  key={p.productId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{p.productName}</h2>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={syncingId === p.productId}
                        onClick={() => void syncProduct(p.productId)}
                      >
                        Sync SKUs
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-4">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Color / fabric
                          </th>
                          {p.sizes.map((sz) => (
                            <th
                              key={sz}
                              className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600"
                            >
                              {sz}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.colors.map((color) => (
                          <tr key={color} className="border-b border-slate-100 last:border-0">
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">{color}</td>
                            {p.sizes.map((sz) => {
                              const cell = p.cells[color]?.[sz] ?? null;
                              const show = cell && passesFilter(cell);
                              if (!cell) {
                                return (
                                  <td key={sz} className="px-1 py-1 text-center text-slate-300">
                                    —
                                  </td>
                                );
                              }
                              if (!show) {
                                return (
                                  <td key={sz} className="px-1 py-1 text-center text-slate-200">
                                    <span className="text-xs">·</span>
                                  </td>
                                );
                              }
                              const pending = cell.id.startsWith('__pending__');
                              const onHandQty = Math.max(0, Math.floor(cell.onHand));
                              return (
                                <td key={sz} className="px-1 py-1 align-top">
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      if (adjustSaving) return;
                                      if (pending) {
                                        void syncProduct(p.productId);
                                        return;
                                      }
                                      openAdjustModal(p.productId, p.productName, cell);
                                    }}
                                    onKeyDown={(e) => {
                                      if (adjustSaving) return;
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        if (pending) void syncProduct(p.productId);
                                        else openAdjustModal(p.productId, p.productName, cell);
                                      }
                                    }}
                                    className={`flex min-w-[5.5rem] flex-col gap-1 rounded-lg border px-2 py-2 outline-none transition-shadow ${
                                      pending
                                        ? 'cursor-pointer border-amber-200/80 bg-amber-50/40 hover:border-amber-300'
                                        : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-slate-400'
                                    } ${adjustSaving ? 'pointer-events-none opacity-60' : ''}`}
                                  >
                                    <span className="truncate text-[10px] font-mono text-slate-600" title={cell.skuCode}>
                                      {cell.skuCode || '—'}
                                    </span>
                                    <span className="text-base font-semibold tabular-nums text-slate-900">
                                      {onHandQty}
                                    </span>
                                    <Badge
                                      text={cell.stockStatus.replace(/_/g, ' ')}
                                      variant={stockTone(cell)}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={loadingMore} onClick={() => void load(false)}>
                Load more products
              </Button>
            </div>
          )}

          {adjustModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="presentation"
              onClick={() => {
                if (!adjustSaving) closeAdjustModal();
              }}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="inventory-adjust-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="inventory-adjust-title" className="text-lg font-semibold text-slate-900">
                  Adjust on-hand stock
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {adjustModal.productName}
                  <span className="text-slate-500">
                    {' '}
                    · {adjustModal.cell.attributes?.color ?? '—'} / {adjustModal.cell.attributes?.size ?? '—'}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{adjustModal.cell.skuCode || adjustModal.cell.id}</p>

                <FormInput
                  label="New on-hand quantity"
                  type="number"
                  min={0}
                  step={1}
                  className="mt-4"
                  value={modalNewQty}
                  onChange={(e) => setModalNewQty(e.target.value)}
                  disabled={adjustSaving}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Current: {Math.max(0, Math.floor(adjustModal.cell.onHand))} · Reserved:{' '}
                  {Math.max(0, Math.floor(adjustModal.cell.reserved))}
                </p>

                <div className="mt-4">
                  <label htmlFor="matrix-adjust-reason" className="mb-2 block text-sm font-medium text-slate-700">
                    Reason (stock ledger)
                  </label>
                  <select
                    id="matrix-adjust-reason"
                    className="admin-control w-full"
                    value={modalReason}
                    disabled={adjustSaving}
                    onChange={(e) => setModalReason(e.target.value as StockReasonCode)}
                  >
                    {MATRIX_REASON_CODES.map((c) => (
                      <option key={c} value={c}>
                        {STOCK_REASON_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <FormTextarea
                  label="Notes (optional)"
                  className="mt-4"
                  rows={2}
                  value={modalNotes}
                  disabled={adjustSaving}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Extra detail for the ledger entry…"
                />

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" disabled={adjustSaving} onClick={() => closeAdjustModal()}>
                    Cancel
                  </Button>
                  <Button loading={adjustSaving} onClick={() => void submitAdjustModal()}>
                    Save and log to ledger
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
