/**
 * Shared inventory / SKU helpers (storefront + admin + Firestore transactions).
 */

export const STOCK_REASON_CODES = [
  'INBOUND_SHIPMENT',
  'CUSTOMER_RETURN',
  'DAMAGED_GOODS',
  'CYCLE_COUNT_AUDIT',
  'ECOMMERCE_SALE',
  'MANUAL_ADJUSTMENT',
  'TRANSFER',
  'MIGRATION_OPENING_BALANCE',
] as const;

export type StockReasonCode = (typeof STOCK_REASON_CODES)[number];

export const STOCK_REASON_LABELS: Record<StockReasonCode, string> = {
  INBOUND_SHIPMENT: 'Inbound shipment',
  CUSTOMER_RETURN: 'Customer return',
  DAMAGED_GOODS: 'Damaged goods',
  CYCLE_COUNT_AUDIT: 'Cycle count / audit',
  ECOMMERCE_SALE: 'E-commerce sale',
  MANUAL_ADJUSTMENT: 'Manual adjustment',
  TRANSFER: 'Transfer (warehouse)',
  MIGRATION_OPENING_BALANCE: 'Migration / opening balance',
};

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export function isStockReasonCode(v: string): v is StockReasonCode {
  return (STOCK_REASON_CODES as readonly string[]).includes(v);
}

/** Stable key for duplicate variant detection (sorted attribute keys). */
export function buildVariantKey(attributes: Record<string, string>): string {
  const keys = Object.keys(attributes).sort();
  return keys.map((k) => `${k}=${attributes[k]?.trim() ?? ''}`).join('|');
}

export function variantKeyFromSizeColor(size: string, color: string): string {
  return buildVariantKey({ size: size.trim(), color: color.trim() });
}

/**
 * When no per-product default exists, derive a reorder / alert threshold from how much
 * stock exists across variants (15% of average per-variant units, clamped).
 */
export function deriveDefaultSafetyStock(totalUnitsAcrossVariants: number, variantCount: number): number {
  const total = Number.isFinite(totalUnitsAcrossVariants) ? Math.max(0, Math.floor(totalUnitsAcrossVariants)) : 0;
  const n = Number.isFinite(variantCount) ? Math.max(1, Math.floor(variantCount)) : 1;
  const avg = total / n;
  return Math.max(1, Math.min(500, Math.ceil(avg * 0.15)));
}

export function computeDerivedStockFields(
  onHand: number,
  reserved: number,
  safetyStock: number
): { available: number; stockStatus: StockStatus; isLowStock: boolean } {
  const safeOn = Number.isFinite(onHand) ? Math.max(0, Math.floor(onHand)) : 0;
  const safeRes = Number.isFinite(reserved) ? Math.max(0, Math.floor(reserved)) : 0;
  const available = Math.max(0, safeOn - safeRes);
  const threshold = Number.isFinite(safetyStock) ? Math.max(0, Math.floor(safetyStock)) : 0;
  const isLowStock = available <= threshold;
  const stockStatus: StockStatus =
    safeOn <= 0 ? 'out_of_stock' : isLowStock ? 'low_stock' : 'in_stock';
  return { available, stockStatus, isLowStock };
}
