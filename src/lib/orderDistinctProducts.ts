import type { Order } from '../types';

/** Unique product ids on an order (one review opportunity per product, all variants combined). */
export function distinctProductIdsFromOrder(order: Order): string[] {
  const ids = new Set<string>();
  for (const it of order.items) {
    const pid = String(it.productId ?? '').trim();
    if (pid) ids.add(pid);
  }
  return [...ids];
}

export function orderLineLabelForProduct(order: Order, productId: string): string {
  const lines = order.items.filter(it => it.productId === productId);
  if (!lines.length) return productId;
  const name = lines[0]?.name?.trim();
  const bits = lines.map(l => `${l.quantity}× ${l.size || '—'} / ${l.color || '—'}`);
  return name ? `${name} (${bits.join('; ')})` : bits.join('; ');
}
