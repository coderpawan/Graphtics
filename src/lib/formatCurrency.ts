/**
 * Indian Rupee formatting for storefront + admin.
 * Uses `en-IN` grouping (e.g. ₹1,23,456.78) and the ₹ symbol.
 */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
