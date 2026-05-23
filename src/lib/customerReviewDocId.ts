/** Stable Firestore document id for a customer review (one per user + order + product). */
export function buildCustomerReviewDocId(uid: string, orderFirestoreId: string, productId: string): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 400);
  return `${clean(uid)}__${clean(orderFirestoreId)}__${clean(productId)}`.slice(0, 1400);
}
