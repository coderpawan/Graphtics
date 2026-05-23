/**
 * Manage main + sub categories in `metadata/categories`.
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button, FormInput } from '../../components/shared/Components';
import { metadataService } from '../../services/metadataService';
import type { StoreCategoryMetadata } from '../../types/store';

export default function CategoriesPage() {
  const [meta, setMeta] = useState<StoreCategoryMetadata>({ mainCategories: [], subcategories: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMain, setNewMain] = useState('');
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void metadataService
      .getCategories()
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: StoreCategoryMetadata) => {
    try {
      setSaving(true);
      await metadataService.saveCategories(next);
      setMeta(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addMain = () => {
    const v = newMain.trim();
    if (!v || meta.mainCategories.includes(v)) return;
    void persist({ ...meta, mainCategories: [...meta.mainCategories, v], subcategories: { ...meta.subcategories, [v]: meta.subcategories[v] ?? [] } });
    setNewMain('');
  };

  const removeMain = (main: string) => {
    const nextSubs = { ...meta.subcategories };
    delete nextSubs[main];
    void persist({
      mainCategories: meta.mainCategories.filter((m) => m !== main),
      subcategories: nextSubs,
    });
  };

  const addSub = (main: string) => {
    const v = (subDraft[main] ?? '').trim();
    if (!v) return;
    const subs = meta.subcategories[main] ?? [];
    if (subs.includes(v)) return;
    void persist({
      ...meta,
      subcategories: { ...meta.subcategories, [main]: [...subs, v] },
    });
    setSubDraft((d) => ({ ...d, [main]: '' }));
  };

  const removeSub = (main: string, sub: string) => {
    const subs = (meta.subcategories[main] ?? []).filter((s) => s !== sub);
    void persist({ ...meta, subcategories: { ...meta.subcategories, [main]: subs } });
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="py-12 text-center text-slate-600">Loading categories…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
            <p className="mt-1 text-slate-600">Stored in Firestore document <code className="text-sm">metadata/categories</code>.</p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Add main category</h2>
            <div className="mt-3 flex gap-2">
              <FormInput value={newMain} onChange={(e) => setNewMain(e.target.value)} placeholder="e.g. Women" />
              <Button onClick={addMain} loading={saving}>
                Add
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {meta.mainCategories.map((main) => (
              <div key={main} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-slate-900">{main}</h3>
                  <Button variant="danger" size="sm" onClick={() => removeMain(main)}>
                    Remove main
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(meta.subcategories[main] ?? []).map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                    >
                      {sub}
                      <button type="button" className="text-red-600 hover:underline" onClick={() => removeSub(main, sub)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <FormInput
                    placeholder="New subcategory"
                    value={subDraft[main] ?? ''}
                    onChange={(e) => setSubDraft((d) => ({ ...d, [main]: e.target.value }))}
                  />
                  <Button variant="secondary" size="sm" onClick={() => addSub(main)} loading={saving}>
                    Add sub
                  </Button>
                </div>
              </div>
            ))}
            {meta.mainCategories.length === 0 && (
              <p className="text-sm text-slate-500">No main categories yet — add one above.</p>
            )}
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
