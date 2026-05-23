/**
 * Add / Edit product — Firestore `products` + Storage `products/{id}/...`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import {
  Button,
  FormInput,
  FormTextarea,
  Badge,
} from '../../components/shared/Components';
import { metadataService } from '../../services/metadataService';
import { productService } from '../../services/productService';
import { storageService } from '../../services/storageService';
import type { StoreCategoryMetadata, StoreProductVariant, StoreProductStatus, StoreProduct } from '../../types/store';
import type { MarketplaceLinks, Review } from '../../../types';
import { generateSKU } from '../../utils/helpers';

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** Firestore may store string (legacy) or string[] per colour. */
function normalizeImagesByColorFromDoc(
  raw: StoreProduct['imagesByColor'] | undefined
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key) continue;
    if (Array.isArray(v)) {
      const urls = v.map((x) => String(x ?? '').trim()).filter(Boolean);
      if (urls.length) out[key] = urls;
    } else if (typeof v === 'string' && v.trim()) {
      out[key] = [v.trim()];
    }
  }
  return out;
}

function mergeVariantGrid(
  sizes: string[],
  colors: string[],
  prev: StoreProductVariant[]
): StoreProductVariant[] {
  const key = (s: string, c: string) => `${s}||${c}`;
  const prevMap = new Map(prev.map((v) => [key(v.size, v.color), v]));
  const out: StoreProductVariant[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      const k = key(size, color);
      const ex = prevMap.get(k);
      if (ex) out.push({ ...ex, size, color });
      else
        out.push({
          size,
          color,
          sku: generateSKU(`${size}-${color}`),
          stock: 0,
        });
    }
  }
  return out;
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreateMode = !id;

  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<StoreCategoryMetadata | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [status, setStatus] = useState<StoreProductStatus>('draft');
  const [categories, setCategories] = useState<string[]>([]);
  /** Legacy gallery — not editable in UI; preserved on save when loaded from Firestore. */
  const [images, setImages] = useState<string[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const [selectedSizes, setSelectedSizes] = useState<string[]>(['M', 'L']);
  const [colors, setColors] = useState<string[]>(['Black', 'White']);
  /** Saved URLs per colour (carousel on storefront). */
  const [imagesByColor, setImagesByColor] = useState<Record<string, string[]>>({});
  const [defaultDisplayColor, setDefaultDisplayColor] = useState('');
  const [pendingByColor, setPendingByColor] = useState<Record<string, File[]>>({});
  /** Object URLs for pending files — revoked when `pendingByColor` changes or on unmount. */
  const [previewByColor, setPreviewByColor] = useState<Record<string, string[]>>({});
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [newColor, setNewColor] = useState('');
  const [variants, setVariants] = useState<StoreProductVariant[]>([]);
  const [safetyStockDefaultInput, setSafetyStockDefaultInput] = useState('');
  const [marketplaceLinks, setMarketplaceLinks] = useState<MarketplaceLinks>({});
  const [highlightsText, setHighlightsText] = useState('');
  const [isTrending, setIsTrending] = useState(false);
  const [flagIsNew, setFlagIsNew] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [curatedReviews, setCuratedReviews] = useState<Review[]>([]);
  const [crAuthor, setCrAuthor] = useState('');
  const [crRating, setCrRating] = useState(5);
  const [crTitle, setCrTitle] = useState('');
  const [crContent, setCrContent] = useState('');
  const [crFiles, setCrFiles] = useState<File[]>([]);
  const [crFilePreviewUrls, setCrFilePreviewUrls] = useState<string[]>([]);
  const skipMergeOnce = useRef(!!id);
  /** Tracks last `colors` so we can delete Storage files when a colour is removed from the matrix. */
  const prevColorsRef = useRef<string[] | null>(null);

  useEffect(() => {
    skipMergeOnce.current = !!id;
    prevColorsRef.current = null;
  }, [id]);

  const categoryOptions = useMemo(() => {
    if (!meta) return [];
    const opts: string[] = [...meta.mainCategories];
    for (const main of meta.mainCategories) {
      const subs = meta.subcategories[main] ?? [];
      for (const s of subs) {
        opts.push(`${main} / ${s}`);
      }
    }
    return [...new Set(opts)];
  }, [meta]);

  useEffect(() => {
    void metadataService.getCategories().then(setMeta).catch(() => setMeta({ mainCategories: [], subcategories: {} }));
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await productService.getProduct(id);
        if (cancelled) return;
        setName(p.name);
        setDescription(p.description);
        setBasePrice(p.basePrice);
        setSalePrice(p.salePrice);
        setStatus(p.status);
        setCategories(p.categories ?? []);
        setImages(p.images ?? []);
        setImagesByColor(normalizeImagesByColorFromDoc(p.imagesByColor));
        const vs = p.variants ?? [];
        setVariants(vs);
        const sizes = [...new Set(vs.map((v) => v.size))].filter(Boolean);
        const cols = [...new Set(vs.map((v) => v.color))].filter(Boolean);
        if (sizes.length) setSelectedSizes(sizes);
        if (cols.length) setColors(cols);
        const def = (p.defaultDisplayColor ?? '').trim();
        setDefaultDisplayColor(def && cols.includes(def) ? def : cols[0] ?? '');
        if (p.safetyStockDefault != null && Number.isFinite(p.safetyStockDefault)) {
          setSafetyStockDefaultInput(String(Math.floor(p.safetyStockDefault)));
        } else {
          setSafetyStockDefaultInput('');
        }
        setMarketplaceLinks({
          amazon: p.marketplaceLinks?.amazon ?? '',
          flipkart: p.marketplaceLinks?.flipkart ?? '',
          meesho: p.marketplaceLinks?.meesho ?? '',
          myntra: p.marketplaceLinks?.myntra ?? '',
        });
        setHighlightsText((p.highlights ?? []).join('\n'));
        setIsTrending(Boolean(p.isTrending));
        setFlagIsNew(Boolean(p.isNew));
        setIsLimited(Boolean(p.isLimited));
        setCuratedReviews(p.curatedReviews ?? []);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!crFiles.length) {
      setCrFilePreviewUrls([]);
      return;
    }
    const urls = crFiles.map(f => URL.createObjectURL(f));
    setCrFilePreviewUrls(urls);
    return () => {
      urls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [crFiles]);

  useEffect(() => {
    if (loading) return;
    if (skipMergeOnce.current) {
      skipMergeOnce.current = false;
      return;
    }
    setVariants((prev) => mergeVariantGrid(selectedSizes, colors, prev));
  }, [selectedSizes, colors, loading]);

  useEffect(() => {
    if (loading) return;

    const scheduleDeletes = (urls: string[]) => {
      if (!id || !urls.length) return;
      void Promise.all(
        urls.map((u) =>
          storageService.deleteProductImage(u).catch((err) => {
            console.warn('[ProductForm] storage delete', u.slice(0, 80), err);
          })
        )
      );
    };

    if (prevColorsRef.current === null) {
      prevColorsRef.current = [...colors];
      setImagesByColor((prev) => {
        const next = { ...prev };
        const orphanUrls: string[] = [];
        for (const k of Object.keys(next)) {
          if (!colors.includes(k)) {
            orphanUrls.push(...(next[k] ?? []));
            delete next[k];
          }
        }
        scheduleDeletes(orphanUrls);
        return next;
      });
    } else {
      const removed = prevColorsRef.current.filter((c) => !colors.includes(c));
      prevColorsRef.current = [...colors];
      setImagesByColor((prev) => {
        const next = { ...prev };
        const urls: string[] = [];
        for (const c of removed) {
          urls.push(...(next[c] ?? []));
          delete next[c];
        }
        for (const k of Object.keys(next)) {
          if (!colors.includes(k)) {
            urls.push(...(next[k] ?? []));
            delete next[k];
          }
        }
        scheduleDeletes(urls);
        return next;
      });
    }

    setPendingByColor((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!colors.includes(k)) delete next[k];
      }
      return next;
    });
    setDefaultDisplayColor((d) => (d && colors.includes(d) ? d : colors[0] ?? ''));
  }, [colors, loading, id]);

  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    for (const u of blobUrlsRef.current) {
      URL.revokeObjectURL(u);
    }
    blobUrlsRef.current = [];
    const next: Record<string, string[]> = {};
    for (const [color, files] of Object.entries(pendingByColor)) {
      if (!files?.length) continue;
      const arr = files.map((f) => URL.createObjectURL(f));
      next[color] = arr;
      blobUrlsRef.current.push(...arr);
    }
    setPreviewByColor(next);
    return () => {
      for (const u of blobUrlsRef.current) {
        URL.revokeObjectURL(u);
      }
      blobUrlsRef.current = [];
    };
  }, [pendingByColor]);

  const toggleSize = (s: string) => {
    setSelectedSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort(
        (a, b) => SIZE_PRESETS.indexOf(a) - SIZE_PRESETS.indexOf(b)
      )
    );
  };

  const addColor = () => {
    const c = newColor.trim();
    if (!c || colors.includes(c)) return;
    setColors((prev) => [...prev, c]);
    setNewColor('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('Name is required');
      if (!variants.length) throw new Error('Add at least one size/color combination');
      const invalidSku = variants.find((v) => !v.sku.trim());
      if (invalidSku) throw new Error('Each variant needs a SKU');

      const cleanedMarketplace: MarketplaceLinks = {};
      const linkKeys: (keyof MarketplaceLinks)[] = ['amazon', 'flipkart', 'meesho', 'myntra'];
      for (const k of linkKeys) {
        const v = (marketplaceLinks[k] ?? '').trim();
        if (v) cleanedMarketplace[k] = v;
      }
      const highlights = highlightsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const imagesByColorClean: Record<string, string[]> = {};
      for (const c of colors) {
        const arr = (imagesByColor[c] ?? []).map((u) => u.trim()).filter(Boolean);
        if (arr.length) imagesByColorClean[c] = arr;
      }

      /** Firestore rejects nested `undefined`; only include optional fields when set. */
      const variantsForFirestore: StoreProductVariant[] = variants.map((v) => {
        const row: StoreProductVariant = {
          size: v.size,
          color: v.color,
          sku: v.sku.trim(),
          stock: Math.max(0, Math.floor(v.stock)),
        };
        if (typeof v.skuId === 'string' && v.skuId.length > 0) row.skuId = v.skuId;
        if (typeof v.barcode === 'string' && v.barcode.length > 0) row.barcode = v.barcode;
        return row;
      });

      let productId = id;
      const displayColor =
        defaultDisplayColor.trim() && colors.includes(defaultDisplayColor.trim())
          ? defaultDisplayColor.trim()
          : colors[0] ?? '';

      const payload = {
        name: name.trim(),
        description: description.trim(),
        basePrice: Number(basePrice) || 0,
        salePrice: Number(salePrice) || 0,
        categories,
        images,
        status,
        variants: variantsForFirestore,
        imagesByColor: imagesByColorClean,
        defaultDisplayColor: displayColor,
        ...(safetyStockDefaultInput.trim() !== '' && Number.isFinite(Number(safetyStockDefaultInput))
          ? { safetyStockDefault: Math.max(0, Math.floor(Number(safetyStockDefaultInput))) }
          : {}),
        marketplaceLinks: cleanedMarketplace,
        highlights,
        isTrending,
        isNew: flagIsNew,
        isLimited,
        ...(id
          ? {
              curatedReviews: curatedReviews.map(r => ({
                id: r.id,
                author: r.author,
                rating: r.rating,
                title: r.title,
                content: r.content,
                date: r.date,
                source: 'admin' as const,
                images: r.images ?? [],
              })),
            }
          : {}),
      };

      if (isCreateMode) {
        const created = await productService.createProduct(
          payload as Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt'>
        );
        productId = created.id;
      } else {
        await productService.updateProduct(id!, payload);
      }

      const colorUploadList = Object.entries(pendingByColor).filter(
        ([color, files]) => Boolean(files?.length) && colors.includes(color)
      );
      if (colorUploadList.length && productId) {
        let mergedByColor = { ...imagesByColorClean };
        const totalFiles = colorUploadList.reduce((n, [, files]) => n + (files?.length ?? 0), 0);
        let doneFiles = 0;
        for (const [colorLabel, files] of colorUploadList) {
          if (!files?.length) continue;
          const existing = mergedByColor[colorLabel] ?? [];
          const newUrls: string[] = [];
          for (const file of files) {
            const v = storageService.validateFile(file);
            if (!v.valid) throw new Error(v.error);
            const variantFolder = colorLabel.replace(/[^\w.-]+/g, '_').slice(0, 48) || 'color';
            const url = await storageService.uploadProductImageWithProgress(
              productId,
              file,
              (pct) => {
                const slice = (doneFiles + pct / 100) / Math.max(1, totalFiles);
                setUploadPct(Math.round(slice * 100));
              },
              variantFolder
            );
            newUrls.push(url);
            doneFiles += 1;
          }
          mergedByColor = { ...mergedByColor, [colorLabel]: [...existing, ...newUrls] };
        }
        await productService.updateProduct(productId, { imagesByColor: mergedByColor });
        setImagesByColor(mergedByColor);
        setPendingByColor({});
        setUploadPct(null);
      }

      navigate('/admin/products');
    } catch (e) {
      if (e instanceof FirebaseError) {
        if (e.code === 'permission-denied') {
          setError('Permission denied. Check Firestore and Storage security rules for writes to products.');
        } else if (e.code === 'storage/unauthorized') {
          setError('Storage upload denied. Check Firebase Storage rules.');
        } else {
          setError(e.message);
        }
      } else {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
      setUploadPct(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-12 text-center text-slate-600">Loading product…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{isCreateMode ? 'Add product' : 'Edit product'}</h1>
              <p className="mt-1 text-slate-600">Details, colour photos, pricing, and variant matrix.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/admin/products')}>
              Cancel
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Basics</h2>
              <FormInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <FormTextarea
                label="Description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Base price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice || ''}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                />
                <FormInput
                  label="Sale price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={salePrice || ''}
                  onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StoreProductStatus)}
                  className="admin-control"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
              <p className="text-xs text-slate-500">Managed under Products → Categories; toggle labels stored on the product.</p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {categoryOptions.map((c) => {
                  const on = categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setCategories((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? 'border-violet-600 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {categoryOptions.length === 0 && (
                <p className="text-sm text-slate-500">No catalog categories yet — add some in Categories.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Storefront</h2>
            <p className="mt-1 text-sm text-slate-500">
              Badges, marketplace buttons, and bullet points under the description on the product page. Leave URLs blank to hide those buttons.
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={flagIsNew} onChange={(e) => setFlagIsNew(e.target.checked)} className="rounded border-slate-300" />
                Show &quot;New&quot; badge
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isLimited} onChange={(e) => setIsLimited(e.target.checked)} className="rounded border-slate-300" />
                Show &quot;Limited&quot; badge
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isTrending} onChange={(e) => setIsTrending(e.target.checked)} className="rounded border-slate-300" />
                Mark as trending (for catalog use)
              </label>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Amazon link"
                type="text"
                placeholder="https://..."
                value={marketplaceLinks.amazon ?? ''}
                onChange={(e) => setMarketplaceLinks((prev) => ({ ...prev, amazon: e.target.value }))}
              />
              <FormInput
                label="Flipkart link"
                type="text"
                placeholder="https://..."
                value={marketplaceLinks.flipkart ?? ''}
                onChange={(e) => setMarketplaceLinks((prev) => ({ ...prev, flipkart: e.target.value }))}
              />
              <FormInput
                label="Meesho link"
                type="text"
                placeholder="https://..."
                value={marketplaceLinks.meesho ?? ''}
                onChange={(e) => setMarketplaceLinks((prev) => ({ ...prev, meesho: e.target.value }))}
              />
              <FormInput
                label="Myntra link"
                type="text"
                placeholder="https://..."
                value={marketplaceLinks.myntra ?? ''}
                onChange={(e) => setMarketplaceLinks((prev) => ({ ...prev, myntra: e.target.value }))}
              />
            </div>
            <FormTextarea
              className="mt-4"
              label="Product highlights (one line per bullet)"
              rows={4}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              placeholder={'Premium fabric\nDesigned for comfort'}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Colour photos and default listing</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add one or more images for each colour (carousel on the product page). Choose the default colour for shop
              cards and the product page. Click any thumbnail to enlarge. New files upload when you save.
            </p>
            {uploadPct !== null && (
              <div className="mt-4 w-full max-w-md">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{uploadPct}%</p>
              </div>
            )}
            <div className="mt-6 space-y-8">
              {colors.map((color) => {
                const serverUrls = imagesByColor[color] ?? [];
                const blobUrls = previewByColor[color] ?? [];
                const displayUrls = [...serverUrls, ...blobUrls];
                return (
                  <div
                    key={color}
                    className="rounded-lg border border-slate-100 bg-slate-50/90 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-medium text-slate-900">{color}</p>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="defaultDisplayColor"
                          checked={defaultDisplayColor === color}
                          onChange={() => setDefaultDisplayColor(color)}
                          className="border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        Default on storefront
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {displayUrls.length === 0 ? (
                        <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center text-xs text-slate-400">
                          No images yet
                        </div>
                      ) : (
                        displayUrls.map((url, idx) => (
                          <div key={`${color}-${url}-${idx}`} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                            <button
                              type="button"
                              className="block h-full w-full"
                              onClick={() => setLightbox({ urls: displayUrls, index: idx })}
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                            <button
                              type="button"
                              className="absolute right-0 top-0 rounded-bl bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                              title="Remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                void (async () => {
                                  if (idx < serverUrls.length) {
                                    const url = serverUrls[idx];
                                    if (id) {
                                      try {
                                        await storageService.deleteProductImage(url);
                                      } catch (err) {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Failed to delete image from storage'
                                        );
                                        return;
                                      }
                                    }
                                    setImagesByColor((prev) => ({
                                      ...prev,
                                      [color]: (prev[color] ?? []).filter((_, i) => i !== idx),
                                    }));
                                  } else {
                                    const pi = idx - serverUrls.length;
                                    setPendingByColor((prev) => ({
                                      ...prev,
                                      [color]: (prev[color] ?? []).filter((_, i) => i !== pi),
                                    }));
                                  }
                                })();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="max-w-full text-xs text-slate-800 file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-white hover:file:bg-violet-700"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (!files.length) return;
                          setPendingByColor((prev) => ({
                            ...prev,
                            [color]: [...(prev[color] ?? []), ...files],
                          }));
                          e.target.value = '';
                        }}
                      />
                      {(serverUrls.length > 0 || (pendingByColor[color]?.length ?? 0) > 0) && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => {
                            void (async () => {
                              if (id && serverUrls.length) {
                                for (const u of serverUrls) {
                                  try {
                                    await storageService.deleteProductImage(u);
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Failed to delete images from storage'
                                    );
                                    return;
                                  }
                                }
                              }
                              setImagesByColor((prev) => {
                                const next = { ...prev };
                                delete next[color];
                                return next;
                              });
                              setPendingByColor((prev) => {
                                const next = { ...prev };
                                delete next[color];
                                return next;
                              });
                            })();
                          }}
                        >
                          Clear all for this colour
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Variant matrix</h2>
            <p className="text-sm text-slate-500">Pick sizes and colors — rows are generated for SKU & stock.</p>
            <FormInput
              label="Low-stock threshold for this product (optional)"
              type="number"
              min={0}
              className="mt-4 max-w-xs"
              value={safetyStockDefaultInput}
              onChange={(e) => setSafetyStockDefaultInput(e.target.value)}
              placeholder="Leave blank to auto-calculate on SKU sync"
            />
            <p className="mt-1 text-xs text-slate-500">
              When set, applies to all SKUs on sync. Otherwise each SKU uses 15% of average variant stock (min 1, max 500).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`rounded-md border px-3 py-1 text-sm font-medium ${
                    selectedSizes.includes(s)
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <Badge key={c} text={c} variant="default" />
                ))}
              </div>
              <div className="flex gap-2">
                <FormInput label="New color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                <Button type="button" variant="secondary" className="mb-4" onClick={addColor}>
                  Add color
                </Button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-2">Size</th>
                    <th className="py-2 pr-2">Color</th>
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, idx) => (
                    <tr key={`${v.size}-${v.color}`} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{v.size}</td>
                      <td className="py-2 pr-2">{v.color}</td>
                      <td className="py-2 pr-2">
                        <input
                          className="admin-control-compact w-full min-w-0 max-w-[220px]"
                          value={v.sku}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) => prev.map((row, i) => (i === idx ? { ...row, sku: val } : row)));
                          }}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0}
                          className="admin-control-compact w-24 shrink-0"
                          value={v.stock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setVariants((prev) => prev.map((row, i) => (i === idx ? { ...row, stock: val } : row)));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!isCreateMode ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Curated storefront reviews</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add manual reviews with optional images. Set the customer name as it should appear on the storefront.
                Shoppers who bought the item can add text-only reviews from their account after delivery.
              </p>
              <ul className="mt-4 space-y-3">
                {curatedReviews.map(r => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-slate-900">{r.author}</span>
                      <span className="ml-2 text-amber-700">{r.rating}★</span>
                      {r.title ? <span className="ml-2 text-violet-800">{r.title}</span> : null}
                      <p className="mt-1 text-slate-700">{r.content}</p>
                      {r.images && r.images.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {r.images.map((url, imgIdx) => (
                            <button
                              key={`${r.id}-thumb-${imgIdx}`}
                              type="button"
                              className="overflow-hidden rounded-md border border-slate-200 p-0 shadow-sm transition hover:border-violet-400"
                              onClick={() => setLightbox({ urls: r.images!, index: imgIdx })}
                              aria-label="View review photo larger"
                            >
                              <img src={url} alt="" className="h-16 w-16 object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        void (async () => {
                          if (!id) return;
                          const next = curatedReviews.filter(x => x.id !== r.id);
                          setCuratedReviews(next);
                          try {
                            await productService.updateProduct(id, { curatedReviews: next });
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Could not remove review');
                          }
                        })()
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Customer name (storefront)"
                  placeholder="e.g. Priya Sharma"
                  value={crAuthor}
                  onChange={e => setCrAuthor(e.target.value)}
                />
                <FormInput
                  label="Rating (1–5)"
                  type="number"
                  min={1}
                  max={5}
                  value={crRating}
                  onChange={e => setCrRating(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
                <FormInput className="sm:col-span-2" label="Title (optional)" value={crTitle} onChange={e => setCrTitle(e.target.value)} />
                <FormTextarea
                  className="sm:col-span-2"
                  label="Review text"
                  rows={3}
                  value={crContent}
                  onChange={e => setCrContent(e.target.value)}
                />
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Photos (optional)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="text-sm text-slate-600"
                    onChange={e => setCrFiles(Array.from(e.target.files ?? []))}
                  />
                  {crFilePreviewUrls.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {crFilePreviewUrls.map((url, i) => (
                        <img
                          key={`${url}-${i}`}
                          src={url}
                          alt=""
                          className="h-20 w-20 rounded-lg border border-slate-200 object-cover shadow-sm"
                        />
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">Preview updates as you pick files, before you save the review.</p>
                </div>
              </div>
              <Button
                type="button"
                className="mt-4"
                onClick={() =>
                  void (async () => {
                    try {
                      setError(null);
                      if (!id) return;
                      if (!crContent.trim()) {
                        setError('Review text is required');
                        return;
                      }
                      const urls: string[] = [];
                      for (const f of crFiles) {
                        const v = storageService.validateFile(f);
                        if (!v.valid) throw new Error(v.error);
                        urls.push(await storageService.uploadProductReviewPhoto(id, f));
                      }
                      const entry: Review = {
                        id: `cur-${Date.now()}`,
                        author: crAuthor.trim() || 'Verified shopper',
                        rating: Math.min(5, Math.max(1, Math.round(Number(crRating)))),
                        title: crTitle.trim(),
                        content: crContent.trim(),
                        date: new Date().toISOString(),
                        source: 'admin',
                        ...(urls.length ? { images: urls } : {}),
                      };
                      const next = [...curatedReviews, entry];
                      setCuratedReviews(next);
                      setCrTitle('');
                      setCrContent('');
                      setCrFiles([]);
                      setCrRating(5);
                      await productService.updateProduct(id, { curatedReviews: next });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Could not add review');
                    }
                  })()
                }
              >
                Add review to storefront
              </Button>
            </div>
          ) : null}

          {lightbox && lightbox.urls.length > 0 && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={() => setLightbox(null)}
            >
              <div
                className="relative flex max-h-[95vh] max-w-5xl flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="absolute -right-1 -top-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                  onClick={() => setLightbox(null)}
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
                <img
                  src={lightbox.urls[lightbox.index]}
                  alt=""
                  className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
                />
                {lightbox.urls.length > 1 && (
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-slate-900/90 p-2 text-white transition hover:bg-slate-800"
                      aria-label="Previous"
                      onClick={() =>
                        setLightbox((lb) =>
                          lb
                            ? {
                                ...lb,
                                index: (lb.index - 1 + lb.urls.length) % lb.urls.length,
                              }
                            : lb
                        )
                      }
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <span className="text-sm text-slate-200">
                      {lightbox.index + 1} / {lightbox.urls.length}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-slate-900/90 p-2 text-white transition hover:bg-slate-800"
                      aria-label="Next"
                      onClick={() =>
                        setLightbox((lb) =>
                          lb ? { ...lb, index: (lb.index + 1) % lb.urls.length } : lb
                        )
                      }
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="secondary" onClick={() => navigate('/admin/products')}>
              Back to list
            </Button>
            <Button type="button" loading={saving} onClick={() => void save()}>
              {isCreateMode ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
