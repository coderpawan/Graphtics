/**
 * Product catalog table — pagination, inline price/status, delete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, Button, Badge, FormInput } from '../../components/shared/Components';
import { metadataService } from '../../services/metadataService';
import { productService, totalVariantStock } from '../../services/productService';
import type { StoreProduct, StoreProductStatus } from '../../types/store';

const ADMIN_PRODUCT_THUMB_PLACEHOLDER = 'https://placehold.co/48x48/png?text=—';

/** List row image: default storefront colour first, then any colour with photos, then legacy `images`. */
function adminProductListThumbnail(p: StoreProduct): string {
  const def = p.defaultDisplayColor?.trim();
  const ibc = p.imagesByColor;
  if (def && ibc?.[def]?.length) return ibc[def][0];
  const variantColors = [...new Set(p.variants.map((v) => v.color.trim()).filter(Boolean))];
  for (const c of variantColors) {
    if (ibc?.[c]?.[0]) return ibc[c][0];
  }
  for (const urls of Object.values(ibc ?? {})) {
    if (urls?.[0]) return urls[0];
  }
  if (p.images?.[0]) return p.images[0];
  return ADMIN_PRODUCT_THUMB_PLACEHOLDER;
}

type RowState = Record<string, { basePrice: string; status: StoreProductStatus }>;

export default function ProductsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ category: string; status: StoreProductStatus | '' }>({
    category: '',
    status: '',
  });
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [rowDraft, setRowDraft] = useState<RowState>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void metadataService.getCategories().then((m) => {
      const opts = [...m.mainCategories];
      for (const main of m.mainCategories) {
        for (const s of m.subcategories[main] ?? []) {
          opts.push(`${main} / ${s}`);
        }
      }
      setCategoryOptions([...new Set(opts)]);
    });
  }, []);

  useEffect(() => {
    setRowDraft((prev) => {
      const next = { ...prev };
      for (const p of items) {
        if (!next[p.id]) next[p.id] = { basePrice: String(p.basePrice), status: p.status };
      }
      return next;
    });
  }, [items]);

  const loadFirst = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productService.fetchPage({
        category: filters.category || undefined,
        status: (filters.status || undefined) as StoreProductStatus | undefined,
        pageSize: 15,
        cursor: null,
      });
      setItems(res.items);
      setCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.status]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (!hasMore || !cursor) return;
    try {
      setLoadingMore(true);
      const res = await productService.fetchPage({
        category: filters.category || undefined,
        status: (filters.status || undefined) as StoreProductStatus | undefined,
        pageSize: 15,
        cursor,
      });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
    );
  }, [items, search]);

  const saveRow = async (p: StoreProduct) => {
    const draft = rowDraft[p.id] ?? { basePrice: String(p.basePrice), status: p.status };
    try {
      setSavingId(p.id);
      await productService.updateProduct(p.id, {
        basePrice: parseFloat(draft.basePrice) || 0,
        status: draft.status,
      });
      setItems((list) =>
        list.map((x) =>
          x.id === p.id
            ? { ...x, basePrice: parseFloat(draft.basePrice) || 0, status: draft.status }
            : x
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (p: StoreProduct) => {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    try {
      await productService.deleteProduct(p.id);
      setItems((list) => list.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'images' as const,
      label: '',
      width: 'w-16',
      render: (_: unknown, p: StoreProduct) => (
        <img
          src={adminProductListThumbnail(p)}
          alt=""
          className="h-12 w-12 rounded-md border border-slate-200 object-cover"
        />
      ),
    },
    {
      key: 'name' as const,
      label: 'Product',
      sortable: true,
      render: (_: unknown, p: StoreProduct) => (
        <div>
          <p className="font-medium text-slate-900">{p.name}</p>
          <p className="text-xs text-slate-500 line-clamp-1">{p.categories.join(' · ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'categories' as const,
      label: 'Categories',
      render: (cats: string[]) => (
        <div className="flex flex-wrap gap-1">
          {cats.slice(0, 3).map((c) => (
            <Badge key={c} text={c} variant="default" />
          ))}
          {cats.length > 3 && <span className="text-xs text-slate-400">+{cats.length - 3}</span>}
        </div>
      ),
    },
    {
      key: 'variants' as const,
      label: 'Total stock',
      render: (_: unknown, p: StoreProduct) => (
        <span className="font-medium">{totalVariantStock(p)}</span>
      ),
    },
    {
      key: 'basePrice' as const,
      label: 'Base price',
      render: (_: unknown, p: StoreProduct) => {
        const draft = rowDraft[p.id] ?? { basePrice: String(p.basePrice), status: p.status };
        return (
          <input
            type="number"
            className="admin-control-compact w-24 shrink-0"
            value={draft.basePrice}
            onChange={(e) =>
              setRowDraft((d) => ({
                ...d,
                [p.id]: { ...draft, basePrice: e.target.value },
              }))
            }
          />
        );
      },
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (_: unknown, p: StoreProduct) => {
        const draft = rowDraft[p.id] ?? { basePrice: String(p.basePrice), status: p.status };
        return (
          <select
            className="admin-control-compact min-w-[6.5rem] text-sm"
            value={draft.status}
            onChange={(e) =>
              setRowDraft((d) => ({
                ...d,
                [p.id]: { ...draft, status: e.target.value as StoreProductStatus },
              }))
            }
          >
            <option value="active">active</option>
            <option value="draft">draft</option>
          </select>
        );
      },
    },
    {
      key: 'salePrice' as const,
      label: 'Actions',
      render: (_: unknown, p: StoreProduct) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={savingId === p.id}
            onClick={() => void saveRow(p)}
          >
            Save row
          </Button>
          <button
            type="button"
            onClick={() => navigate(`/admin/products/${p.id}/edit`)}
            className="rounded p-1 hover:bg-slate-100"
          >
            <Edit className="h-4 w-4 text-slate-600" />
          </button>
          <button type="button" onClick={() => void remove(p)} className="rounded p-1 hover:bg-red-50">
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Products</h1>
              <p className="text-slate-600 mt-1">Catalog, pricing, and variants</p>
            </div>
            <Button onClick={() => navigate('/admin/products/new')} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add product
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FormInput
                label="Search"
                placeholder="Name, SKU, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  className="admin-control"
                >
                  <option value="">All</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, status: e.target.value as StoreProductStatus | '' }))
                  }
                  className="admin-control"
                >
                  <option value="">All</option>
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <DataTable columns={columns} data={filtered} loading={loading} />
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
