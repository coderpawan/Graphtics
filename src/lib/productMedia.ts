import type { Product } from '../types';

/** All image URLs for a colour (carousel). Falls back to variant image or legacy `images`. */
export function getImagesForProductColor(product: Product, color: string): string[] {
  const c = color.trim();
  const fromMap = product.colorImages?.[c];
  if (fromMap?.length) return fromMap;
  const row = product.variants.find((v) => v.color === c);
  if (row?.image) return [row.image];
  if (product.images?.length) return [...product.images];
  return [];
}

/** First hero / cart image for a colour. */
export function getImageForProductColor(product: Product, color: string): string {
  return getImagesForProductColor(product, color)[0] ?? '';
}

/** Card / listing: first image of default colour, else first colour with photos, else legacy gallery. */
export function getProductListingImage(product: Product): string {
  const map = product.colorImages;
  const def = product.defaultDisplayColor?.trim();
  if (map && def && map[def]?.[0]) return map[def][0];
  if (def) {
    const fromVariant = product.variants.find((v) => v.color === def)?.image?.trim();
    if (fromVariant) return fromVariant;
  }
  const firstColor = product.colors[0]?.trim();
  if (map && firstColor && map[firstColor]?.[0]) return map[firstColor][0];
  const v0 = product.variants[0]?.image?.trim();
  if (v0) return v0;
  return product.images?.[0] ?? '';
}
