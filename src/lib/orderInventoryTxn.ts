/**
 * Order checkout / fulfillment — transactional stock with SKU docs + ledger when `skuId` exists.
 */

import {
  collection,
  doc,
  serverTimestamp,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { computeDerivedStockFields, deriveDefaultSafetyStock } from './inventorySkuCore';

const PRODUCTS = 'products';
const SKUS = 'skus';
const LEDGER = 'stockLedger';

export type StockLineInput = {
  productId: string;
  sku?: string;
  size: string;
  color: string;
  quantity: number;
};

type VariantRow = {
  size: string;
  color: string;
  sku: string;
  stock: number;
  skuId?: string;
};

export function normalizeOrderItemsForStock(items: StockLineInput[]): StockLineInput[] {
  const map = new Map<string, StockLineInput>();
  for (const it of items) {
    const k = `${it.productId}|${(it.sku ?? '').trim()}|${String(it.size).trim()}|${String(it.color).trim()}`;
    const prev = map.get(k);
    if (prev) prev.quantity += it.quantity;
    else map.set(k, { ...it });
  }
  return [...map.values()];
}

function findVariantRow(variants: VariantRow[], line: StockLineInput): VariantRow | undefined {
  const sku = (line.sku ?? '').trim();
  if (sku) {
    const hit = variants.find((v) => String(v.sku ?? '').trim() === sku);
    if (hit) return hit;
  }
  const size = String(line.size ?? '').trim();
  const color = String(line.color ?? '').trim();
  return variants.find((v) => String(v.size ?? '').trim() === size && String(v.color ?? '').trim() === color);
}

function mergeVariantStockBySkuId(variants: VariantRow[], skuId: string, nextStock: number): VariantRow[] {
  return variants.map((v) => (String(v.skuId) === String(skuId) ? { ...v, stock: Math.max(0, Math.floor(nextStock)) } : v));
}

function mergeVariantStockByRow(variants: VariantRow[], row: VariantRow, nextStock: number): VariantRow[] {
  const sku = String(row.sku ?? '').trim();
  return variants.map((v) => {
    const vSku = String(v.sku ?? '').trim();
    if (sku && vSku === sku) return { ...v, stock: Math.max(0, Math.floor(nextStock)) };
    if (
      String(v.size ?? '').trim() === String(row.size ?? '').trim() &&
      String(v.color ?? '').trim() === String(row.color ?? '').trim()
    ) {
      return { ...v, stock: Math.max(0, Math.floor(nextStock)) };
    }
    return v;
  });
}

function validSkuId(skuId?: string): boolean {
  if (!skuId || typeof skuId !== 'string') return false;
  if (skuId.startsWith('__pending__')) return false;
  return skuId.trim().length >= 3;
}

/**
 * Decrements on-hand stock for each line, updates embedded `variants`, optional SKU docs + ledger.
 * Must run inside checkout before the order document is written (same transaction as caller).
 */
export async function applyCheckoutStockInsideTransaction(
  firestore: Firestore,
  tx: Transaction,
  items: StockLineInput[],
  ctx: { userId: string; orderId: string }
): Promise<void> {
  const lines = normalizeOrderItemsForStock(items).filter((l) => l.productId && l.quantity > 0);
  if (!lines.length) return;

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const productSnaps = await Promise.all(productIds.map((id) => tx.get(doc(firestore, PRODUCTS, id))));
  const productData = new Map<string, Record<string, unknown>>();
  productIds.forEach((id, i) => {
    const s = productSnaps[i];
    if (!s.exists()) throw new Error(`Product not found: ${id}`);
    productData.set(id, s.data() as Record<string, unknown>);
  });

  type SkuWork = { productId: string; skuId: string; skuCode: string; dec: number };
  const skuWork = new Map<string, SkuWork>();
  type LegacyWork = { productId: string; row: VariantRow; dec: number };
  const legacyWork: LegacyWork[] = [];

  for (const line of lines) {
    const raw = productData.get(line.productId)!;
    const variants = (Array.isArray(raw.variants) ? raw.variants : []) as VariantRow[];
    const row = findVariantRow(variants, line);
    if (!row) throw new Error(`Variant not found on product ${line.productId}`);
    const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));
    if (stock < line.quantity) {
      throw new Error(
        `Insufficient stock for "${String(raw.name ?? line.productId)}" (${row.sku || `${row.size}/${row.color}`}).`
      );
    }
    if (validSkuId(row.skuId)) {
      const k = `${line.productId}__${row.skuId}`;
      const ex = skuWork.get(k);
      if (ex) ex.dec += line.quantity;
      else skuWork.set(k, { productId: line.productId, skuId: row.skuId!, skuCode: String(row.sku ?? ''), dec: line.quantity });
    } else {
      legacyWork.push({ productId: line.productId, row, dec: line.quantity });
    }
  }

  const skuRefs = [...skuWork.values()].map((w) => doc(firestore, PRODUCTS, w.productId, SKUS, w.skuId));
  const skuSnaps = await Promise.all(skuRefs.map((r) => tx.get(r)));

  const skuSnapByKey = new Map<string, DocumentSnapshot>();
  [...skuWork.keys()].forEach((k, i) => skuSnapByKey.set(k, skuSnaps[i] as DocumentSnapshot));

  for (const [k, w] of skuWork) {
    const snap = skuSnapByKey.get(k)!;
    if (!snap.exists()) {
      throw new Error(
        `SKU document missing for ${w.skuCode}. Open Admin → Inventory and tap "Sync SKUs" for that product.`
      );
    }
    const s = snap.data() as Record<string, unknown>;
    const onHand = Math.max(0, Math.floor(Number(s.onHand ?? 0)));
    if (onHand < w.dec) {
      throw new Error(`Insufficient stock for SKU ${w.skuCode} (on hand ${onHand}).`);
    }
  }

  const productWrites = new Map<string, VariantRow[]>();

  for (const [k, w] of skuWork) {
    const snap = skuSnapByKey.get(k)!;
    const s = snap.data() as Record<string, unknown>;
    const onHand = Math.max(0, Math.floor(Number(s.onHand ?? 0)));
    const reserved = Math.max(0, Math.floor(Number(s.reserved ?? 0)));
    const safetyStock = Number.isFinite(Number(s.safetyStock)) && Number(s.safetyStock) >= 0
      ? Math.floor(Number(s.safetyStock))
      : deriveDefaultSafetyStock(Math.max(0, Math.floor(onHand)), 1);
    const version = Math.max(0, Math.floor(Number(s.version ?? 0)));
    const nextOnHand = onHand - w.dec;
    const { available, stockStatus, isLowStock } = computeDerivedStockFields(nextOnHand, reserved, safetyStock);

    const skuRef = doc(firestore, PRODUCTS, w.productId, SKUS, w.skuId);
    tx.update(skuRef, {
      onHand: nextOnHand,
      available,
      stockStatus,
      isLowStock,
      version: version + 1,
      updatedAt: serverTimestamp(),
    });

    const ledgerRef = doc(collection(firestore, LEDGER));
    tx.set(ledgerRef, {
      timestamp: serverTimestamp(),
      userId: ctx.userId,
      productId: w.productId,
      skuId: w.skuId,
      skuCode: w.skuCode,
      reasonCode: 'ECOMMERCE_SALE',
      deltaOnHand: -w.dec,
      balanceOnHandAfter: nextOnHand,
      balanceAvailableAfter: available,
      versionAfter: version + 1,
      notes: `Checkout order ${ctx.orderId}`,
      source: 'checkout',
    });

    const raw = productData.get(w.productId)!;
    const variants = (Array.isArray(raw.variants) ? raw.variants : []) as VariantRow[];
    const merged = mergeVariantStockBySkuId(variants, w.skuId, nextOnHand);
    productWrites.set(w.productId, merged);
    raw.variants = merged;
  }

  for (const lw of legacyWork) {
    const raw = productData.get(lw.productId)!;
    let variants = (productWrites.get(lw.productId) ??
      (Array.isArray(raw.variants) ? raw.variants : [])) as VariantRow[];
    const cur = findVariantRow(variants, {
      productId: lw.productId,
      sku: lw.row.sku,
      size: lw.row.size,
      color: lw.row.color,
      quantity: 0,
    });
    if (!cur) throw new Error('Variant lost during legacy stock update');
    const next = Math.max(0, Math.floor(Number(cur.stock ?? 0)) - lw.dec);
    variants = mergeVariantStockByRow(variants, lw.row, next);
    productWrites.set(lw.productId, variants);
    raw.variants = variants;
  }

  for (const [pid, nextVariants] of productWrites) {
    tx.update(doc(firestore, PRODUCTS, pid), {
      variants: nextVariants,
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Restores on-hand stock for returned items (admin). Reads must be completed by caller before writes.
 */
export async function applyReturnRestockInsideTransaction(
  firestore: Firestore,
  tx: Transaction,
  items: StockLineInput[],
  ctx: { userId: string; orderDocId: string }
): Promise<void> {
  const lines = normalizeOrderItemsForStock(items).filter((l) => l.productId && l.quantity > 0);
  if (!lines.length) return;

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const productSnaps = await Promise.all(productIds.map((id) => tx.get(doc(firestore, PRODUCTS, id))));
  const productData = new Map<string, Record<string, unknown>>();
  productIds.forEach((id, i) => {
    const s = productSnaps[i];
    if (!s.exists()) return;
    productData.set(id, s.data() as Record<string, unknown>);
  });

  type SkuWork = { productId: string; skuId: string; skuCode: string; inc: number };
  const skuWork = new Map<string, SkuWork>();
  const legacyWork: { productId: string; row: VariantRow; inc: number }[] = [];

  for (const line of lines) {
    const raw = productData.get(line.productId);
    if (!raw) continue;
    const variants = (Array.isArray(raw.variants) ? raw.variants : []) as VariantRow[];
    const row = findVariantRow(variants, line);
    if (!row) continue;
    if (validSkuId(row.skuId)) {
      const k = `${line.productId}__${row.skuId}`;
      const ex = skuWork.get(k);
      if (ex) ex.inc += line.quantity;
      else skuWork.set(k, { productId: line.productId, skuId: row.skuId!, skuCode: String(row.sku ?? ''), inc: line.quantity });
    } else {
      legacyWork.push({ productId: line.productId, row, inc: line.quantity });
    }
  }

  const skuRefs = [...skuWork.values()].map((w) => doc(firestore, PRODUCTS, w.productId, SKUS, w.skuId));
  const skuSnaps = await Promise.all(skuRefs.map((r) => tx.get(r)));

  const skuSnapByKey = new Map<string, DocumentSnapshot>();
  [...skuWork.keys()].forEach((k, i) => skuSnapByKey.set(k, skuSnaps[i] as DocumentSnapshot));

  const productWrites = new Map<string, VariantRow[]>();

  for (const [k, w] of skuWork) {
    const snap = skuSnapByKey.get(k)!;
    if (!snap.exists()) continue;
    const s = snap.data() as Record<string, unknown>;
    const onHand = Math.max(0, Math.floor(Number(s.onHand ?? 0)));
    const reserved = Math.max(0, Math.floor(Number(s.reserved ?? 0)));
    const safetyStock = Number.isFinite(Number(s.safetyStock)) && Number(s.safetyStock) >= 0
      ? Math.floor(Number(s.safetyStock))
      : deriveDefaultSafetyStock(Math.max(0, Math.floor(onHand)), 1);
    const version = Math.max(0, Math.floor(Number(s.version ?? 0)));
    const nextOnHand = onHand + w.inc;
    const { available, stockStatus, isLowStock } = computeDerivedStockFields(nextOnHand, reserved, safetyStock);

    const skuRef = doc(firestore, PRODUCTS, w.productId, SKUS, w.skuId);
    tx.update(skuRef, {
      onHand: nextOnHand,
      available,
      stockStatus,
      isLowStock,
      version: version + 1,
      updatedAt: serverTimestamp(),
    });

    const ledgerRef = doc(collection(firestore, LEDGER));
    tx.set(ledgerRef, {
      timestamp: serverTimestamp(),
      userId: ctx.userId,
      productId: w.productId,
      skuId: w.skuId,
      skuCode: w.skuCode,
      reasonCode: 'CUSTOMER_RETURN',
      deltaOnHand: w.inc,
      balanceOnHandAfter: nextOnHand,
      balanceAvailableAfter: available,
      versionAfter: version + 1,
      notes: `Return restock order ${ctx.orderDocId}`,
      source: 'system',
    });

    const raw = productData.get(w.productId)!;
    const variants = (Array.isArray(raw.variants) ? raw.variants : []) as VariantRow[];
    const merged = mergeVariantStockBySkuId(variants, w.skuId, nextOnHand);
    productWrites.set(w.productId, merged);
    raw.variants = merged;
  }

  for (const lw of legacyWork) {
    const raw = productData.get(lw.productId);
    if (!raw) continue;
    let variants = (productWrites.get(lw.productId) ??
      (Array.isArray(raw.variants) ? raw.variants : [])) as VariantRow[];
    const cur = findVariantRow(variants, {
      productId: lw.productId,
      sku: lw.row.sku,
      size: lw.row.size,
      color: lw.row.color,
      quantity: 0,
    });
    if (!cur) continue;
    const next = Math.max(0, Math.floor(Number(cur.stock ?? 0)) + lw.inc);
    variants = mergeVariantStockByRow(variants, lw.row, next);
    productWrites.set(lw.productId, variants);
    raw.variants = variants;
  }

  for (const [pid, nextVariants] of productWrites) {
    tx.update(doc(firestore, PRODUCTS, pid), {
      variants: nextVariants,
      updatedAt: serverTimestamp(),
    });
  }
}
