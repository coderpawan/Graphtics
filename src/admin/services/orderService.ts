/**
 * Admin Order Service — Firestore `orders` collection.
 * Fulfillment uses the same `status` field as the storefront `Order` type
 * (pending → shipped → delivered / returned). Legacy `shippingStatus` is read for
 * backwards compatibility but is removed on writes.
 */

import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  AWAITING_SHIPMENT_STATUSES,
  isAwaitingShipment,
  ORDER_STATUSES,
  resolveOrderStatusFromFirestore,
} from '../../lib/orderFirestoreStatus';
import {
  applyCheckoutStockInsideTransaction,
  applyReturnRestockInsideTransaction,
  type StockLineInput,
} from '../../lib/orderInventoryTxn';
import { buildTrackingUrl } from '../../lib/orderTracking';
import type { OrderFulfillmentEvent, OrderPackageTrackingPhoto, OrderStatus } from '../../types';
import type { StoreOrder, StoreOrderStatus } from '../types/store';

const COLLECTION = 'orders';

function parseStoredOrderStatus(v: unknown): OrderStatus | undefined {
  if (typeof v !== 'string') return undefined;
  return (ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatus) : undefined;
}

function fulfillmentEvent(
  status: OrderStatus,
  actor: 'admin' | 'customer' | 'system',
  note?: string
): { at: string; status: OrderStatus; actor: typeof actor; note?: string } {
  return {
    at: new Date().toISOString(),
    status,
    actor,
    ...(note ? { note } : {}),
  };
}

export {
  resolveOrderStatusFromFirestore,
  isAwaitingShipment,
  canProcessShipment,
} from '../../lib/orderFirestoreStatus';

/**
 * Maps a Firestore order document to `StoreOrder` (shared by list/detail and analytics).
 */
export function mapOrderRecordFromFirestore(id: string, data: Record<string, unknown>): StoreOrder {
  const rawReturn = data.returnRequest;
  let returnRequest: StoreOrder['returnRequest'] = null;
  if (rawReturn && typeof rawReturn === 'object' && rawReturn !== null) {
    const rr = rawReturn as Record<string, unknown>;
    const st = rr.status;
    if (st === 'pending' || st === 'approved' || st === 'rejected' || st === 'completed') {
      returnRequest = {
        status: st,
        reason: String(rr.reason ?? ''),
        requestedAt: String(rr.requestedAt ?? ''),
        resolvedAt: rr.resolvedAt != null ? String(rr.resolvedAt) : undefined,
        adminNote: rr.adminNote != null ? String(rr.adminNote) : undefined,
      };
    }
  }

  const rawEvents = data.fulfillmentEvents;
  const fulfillmentEvents: OrderFulfillmentEvent[] = Array.isArray(rawEvents)
    ? rawEvents
        .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
        .map(
          (e): OrderFulfillmentEvent => ({
            at: String(e.at ?? ''),
            status: (typeof e.status === 'string' ? e.status : 'pending') as OrderStatus,
            note: e.note != null ? String(e.note) : undefined,
            actor:
              e.actor === 'admin'
                ? 'admin'
                : e.actor === 'customer'
                  ? 'customer'
                  : e.actor === 'system'
                    ? 'system'
                    : undefined,
          })
        )
    : [];

  const rawNotes = data.adminNotes;
  const adminNotes = Array.isArray(rawNotes)
    ? rawNotes
        .filter((n): n is Record<string, unknown> => n != null && typeof n === 'object')
        .map(n => ({
          id: String(n.id ?? ''),
          at: String(n.at ?? ''),
          text: String(n.text ?? ''),
        }))
    : [];

  const rawPkg = data.packageTrackingPhotos;
  const packageTrackingPhotos: OrderPackageTrackingPhoto[] = Array.isArray(rawPkg)
    ? rawPkg
        .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
        .map(
          (p): OrderPackageTrackingPhoto => ({
            id: String(p.id ?? ''),
            url: String(p.url ?? ''),
            caption: p.caption != null ? String(p.caption) : undefined,
            uploadedAt: String(p.uploadedAt ?? ''),
          })
        )
        .filter(p => p.id && p.url)
    : [];

  return {
    id,
    orderId: String(data.orderId ?? id),
    customerId: String(data.customerId ?? data.userId ?? ''),
    customerName: String(data.customerName ?? ''),
    customerEmail: String(data.customerEmail ?? ''),
    customerPhone: String(data.customerPhone ?? ''),
    customerPhoneAlt: String(data.customerPhoneAlt ?? ''),
    shippingAddress: String(data.shippingAddress ?? ''),
    items: Array.isArray(data.items)
      ? data.items.map((it: Record<string, unknown>) => ({
          productId: String(it.productId ?? ''),
          sku: String(it.sku ?? ''),
          size: String(it.size ?? ''),
          color: String(it.color ?? ''),
          quantity: Number(it.quantity ?? 0),
          price: Number(it.price ?? 0),
          categories: Array.isArray(it.categories) ? it.categories.map(String) : undefined,
          name: it.name != null ? String(it.name) : undefined,
        }))
      : [],
    totalAmount: Number(data.totalAmount ?? data.total ?? 0),
    paymentStatus: normalizePaymentStatus(data),
    status: resolveOrderStatusFromFirestore(data),
    statusBeforeAdminCancel: parseStoredOrderStatus(data.statusBeforeAdminCancel),
    cancelledAt: data.cancelledAt != null ? String(data.cancelledAt) : undefined,
    cancelReason: data.cancelReason != null ? String(data.cancelReason) : undefined,
    trackingNumber: String(data.trackingNumber ?? ''),
    trackingCarrier: String(data.trackingCarrier ?? ''),
    trackingUrl: String(data.trackingUrl ?? ''),
    packageTrackingPhotos,
    returnRequest,
    fulfillmentEvents,
    adminNotes,
    createdAt: data.createdAt as StoreOrder['createdAt'],
    updatedAt: data.updatedAt as StoreOrder['updatedAt'],
  };
}

function normalizePaymentStatus(data: Record<string, unknown>): StoreOrder['paymentStatus'] {
  const p = data.paymentStatus;
  if (p === 'paid' || p === 'pending' || p === 'failed') return p;
  /** Some older docs used `completed` for a captured charge. */
  if (p === 'completed') return 'paid';
  return 'pending';
}

function requirePaidPayment(data: Record<string, unknown>): void {
  if (normalizePaymentStatus(data) !== 'paid') {
    throw new Error('Payment must be successful (paid) before this action.');
  }
}

const PRE_SHIP_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'printed',
  printed: 'packed',
};

export interface OrderPageOptions {
  /** Exact Firestore `status` (e.g. shipped, delivered, returned). */
  status?: StoreOrderStatus | '';
  /** Orders not yet shipped (status in pending | confirmed | printed | packed). */
  awaitingShipment?: boolean;
  paymentStatus?: 'pending' | 'paid' | 'failed' | '';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot | null;
}

export interface OrderPageResult {
  items: StoreOrder[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

function mapOrderDoc(d: QueryDocumentSnapshot): StoreOrder {
  return mapOrderRecordFromFirestore(d.id, d.data() as Record<string, unknown>);
}

function buildOrderConstraints(opts: OrderPageOptions): QueryConstraint[] {
  const pageSize = opts.pageSize ?? 25;
  const constraints: QueryConstraint[] = [];

  const statusFilter = opts.status;
  const paymentFilter = opts.paymentStatus;

  if (opts.awaitingShipment) {
    constraints.push(where('status', 'in', [...AWAITING_SHIPMENT_STATUSES]));
    constraints.push(orderBy('createdAt', 'desc'));
  } else if (statusFilter) {
    constraints.push(where('status', '==', statusFilter));
    constraints.push(orderBy('createdAt', 'desc'));
  } else if (paymentFilter) {
    constraints.push(where('paymentStatus', '==', paymentFilter));
    constraints.push(orderBy('createdAt', 'desc'));
  } else {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(pageSize + 1));
  void pageSize;
  return constraints;
}

export const orderService = {
  async fetchPage(opts: OrderPageOptions = {}): Promise<OrderPageResult> {
    const pageSize = opts.pageSize ?? 25;
    const constraints = buildOrderConstraints({ ...opts, pageSize });
    const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const lastDoc = docs.length ? docs[docs.length - 1] : null;
    return { items: docs.map(mapOrderDoc), lastDoc, hasMore };
  },

  async getOrder(orderId: string): Promise<StoreOrder> {
    const ref = doc(db, COLLECTION, orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');
    return mapOrderDoc(snap as QueryDocumentSnapshot);
  },

  async shipOrder(
    orderDocId: string,
    trackingNumber: string,
    trackingCarrier?: string,
    trackingUrlOverride?: string
  ): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const current = resolveOrderStatusFromFirestore(data);
      if (current !== 'packed') {
        throw new Error(
          `Cannot ship: order must be packed first (current: "${current}"). Use Confirm → Print → Pack on the order page.`
        );
      }
      const tn = trackingNumber.trim();
      const carrier = trackingCarrier?.trim() ?? '';
      const built = buildTrackingUrl(tn, carrier || undefined);
      const url = (trackingUrlOverride?.trim() || built).trim();
      tx.update(ref, {
        status: 'shipped',
        trackingNumber: tn,
        ...(carrier ? { trackingCarrier: carrier } : {}),
        ...(url ? { trackingUrl: url } : {}),
        fulfillmentEvents: arrayUnion(
          fulfillmentEvent('shipped', 'admin', carrier ? `Shipped — ${carrier}: ${tn}` : `Shipped — ${tn}`)
        ),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  async markDelivered(orderDocId: string): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      requirePaidPayment(data);
      const current = resolveOrderStatusFromFirestore(data);
      if (current !== 'shipped') {
        throw new Error(`Mark delivered only from "shipped"; current status is "${current}"`);
      }
      tx.update(ref, {
        status: 'delivered',
        fulfillmentEvents: arrayUnion(fulfillmentEvent('delivered', 'admin', 'Marked delivered')),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  /**
   * Marks an order as returned and restores stock for each line item (SKU subdocs + ledger when present).
   */
  /**
   * Admin-only: cancel the order with a required reason, restock line items (same inventory rules as return),
   * and record `statusBeforeAdminCancel` so the cancellation can be removed later from the dashboard.
   * When `paymentStatus` is `paid`, `opts.paymentRefundConfirmed` must be true (UI checkbox / explicit ack).
   */
  async adminCancelOrder(
    orderDocId: string,
    reason: string,
    opts?: { paymentRefundConfirmed?: boolean }
  ): Promise<void> {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new Error('Enter a cancellation reason (at least 3 characters).');
    }
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const pay = normalizePaymentStatus(data);
      if (pay === 'paid' && opts?.paymentRefundConfirmed !== true) {
        throw new Error(
          'Payment is recorded as paid. Confirm in the cancel dialog that the refund has been completed before cancelling.'
        );
      }
      const st = resolveOrderStatusFromFirestore(data);
      if (st === 'cancelled') throw new Error('Order is already cancelled');
      if (st === 'returned') throw new Error('Cannot cancel an order that is already marked returned.');
      const items = Array.isArray(data.items) ? data.items : [];
      const lines: StockLineInput[] = [];
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const productId = String(item.productId ?? '');
        const sku = String(item.sku ?? '').trim();
        const size = String(item.size ?? '').trim();
        const color = String(item.color ?? '').trim();
        const qty = Number(item.quantity ?? 0);
        if (!productId || qty <= 0) continue;
        lines.push({ productId, sku, size, color, quantity: qty });
      }
      await applyReturnRestockInsideTransaction(db, tx, lines, { userId: 'admin', orderDocId });
      const now = new Date().toISOString();
      const cancelNote =
        pay === 'paid'
          ? `Cancelled by admin — refund confirmed — ${trimmed}`
          : `Cancelled by admin: ${trimmed}`;
      tx.update(ref, {
        status: 'cancelled',
        statusBeforeAdminCancel: st,
        cancelledAt: now,
        cancelReason: trimmed,
        fulfillmentEvents: arrayUnion(fulfillmentEvent('cancelled', 'admin', cancelNote)),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  /**
   * Undo an admin cancellation: restores fulfillment `status` and decrements inventory again (re-reserves sale).
   * Only works when `statusBeforeAdminCancel` is present (dashboard admin cancel flow).
   */
  async adminRevertCancellation(orderDocId: string): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const st = resolveOrderStatusFromFirestore(data);
      if (st !== 'cancelled') throw new Error('Order is not cancelled.');
      const prev = parseStoredOrderStatus(data.statusBeforeAdminCancel);
      if (!prev || prev === 'cancelled' || prev === 'returned') {
        throw new Error(
          'This cancellation cannot be removed here (missing saved prior status — e.g. customer-cancelled orders).'
        );
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const lines: StockLineInput[] = [];
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const productId = String(item.productId ?? '');
        const sku = String(item.sku ?? '').trim();
        const size = String(item.size ?? '').trim();
        const color = String(item.color ?? '').trim();
        const qty = Number(item.quantity ?? 0);
        if (!productId || qty <= 0) continue;
        lines.push({ productId, sku, size, color, quantity: qty });
      }
      const uid = String(data.userId ?? data.customerId ?? '').trim() || 'admin';
      const orderIdHuman = String(data.orderId ?? orderDocId).trim() || orderDocId;
      await applyCheckoutStockInsideTransaction(db, tx, lines, { userId: uid, orderId: orderIdHuman });
      tx.update(ref, {
        status: prev,
        statusBeforeAdminCancel: deleteField(),
        cancelledAt: deleteField(),
        cancelReason: deleteField(),
        fulfillmentEvents: arrayUnion(
          fulfillmentEvent(prev, 'admin', 'Cancellation removed — order re-opened')
        ),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  async markReturnedWithRestock(orderDocId: string): Promise<void> {
    const orderRef = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error('Order not found');
      const data = orderSnap.data() as Record<string, unknown>;
      const st = resolveOrderStatusFromFirestore(data);
      if (st === 'returned') {
        throw new Error('Order already marked as returned');
      }
      if (st !== 'shipped' && st !== 'delivered') {
        throw new Error(`Returns only allowed for shipped or delivered orders (current: "${st}")`);
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const lines: StockLineInput[] = [];
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const productId = String(item.productId ?? '');
        const sku = String(item.sku ?? '').trim();
        const size = String(item.size ?? '').trim();
        const color = String(item.color ?? '').trim();
        const qty = Number(item.quantity ?? 0);
        if (!productId || qty <= 0) continue;
        lines.push({ productId, sku, size, color, quantity: qty });
      }

      await applyReturnRestockInsideTransaction(db, tx, lines, { userId: 'admin', orderDocId });

      const po =
        data.returnRequest && typeof data.returnRequest === 'object'
          ? (data.returnRequest as Record<string, unknown>)
          : null;

      tx.update(orderRef, {
        status: 'returned',
        fulfillmentEvents: arrayUnion(fulfillmentEvent('returned', 'admin', 'Returned — inventory restocked')),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
        ...(po
          ? {
              returnRequest: {
                status: 'completed',
                reason: String(po.reason ?? ''),
                requestedAt: String(po.requestedAt ?? ''),
                resolvedAt: new Date().toISOString(),
                adminNote: po.adminNote != null ? String(po.adminNote) : '',
              },
            }
          : {}),
      });
    });
  },

  async setReturnRequestDecision(
    orderDocId: string,
    decision: 'approved' | 'rejected',
    adminNote?: string
  ): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const rr = data.returnRequest as Record<string, unknown> | undefined;
      if (!rr || rr.status !== 'pending') {
        throw new Error('No pending return request for this order');
      }
      const cur = resolveOrderStatusFromFirestore(data);
      tx.update(ref, {
        returnRequest: {
          status: decision,
          reason: String(rr.reason ?? ''),
          requestedAt: String(rr.requestedAt ?? ''),
          resolvedAt: new Date().toISOString(),
          adminNote: adminNote?.trim() || (rr.adminNote != null ? String(rr.adminNote) : ''),
        },
        fulfillmentEvents: arrayUnion(
          fulfillmentEvent(cur, 'admin', decision === 'approved' ? 'Return approved' : 'Return rejected')
        ),
        updatedAt: serverTimestamp(),
      });
    });
  },

  async appendAdminOrderNote(orderDocId: string, text: string): Promise<void> {
    const t = text.trim();
    if (!t) throw new Error('Note cannot be empty');
    const ref = doc(db, COLLECTION, orderDocId);
    await updateDoc(ref, {
      adminNotes: arrayUnion({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        text: t,
      }),
      updatedAt: serverTimestamp(),
    });
  },

  async listOrdersBetweenDates(start: Date, end: Date, max = 2000): Promise<StoreOrder[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max))
    );
    return snap.docs
      .map(mapOrderDoc)
      .filter((o) => {
        const created =
          o.createdAt && typeof (o.createdAt as { toDate?: () => Date }).toDate === 'function'
            ? (o.createdAt as { toDate: () => Date }).toDate()
            : o.createdAt instanceof Date
              ? o.createdAt
              : new Date(0);
        return created >= start && created <= end;
      });
  },

  /**
   * Marks `paymentStatus` as paid (e.g. COD received, bank transfer verified, or manual until a webhook exists).
   * Only transitions from `pending`.
   */
  async confirmPaymentReceived(orderDocId: string): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const p = normalizePaymentStatus(data);
      if (p !== 'pending') {
        throw new Error(`Payment is not pending (current: "${p}").`);
      }
      const st = resolveOrderStatusFromFirestore(data);
      if (st === 'cancelled' || st === 'returned') {
        throw new Error('Cannot confirm payment on a cancelled or returned order.');
      }
      tx.update(ref, {
        paymentStatus: 'paid',
        fulfillmentEvents: arrayUnion(
          fulfillmentEvent(st, 'admin', 'Payment confirmed — funds verified or COD received')
        ),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  subscribePendingShipping(listener: (orders: StoreOrder[]) => void, max = 20): () => void {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(80));
    return onSnapshot(
      q,
      (snap) => {
        const pending = snap.docs
          .map(mapOrderDoc)
          .filter((o) => isAwaitingShipment(o.status))
          .slice(0, max);
        listener(pending);
      },
      (err) => console.error('[orders] snapshot', err)
    );
  },

  /** Moves pending → confirmed → printed → packed (no payment check — supports COD before collection). */
  async advancePreShipStage(orderDocId: string): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const current = resolveOrderStatusFromFirestore(data);
      if (!isAwaitingShipment(current)) {
        throw new Error(`Warehouse stages apply only before ship (current: "${current}")`);
      }
      const next = PRE_SHIP_NEXT[current];
      if (!next) {
        throw new Error('Order is already packed — use Process shipment to dispatch.');
      }
      const label =
        next === 'confirmed'
          ? 'Confirmed — ready to pick'
          : next === 'printed'
            ? 'Picking slip printed'
            : 'Packed — ready for courier pickup';
      tx.update(ref, {
        status: next,
        fulfillmentEvents: arrayUnion(fulfillmentEvent(next, 'admin', label)),
        updatedAt: serverTimestamp(),
        shippingStatus: deleteField(),
      });
    });
  },

  async updateShipmentDetails(
    orderDocId: string,
    fields: { trackingNumber?: string; trackingCarrier?: string; trackingUrl?: string }
  ): Promise<void> {
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const st = resolveOrderStatusFromFirestore(data);
      if (!isAwaitingShipment(st) && st !== 'shipped' && st !== 'delivered') {
        throw new Error('Shipment details can only be edited for active fulfillment orders');
      }
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp(), shippingStatus: deleteField() };
      if (fields.trackingNumber !== undefined) patch.trackingNumber = fields.trackingNumber.trim();
      if (fields.trackingCarrier !== undefined) patch.trackingCarrier = fields.trackingCarrier.trim();
      if (fields.trackingUrl !== undefined) {
        const u = fields.trackingUrl.trim();
        patch.trackingUrl = u ? u : deleteField();
      }
      tx.update(ref, patch);
    });
  },

  async appendPackageTrackingPhoto(orderDocId: string, photo: OrderPackageTrackingPhoto): Promise<void> {
    if (!photo.id?.trim() || !photo.url?.trim()) throw new Error('Photo id and url are required');
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const st = resolveOrderStatusFromFirestore(data);
      if (st === 'cancelled' || st === 'returned') {
        throw new Error('Cannot attach photos to cancelled or returned orders');
      }
      tx.update(ref, {
        packageTrackingPhotos: arrayUnion({
          id: photo.id.trim(),
          url: photo.url.trim(),
          ...(photo.caption?.trim() ? { caption: photo.caption.trim() } : {}),
          uploadedAt: photo.uploadedAt.trim() || new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });
    });
  },

  async removePackageTrackingPhoto(orderDocId: string, photoId: string): Promise<void> {
    const id = photoId.trim();
    if (!id) throw new Error('Photo id required');
    const ref = doc(db, COLLECTION, orderDocId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Order not found');
      const data = snap.data() as Record<string, unknown>;
      const raw = data.packageTrackingPhotos;
      const list: OrderPackageTrackingPhoto[] = Array.isArray(raw)
        ? raw
            .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
            .map(
              (p): OrderPackageTrackingPhoto => ({
                id: String(p.id ?? ''),
                url: String(p.url ?? ''),
                caption: p.caption != null ? String(p.caption) : undefined,
                uploadedAt: String(p.uploadedAt ?? ''),
              })
            )
        : [];
      const next = list.filter(p => p.id !== id);
      if (next.length === list.length) throw new Error('Photo not found');
      tx.update(ref, {
        packageTrackingPhotos: next,
        updatedAt: serverTimestamp(),
      });
    });
  },
};
