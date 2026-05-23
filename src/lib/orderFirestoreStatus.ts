/**
 * Single place for deriving storefront / admin fulfillment status from Firestore.
 * Handles legacy docs that only set `shippingStatus` or have conflicting fields.
 */

import type { OrderStatus } from '../types';

/** Canonical fulfillment status strings on `orders` documents (for validation / mapping). */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'printed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

const AWAITING_SHIPMENT: OrderStatus[] = ['pending', 'confirmed', 'printed', 'packed'];

function rankFulfillment(s: OrderStatus): number {
  const order: OrderStatus[] = [
    'cancelled',
    'pending',
    'confirmed',
    'printed',
    'packed',
    'shipped',
    'delivered',
    'returned',
  ];
  const i = order.indexOf(s);
  return i >= 0 ? i : 0;
}

function mapLegacyShipping(v: unknown): OrderStatus | null {
  const legacy = String(v ?? '');
  if (legacy === 'shipped') return 'shipped';
  if (legacy === 'delivered') return 'delivered';
  if (legacy === 'returned') return 'returned';
  if (legacy === 'pending') return 'pending';
  return null;
}

/**
 * Canonical fulfillment status for an `orders` document (prefers `status`, merges legacy `shippingStatus`).
 */
export function resolveOrderStatusFromFirestore(data: Record<string, unknown>): OrderStatus {
  const rawStatus = data.status;
  const fromStatus =
    typeof rawStatus === 'string' && (ORDER_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as OrderStatus)
      : null;

  const fromLegacy = data.shippingStatus != null ? mapLegacyShipping(data.shippingStatus) : null;

  if (fromStatus && fromLegacy) {
    if (AWAITING_SHIPMENT.includes(fromStatus) && !AWAITING_SHIPMENT.includes(fromLegacy)) {
      return fromLegacy;
    }
    return rankFulfillment(fromLegacy) > rankFulfillment(fromStatus) ? fromLegacy : fromStatus;
  }

  return fromStatus ?? fromLegacy ?? 'pending';
}

export function isAwaitingShipment(status: OrderStatus): boolean {
  return AWAITING_SHIPMENT.includes(status);
}

/** True when the order is packed and ready for tracking / mark shipped (payment is not required for dispatch — COD-friendly). */
export function canProcessShipment(fulfillmentStatus: OrderStatus): boolean {
  return fulfillmentStatus === 'packed';
}

export const AWAITING_SHIPMENT_STATUSES = AWAITING_SHIPMENT;
