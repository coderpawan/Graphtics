/**
 * SKU subcollection + stock ledger — transactional inventory for clothing variants.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  buildVariantKey,
  computeDerivedStockFields,
  deriveDefaultSafetyStock,
  isStockReasonCode,
  type StockReasonCode,
} from '../../lib/inventorySkuCore';
import type {
  InventoryMatrixProduct,
  ProductSkuDoc,
  StockLedgerEntry,
  StoreProductVariant,
} from '../types/store';

const PRODUCTS = 'products';
const SKUS = 'skus';
const LEDGER = 'stockLedger';

function resolveSafetyStockForSku(
  productRaw: Record<string, unknown>,
  existingSkuData: Record<string, unknown> | undefined,
  totalUnitsAcrossVariants: number,
  variantCount: number
): number {
  const explicit = Number(productRaw.safetyStockDefault);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  if (existingSkuData) {
    const prev = Number(existingSkuData.safetyStock);
    if (Number.isFinite(prev) && prev >= 0) return Math.floor(prev);
  }
  return deriveDefaultSafetyStock(totalUnitsAcrossVariants, Math.max(1, variantCount));
}

/** Loads all SKU docs for a product (no server-side orderBy — avoids empty reads if ordering is inconsistent). */
async function loadSortedSkus(productId: string): Promise<ProductSkuDoc[]> {
  const skuSnap = await getDocs(collection(db, PRODUCTS, productId, SKUS));
  return skuSnap.docs
    .map((sd) => mapSkuDoc(productId, sd as QueryDocumentSnapshot))
    .sort((a, b) => a.skuCode.localeCompare(b.skuCode, undefined, { sensitivity: 'base' }));
}

function mapSkuDoc(productId: string, d: QueryDocumentSnapshot): ProductSkuDoc {
  const x = d.data() as Record<string, unknown>;
  const attrs = x.attributes && typeof x.attributes === 'object' ? (x.attributes as Record<string, string>) : {};
  const onHand = Number(x.onHand ?? 0);
  const safetyRaw = Number(x.safetyStock);
  const safetyStock =
    Number.isFinite(safetyRaw) && safetyRaw >= 0
      ? Math.floor(safetyRaw)
      : deriveDefaultSafetyStock(Math.max(0, Math.floor(onHand)), 1);
  return {
    id: d.id,
    productId: String(x.productId ?? productId),
    productName: String(x.productName ?? ''),
    categories: Array.isArray(x.categories) ? x.categories.map(String) : [],
    skuCode: String(x.skuCode ?? ''),
    barcode: String(x.barcode ?? ''),
    variantKey: String(x.variantKey ?? ''),
    attributes: attrs,
    onHand,
    reserved: Number(x.reserved ?? 0),
    available: Number(x.available ?? 0),
    safetyStock,
    stockStatus: (['low_stock', 'out_of_stock'].includes(String(x.stockStatus))
      ? x.stockStatus
      : 'in_stock') as ProductSkuDoc['stockStatus'],
    isLowStock: Boolean(x.isLowStock),
    version: Number(x.version ?? 0),
    status: x.status === 'discontinued' ? 'discontinued' : 'active',
    createdAt: x.createdAt as ProductSkuDoc['createdAt'],
    updatedAt: x.updatedAt as ProductSkuDoc['updatedAt'],
  };
}

/** Parse `buildVariantKey` strings like `color=Black|size=M` into a map. */
function parseVariantKeyAttrs(variantKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  const key = variantKey.trim();
  if (!key) return out;
  for (const part of key.split('|')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function pickAttr(parsed: Record<string, string>, ...keys: string[]): string {
  const lowerMap = new Map(Object.entries(parsed).map(([k, v]) => [k.toLowerCase(), v.trim()]));
  for (const want of keys) {
    const hit = lowerMap.get(want.toLowerCase());
    if (hit) return hit;
  }
  return '';
}

/**
 * Matrix rows/columns use `attributes.size` and `attributes.color`. Some SKU docs omit them; recover
 * from `variantKey` or stable fallbacks so the grid is never empty.
 */
function normalizeSkuForMatrix(s: ProductSkuDoc): ProductSkuDoc {
  const a = { ...s.attributes };
  let size = String(a.size ?? '').trim();
  let color = String(a.color ?? '').trim();
  if (!size || !color) {
    const parsed = s.variantKey ? parseVariantKeyAttrs(s.variantKey) : {};
    if (!size) size = pickAttr(parsed, 'size', 'sizes');
    if (!color) color = pickAttr(parsed, 'color', 'colour', 'fabric');
  }
  if (!size && !color) {
    size = 'All';
    color = (s.skuCode || s.variantKey || s.id || 'SKU').trim() || 'SKU';
  } else if (!size) {
    size = 'All';
  } else if (!color) {
    color = 'Default';
  }
  return { ...s, attributes: { ...a, size, color } };
}

function mirrorVariantStocks(variants: StoreProductVariant[], skuId: string, nextOnHand: number): StoreProductVariant[] {
  return variants.map((v) => (v.skuId === skuId ? { ...v, stock: Math.max(0, Math.floor(nextOnHand)) } : v));
}

function mirrorVariantStocksBySkuCode(variants: StoreProductVariant[], skuCode: string, nextOnHand: number): StoreProductVariant[] {
  const code = skuCode.trim();
  return variants.map((v) => (v.sku.trim() === code ? { ...v, stock: Math.max(0, Math.floor(nextOnHand)) } : v));
}

/**
 * Firestore rejects `undefined` anywhere in update payloads. Variant rows built in JS often
 * carry `skuId` / `barcode` as explicit `undefined` after object spread — strip those keys.
 */
function storeVariantsToFirestorePayload(variants: StoreProductVariant[]): Record<string, unknown>[] {
  return variants.map((v) => {
    const row: Record<string, unknown> = {
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      sku: String(v.sku ?? ''),
      stock: Math.max(0, Math.floor(Number(v.stock ?? 0))),
    };
    if (typeof v.skuId === 'string' && v.skuId.length > 0) row.skuId = v.skuId;
    if (typeof v.barcode === 'string' && v.barcode.trim().length > 0) row.barcode = v.barcode.trim();
    return row;
  });
}

export interface ApplyStockAdjustmentInput {
  productId: string;
  skuId: string;
  /** Signed change to on-hand (negative removes stock). */
  deltaOnHand: number;
  reasonCode: StockReasonCode;
  notes: string;
  userId: string;
  source?: StockLedgerEntry['source'];
  bulkJobId?: string;
}

export interface BulkStockLine {
  productId: string;
  skuId: string;
  deltaOnHand: number;
}

export const skuInventoryService = {
  skusCollection(productId: string) {
    return collection(db, PRODUCTS, productId, SKUS);
  },

  async listSkusForProduct(productId: string): Promise<ProductSkuDoc[]> {
    return loadSortedSkus(productId);
  },

  /**
   * Ensures every product variant has a matching SKU doc + `skuId` on the parent variant row.
   * Pushes current `variant.stock` onto `sku.onHand` (catalog form is source when syncing).
   */
  async syncSkusForProduct(productId: string): Promise<ProductSkuDoc[]> {
    const productRef = doc(db, PRODUCTS, productId);
    const pSnap = await getDoc(productRef);
    if (!pSnap.exists()) throw new Error('Product not found');
    const raw = pSnap.data() as Record<string, unknown>;
    const name = String(raw.name ?? '');
    const categories = Array.isArray(raw.categories) ? raw.categories.map(String) : [];
    const variants = (Array.isArray(raw.variants) ? raw.variants : []) as Record<string, unknown>[];

    const skuSnap = await getDocs(collection(db, PRODUCTS, productId, SKUS));
    const byVariantKey = new Map<string, { id: string; data: Record<string, unknown> }>();
    for (const d of skuSnap.docs) {
      const vk = String(d.data().variantKey ?? '');
      if (vk) byVariantKey.set(vk, { id: d.id, data: d.data() as Record<string, unknown> });
    }

    const nextVariants: StoreProductVariant[] = variants.map((v) => ({
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      sku: String(v.sku ?? ''),
      stock: Math.max(0, Math.floor(Number(v.stock ?? 0))),
      skuId: typeof v.skuId === 'string' ? v.skuId : undefined,
      barcode: typeof v.barcode === 'string' ? v.barcode : undefined,
    }));

    const totalUnitsAll = nextVariants.reduce((sum, v) => sum + v.stock, 0);
    const variantCount = Math.max(1, nextVariants.length);

    const batch = writeBatch(db);

    for (let i = 0; i < nextVariants.length; i++) {
      const v = nextVariants[i];
      const variantKey = buildVariantKey({ size: v.size.trim(), color: v.color.trim() });
      const existing = byVariantKey.get(variantKey);
      const skuRef = existing
        ? doc(db, PRODUCTS, productId, SKUS, existing.id)
        : doc(collection(db, PRODUCTS, productId, SKUS));
      const skuId = skuRef.id;

      const onHand = v.stock;
      const reserved = existing ? Number(existing.data.reserved ?? 0) : 0;
      const safetyStock = resolveSafetyStockForSku(raw, existing?.data, totalUnitsAll, variantCount);
      const { available, stockStatus, isLowStock } = computeDerivedStockFields(onHand, reserved, safetyStock);

      batch.set(
        skuRef,
        {
          productId,
          productName: name,
          categories,
          skuCode: v.sku.trim(),
          barcode: (v.barcode ?? '').trim(),
          variantKey,
          attributes: { size: v.size.trim(), color: v.color.trim() },
          onHand,
          reserved,
          available,
          safetyStock,
          stockStatus,
          isLowStock,
          version: existing ? Number(existing.data.version ?? 0) : 0,
          status: 'active',
          updatedAt: serverTimestamp(),
          ...(existing ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      nextVariants[i] = { ...v, skuId };
    }

    batch.update(productRef, {
      variants: storeVariantsToFirestorePayload(nextVariants),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return loadSortedSkus(productId);
  },

  async applyStockAdjustment(input: ApplyStockAdjustmentInput): Promise<void> {
    const {
      productId,
      skuId,
      deltaOnHand,
      reasonCode,
      notes,
      userId,
      source = 'admin_ui',
      bulkJobId,
    } = input;
    if (!Number.isFinite(deltaOnHand) || deltaOnHand === 0) {
      throw new Error('Quantity change must be a non-zero number');
    }
    if (!isStockReasonCode(reasonCode)) throw new Error('Invalid reason code');

    const skuRef = doc(db, PRODUCTS, productId, SKUS, skuId);
    const productRef = doc(db, PRODUCTS, productId);
    const ledgerRef = doc(collection(db, LEDGER));

    await runTransaction(db, async (tx) => {
      const [skuSnap, productSnap] = await Promise.all([tx.get(skuRef), tx.get(productRef)]);
      if (!skuSnap.exists()) throw new Error('SKU not found');
      if (!productSnap.exists()) throw new Error('Product not found');

      const s = skuSnap.data() as Record<string, unknown>;
      const onHand = Number(s.onHand ?? 0);
      const reserved = Number(s.reserved ?? 0);
      const safetyRaw = Number(s.safetyStock);
      const safetyStock =
        Number.isFinite(safetyRaw) && safetyRaw >= 0
          ? Math.floor(safetyRaw)
          : deriveDefaultSafetyStock(Math.max(0, Math.floor(onHand)), 1);
      const version = Number(s.version ?? 0);
      const skuCode = String(s.skuCode ?? '');

      const nextOnHand = Math.max(0, Math.floor(onHand + deltaOnHand));
      const { available, stockStatus, isLowStock } = computeDerivedStockFields(nextOnHand, reserved, safetyStock);

      const rawVariants = (productSnap.data() as Record<string, unknown>).variants;
      const variants = (Array.isArray(rawVariants) ? rawVariants : []) as StoreProductVariant[];
      const nextVariants = mirrorVariantStocks(variants, skuId, nextOnHand);
      if (JSON.stringify(nextVariants) === JSON.stringify(variants)) {
        const byCode = mirrorVariantStocksBySkuCode(variants, skuCode, nextOnHand);
        tx.update(productRef, {
          variants: storeVariantsToFirestorePayload(byCode),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(productRef, {
          variants: storeVariantsToFirestorePayload(nextVariants),
          updatedAt: serverTimestamp(),
        });
      }

      tx.update(skuRef, {
        onHand: nextOnHand,
        available,
        stockStatus,
        isLowStock,
        version: version + 1,
        updatedAt: serverTimestamp(),
      });

      tx.set(ledgerRef, {
        timestamp: serverTimestamp(),
        userId,
        productId,
        skuId,
        skuCode,
        reasonCode,
        deltaOnHand,
        balanceOnHandAfter: nextOnHand,
        balanceAvailableAfter: available,
        versionAfter: version + 1,
        notes: notes.trim(),
        source,
        ...(bulkJobId ? { bulkJobId } : {}),
      });
    });
  },

  async applyBulkAdjustments(
    lines: BulkStockLine[],
    reasonCode: StockReasonCode,
    notes: string,
    userId: string
  ): Promise<void> {
    const bulkJobId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    for (const line of lines) {
      await this.applyStockAdjustment({
        productId: line.productId,
        skuId: line.skuId,
        deltaOnHand: line.deltaOnHand,
        reasonCode,
        notes,
        userId,
        bulkJobId,
      });
    }
  },

  async updateSkuPricingStatus(
    productId: string,
    skuId: string,
    patch: { priceOverride?: number | null; status?: 'active' | 'discontinued' }
  ): Promise<void> {
    const skuRef = doc(db, PRODUCTS, productId, SKUS, skuId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(skuRef);
      if (!snap.exists()) throw new Error('SKU not found');
      const u: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.status) u.status = patch.status;
      if (patch.priceOverride === null) u.priceOverride = null;
      else if (typeof patch.priceOverride === 'number' && Number.isFinite(patch.priceOverride)) {
        u.priceOverride = patch.priceOverride;
      }
      tx.update(skuRef, u);
    });
  },

  async fetchInventoryMatrixPage(opts: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot | null;
  }): Promise<{ products: InventoryMatrixProduct[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
    const pageSize = opts.pageSize ?? 12;
    const constraints: QueryConstraint[] = [orderBy('name', 'asc')];
    if (opts.cursor) constraints.push(startAfter(opts.cursor));
    constraints.push(limit(pageSize + 1));

    const snap = await getDocs(query(collection(db, PRODUCTS), ...constraints));
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const blocks: InventoryMatrixProduct[] = [];
    for (const d of docs) {
      try {
        const raw = d.data() as Record<string, unknown>;
        if (raw.status === 'draft') continue;
        const productId = d.id;
        const productName = String(raw.name ?? '');
        const categories = Array.isArray(raw.categories) ? raw.categories.map(String) : [];
        const variantRows = Array.isArray(raw.variants) ? (raw.variants as Record<string, unknown>[]) : [];

        let skus = await loadSortedSkus(productId);

        if (!skus.length && variantRows.length > 0) {
          try {
            await this.syncSkusForProduct(productId);
            skus = await loadSortedSkus(productId);
          } catch (syncErr) {
            console.warn('[fetchInventoryMatrixPage] SKU sync skipped', productId, syncErr);
          }
        }

        if (!skus.length && variantRows.length > 0) {
          const vs = variantRows;
          const totalForProduct = vs.reduce(
            (s, row) => s + Math.max(0, Math.floor(Number((row as { stock?: unknown }).stock ?? 0))),
            0
          );
          const nVs = Math.max(1, vs.length);
          skus = vs.map((v, idx) => {
            const size = String(v.size ?? '');
            const color = String(v.color ?? '');
            const vk = buildVariantKey({ size, color });
            const onHand = Math.max(0, Math.floor(Number(v.stock ?? 0)));
            const safetyStock = resolveSafetyStockForSku(raw, undefined, totalForProduct, nVs);
            const { available, stockStatus, isLowStock } = computeDerivedStockFields(onHand, 0, safetyStock);
            return {
              id: `__pending__${idx}`,
              productId,
              productName,
              categories,
              skuCode: String(v.sku ?? ''),
              barcode: String(v.barcode ?? ''),
              variantKey: vk,
              attributes: { size, color },
              onHand,
              reserved: 0,
              available,
              safetyStock,
              stockStatus,
              isLowStock,
              version: 0,
              status: 'active' as const,
            };
          });
        }

        skus = skus.map(normalizeSkuForMatrix);

        if (!skus.length) continue;

        const sizes = [...new Set(skus.map((s) => s.attributes.size).filter(Boolean))].sort();
        const colors = [...new Set(skus.map((s) => s.attributes.color).filter(Boolean))];
        const cells: InventoryMatrixProduct['cells'] = {};
        for (const c of colors) {
          cells[c] = {};
          for (const s of sizes) cells[c][s] = null;
        }
        for (const s of skus) {
          const col = s.attributes.color ?? '';
          const sz = s.attributes.size ?? '';
          if (!cells[col]) cells[col] = {};
          cells[col][sz] = s;
        }

        blocks.push({ productId, productName, categories, sizes, colors, cells });
      } catch (err) {
        console.error('[fetchInventoryMatrixPage] skipped product', d.id, err);
      }
    }

    const lastDoc = docs.length ? (docs[docs.length - 1] as QueryDocumentSnapshot) : null;
    return { products: blocks, lastDoc, hasMore };
  },

  async listLowStockSkus(max = 200): Promise<ProductSkuDoc[]> {
    const q = query(
      collectionGroup(db, SKUS),
      where('isLowStock', '==', true),
      orderBy('available', 'asc'),
      limit(max)
    );
    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const parts = d.ref.path.split('/');
        const pid = parts[1] ?? '';
        return mapSkuDoc(pid, d as QueryDocumentSnapshot);
      });
    } catch {
      const snap = await getDocs(query(collectionGroup(db, SKUS), limit(Math.min(max, 100))));
      const all = snap.docs.map((d) => {
        const parts = d.ref.path.split('/');
        const pid = parts[1] ?? '';
        return mapSkuDoc(pid, d as QueryDocumentSnapshot);
      });
      return all.filter((s) => s.isLowStock).sort((a, b) => a.available - b.available).slice(0, max);
    }
  },

  async searchSkus(term: string, max = 40): Promise<ProductSkuDoc[]> {
    const t = term.trim().toLowerCase();
    if (!t) return [];
    const snap = await getDocs(query(collectionGroup(db, SKUS), limit(120)));
    const all = snap.docs.map((d) => {
      const parts = d.ref.path.split('/');
      const pid = parts[1] ?? '';
      return mapSkuDoc(pid, d as QueryDocumentSnapshot);
    });
    return all
      .filter(
        (s) =>
          s.skuCode.toLowerCase().includes(t) ||
          s.productName.toLowerCase().includes(t) ||
          s.barcode.toLowerCase().includes(t)
      )
      .slice(0, max);
  },

  async fetchLedgerPage(opts: { max?: number; skuCode?: string }): Promise<StockLedgerEntry[]> {
    const max = opts.max ?? 120;
    const snap = await getDocs(query(collection(db, LEDGER), orderBy('timestamp', 'desc'), limit(max)));
    const rows = snap.docs.map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        timestamp: x.timestamp as StockLedgerEntry['timestamp'],
        userId: String(x.userId ?? ''),
        productId: String(x.productId ?? ''),
        skuId: String(x.skuId ?? ''),
        skuCode: String(x.skuCode ?? ''),
        reasonCode: String(x.reasonCode ?? ''),
        deltaOnHand: Number(x.deltaOnHand ?? 0),
        balanceOnHandAfter: Number(x.balanceOnHandAfter ?? 0),
        balanceAvailableAfter: Number(x.balanceAvailableAfter ?? 0),
        versionAfter: Number(x.versionAfter ?? 0),
        notes: String(x.notes ?? ''),
        source: (x.source === 'checkout' || x.source === 'import' || x.source === 'system' ? x.source : 'admin_ui') as StockLedgerEntry['source'],
        bulkJobId: typeof x.bulkJobId === 'string' ? x.bulkJobId : undefined,
      };
    });
    const f = opts.skuCode?.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter((r) => r.skuCode.toLowerCase() === f || r.skuCode.toLowerCase().includes(f));
  },
};
