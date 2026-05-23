/** Demo checkout rules in INR (align cart summary with checkout). */
export const FREE_SHIPPING_MIN_SUBTOTAL_INR = 5000;
export const STANDARD_SHIPPING_INR = 99;
export const DEMO_GST_RATE = 0.05;

export function shippingInrFromSubtotal(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_MIN_SUBTOTAL_INR) return 0;
  return STANDARD_SHIPPING_INR;
}

export function gstInrFromSubtotal(subtotal: number): number {
  return Math.round(subtotal * DEMO_GST_RATE * 100) / 100;
}
