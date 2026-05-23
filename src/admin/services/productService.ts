/**
 * Admin Product Service — Firestore `products` collection (clothing schema).
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { MarketplaceLinks, Review } from '../../types';
import type { StoreProduct, StoreProductStatus, StoreProductVariant, VariantInventoryRow } from '../types/store';
import { skuInventoryService } from './skuInventoryService';

const COLLECTION = 'products';

export interface ProductPageOptions {
  status?: StoreProductStatus | '';
  /** Any category label stored on the product `categories` array */
  category?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot | null;
}

export interface ProductPageResult {
  items: StoreProduct[];
  /** Pass to `cursor` for the next page */
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/** Firestore rejects `undefined` field values */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function isPlainRecord(value: object): boolean {
  return Object.getPrototypeOf(value) === Object.prototype;
}

/** Removes `undefined` at any depth (Firestore disallows them). Skips non-plain objects (Timestamp, FieldValue, etc.). */
function stripUndefinedDeep<T>(input: T): T {
  if (input === null || typeof input !== 'object') return input;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) return input.map((x) => stripUndefinedDeep(x)) as T;
  if (!isPlainRecord(input as object)) return input;

  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object') {
      if (v instanceof Date) out[k] = v;
      else if (Array.isArray(v)) out[k] = stripUndefinedDeep(v);
      else if (isPlainRecord(v)) out[k] = stripUndefinedDeep(v);
      else out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function parseMarketplaceLinksDoc(data: Record<string, unknown>): MarketplaceLinks | undefined {
  const m = data.marketplaceLinks;
  if (!m || typeof m !== 'object') return undefined;
  const o = m as Record<string, unknown>;
  const pick = (k: string) => {
    const s = typeof o[k] === 'string' ? o[k].trim() : '';
    return s.length > 0 ? s : undefined;
  };
  const out: MarketplaceLinks = {
    amazon: pick('amazon'),
    flipkart: pick('flipkart'),
    meesho: pick('meesho'),
    myntra: pick('myntra'),
  };
  return out.amazon || out.flipkart || out.meesho || out.myntra ? out : undefined;
}

function mapCuratedReviews(raw: unknown): Review[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: Review[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const images = Array.isArray(o.images)
      ? o.images.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    out.push({
      id: String(o.id ?? `cur-${out.length}`),
      author: String(o.author ?? 'Graphtics'),
      rating: Math.min(5, Math.max(1, Number(o.rating ?? 5))),
      title: String(o.title ?? ''),
      content: String(o.content ?? ''),
      date: String(o.date ?? new Date().toISOString()),
      source: 'admin',
      ...(images.length ? { images } : {}),
    });
  }
  return out.length ? out : undefined;
}

function mapProductDoc(d: QueryDocumentSnapshot): StoreProduct {
  const data = d.data();
  const curatedReviews = mapCuratedReviews(data.curatedReviews);
  const imagesByColorParsed =
    data.imagesByColor && typeof data.imagesByColor === 'object' && !Array.isArray(data.imagesByColor)
      ? (() => {
          const raw = data.imagesByColor as Record<string, unknown>;
          const out: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(raw)) {
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
        })()
      : {};
  const imagesByColor =
    Object.keys(imagesByColorParsed).length > 0 ? imagesByColorParsed : undefined;
  return {
    id: d.id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    basePrice: Number(data.basePrice ?? 0),
    salePrice: Number(data.salePrice ?? 0),
    categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
    images: Array.isArray(data.images) ? data.images.map(String) : [],
    imagesByColor,
    defaultDisplayColor:
      typeof data.defaultDisplayColor === 'string' && String(data.defaultDisplayColor).trim().length > 0
        ? String(data.defaultDisplayColor).trim()
        : undefined,
    status: (data.status === 'draft' ? 'draft' : 'active') as StoreProductStatus,
    variants: Array.isArray(data.variants)
      ? data.variants.map((v: Record<string, unknown>) => {
          const row: StoreProductVariant = {
            size: String(v.size ?? ''),
            color: String(v.color ?? ''),
            sku: String(v.sku ?? ''),
            stock: Number(v.stock ?? 0),
          };
          if (typeof v.skuId === 'string' && v.skuId.length > 0) row.skuId = v.skuId;
          if (typeof v.barcode === 'string' && v.barcode.length > 0) row.barcode = v.barcode;
          return row;
        })
      : [],
    safetyStockDefault:
      typeof data.safetyStockDefault === 'number' && Number.isFinite(data.safetyStockDefault)
        ? data.safetyStockDefault
        : undefined,
    marketplaceLinks: parseMarketplaceLinksDoc(data as Record<string, unknown>),
    highlights: Array.isArray(data.highlights) ? data.highlights.map(String).filter(Boolean) : undefined,
    isTrending: Boolean(data.isTrending),
    isNew: Boolean(data.isNew),
    isLimited: Boolean(data.isLimited),
    ...(curatedReviews ? { curatedReviews } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function totalVariantStock(product: StoreProduct): number {
  return product.variants.reduce((sum, v) => sum + (Number.isFinite(v.stock) ? v.stock : 0), 0);
}

function buildProductQuery(opts: ProductPageOptions): QueryConstraint[] {
  const pageSize = opts.pageSize ?? 20;
  const constraints: QueryConstraint[] = [];

  if (opts.status && opts.category) {
    constraints.push(where('status', '==', opts.status));
    constraints.push(where('categories', 'array-contains', opts.category));
    constraints.push(orderBy('createdAt', 'desc'));
  } else if (opts.status) {
    constraints.push(where('status', '==', opts.status));
    constraints.push(orderBy('createdAt', 'desc'));
  } else if (opts.category) {
    constraints.push(where('categories', 'array-contains', opts.category));
    constraints.push(orderBy('createdAt', 'desc'));
  } else {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  if (opts.cursor) {
    constraints.push(startAfter(opts.cursor));
  }
  constraints.push(limit(pageSize + 1));
  void pageSize;
  return constraints;
}

export const productService = {
  async fetchPage(opts: ProductPageOptions = {}): Promise<ProductPageResult> {
    const pageSize = opts.pageSize ?? 20;
    const constraints = buildProductQuery({ ...opts, pageSize });
    const q = query(collection(db, COLLECTION), ...constraints);
    const snap = await getDocs(q);
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
    return {
      items: docs.map(mapProductDoc),
      lastDoc,
      hasMore,
    };
  },

  async getProduct(productId: string): Promise<StoreProduct> {
    const ref = doc(db, COLLECTION, productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Product not found');
    }
    return mapProductDoc(snap as QueryDocumentSnapshot);
  },

  async createProduct(
    data: Omit<StoreProduct, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoreProduct> {
    const payload = stripUndefined({
      ...(stripUndefinedDeep(data) as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, COLLECTION), payload);
    try {
      await skuInventoryService.syncSkusForProduct(ref.id);
    } catch (e) {
      console.warn('[products] SKU sync after create', e);
    }
    return this.getProduct(ref.id);
  },

  async updateProduct(productId: string, patch: Partial<StoreProduct>): Promise<void> {
    const ref = doc(db, COLLECTION, productId);
    const { id: _id, createdAt: _c, ...rest } = patch as StoreProduct;
    const cleaned = stripUndefinedDeep(rest) as Record<string, unknown>;
    await updateDoc(
      ref,
      stripUndefined({
        ...cleaned,
        updatedAt: serverTimestamp(),
      })
    );
    try {
      await skuInventoryService.syncSkusForProduct(productId);
    } catch (e) {
      console.warn('[products] SKU sync after update', e);
    }
  },

  async deleteProduct(productId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, productId));
  },

  async updateVariantStock(productId: string, sku: string, nextStock: number): Promise<void> {
    const ref = doc(db, COLLECTION, productId);
    const snap = await getDoc(ref);
    const variants = (snap.data()?.variants as StoreProductVariant[] | undefined) ?? [];
    const row = variants.find((v) => v.sku === sku);
    const target = Math.max(0, Math.floor(nextStock));
    if (row?.skuId && !row.skuId.startsWith('__pending__')) {
      const skuRef = doc(db, COLLECTION, productId, 'skus', row.skuId);
      const skuSnap = await getDoc(skuRef);
      if (skuSnap.exists()) {
        const cur = Number((skuSnap.data() as { onHand?: number }).onHand ?? 0);
        const delta = target - cur;
        if (delta !== 0) {
          await skuInventoryService.applyStockAdjustment({
            productId,
            skuId: row.skuId,
            deltaOnHand: delta,
            reasonCode: 'MANUAL_ADJUSTMENT',
            notes: 'Legacy variant stock update',
            userId: 'system',
            source: 'system',
          });
        }
        return;
      }
    }
    const next = variants.map((v) => (v.sku === sku ? { ...v, stock: target } : v));
    await updateDoc(ref, {
      variants: next,
      updatedAt: serverTimestamp(),
    });
    try {
      await skuInventoryService.syncSkusForProduct(productId);
    } catch (e) {
      console.warn('[products] SKU sync after variant stock', e);
    }
  },

  async fetchVariantInventoryPage(opts: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot | null;
  }): Promise<{
    rows: VariantInventoryRow[];
    lastProductDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;
  }> {
    const pageSize = opts.pageSize ?? 25;
    const constraints: QueryConstraint[] = [orderBy('name', 'asc')];
    if (opts.cursor) constraints.push(startAfter(opts.cursor));
    constraints.push(limit(pageSize + 1));
    const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const rows: VariantInventoryRow[] = [];
    for (const d of docs) {
      const p = mapProductDoc(d);
      for (const v of p.variants) {
        rows.push({
          id: `${p.id}__${v.sku}`,
          productId: p.id,
          productName: p.name,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
        });
      }
    }
    return {
      rows,
      lastProductDoc: docs.length ? docs[docs.length - 1] : null,
      hasMore,
    };
  },

  async listLowStockVariants(maxProducts = 200, threshold = 10): Promise<VariantInventoryRow[]> {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('name', 'asc'), limit(maxProducts)));
    const rows: VariantInventoryRow[] = [];
    for (const d of snap.docs) {
      const p = mapProductDoc(d);
      for (const v of p.variants) {
        if (v.stock <= threshold) {
          rows.push({
            id: `${p.id}__${v.sku}`,
            productId: p.id,
            productName: p.name,
            sku: v.sku,
            size: v.size,
            color: v.color,
            stock: v.stock,
          });
        }
      }
    }
    return rows.sort((a, b) => a.stock - b.stock);
  },

  async countOutOfStockSkus(): Promise<number> {
    const snap = await getDocs(query(collection(db, COLLECTION), limit(500)));
    let count = 0;
    for (const d of snap.docs) {
      const p = mapProductDoc(d);
      for (const v of p.variants) {
        if (v.stock <= 0) count += 1;
      }
    }
    return count;
  },
};
