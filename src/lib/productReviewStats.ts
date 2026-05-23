import type { Product, Review } from '../types';

/** Merge storefront `product.reviews` with Firestore `reviews` rows (last write wins by id). */
export function mergeReviewsById(local: Review[], remote: Review[]): Review[] {
  const byId = new Map<string, Review>();
  for (const r of local) byId.set(r.id, r);
  for (const r of remote) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Arithmetic mean of numeric ratings, rounded to one decimal (e.g. 4.3). */
export function averageReviewRatingOneDecimal(reviews: Review[]): number {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((acc, r) => acc + (Number.isFinite(r.rating) ? r.rating : 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export function formatRatingOneDecimal(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(1);
}

/**
 * Rating for product cards and listing sort: use denormalized `rating` when set (includes shopper reviews
 * after sync), otherwise average of `product.reviews` (curated + embedded on the document).
 */
export function getProductListingStarRating(product: Product): number {
  const stored = Number(product.rating ?? 0);
  if (Number.isFinite(stored) && stored > 0) return stored;
  if (product.reviews?.length) return averageReviewRatingOneDecimal(product.reviews);
  return 0;
}
