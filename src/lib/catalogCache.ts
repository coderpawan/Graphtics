import type { Product } from '../types';

const KEY = 'graphtics_products_catalog_v2';
const TTL_MS = 1000 * 60 * 60;

type CacheEnvelope = { savedAt: number; products: Product[] };

export function readCatalogCache(): Product[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!Array.isArray(parsed?.products) || typeof parsed.savedAt !== 'number') return undefined;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.sessionStorage.removeItem(KEY);
      return undefined;
    }
    return parsed.products;
  } catch {
    return undefined;
  }
}

export function writeCatalogCache(products: Product[]) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CacheEnvelope = { savedAt: Date.now(), products };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}
