import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type {
  Address,
  CommunicationPreferences,
  Coupon,
  NotificationSettings,
  Order,
  OrderComplaint,
  OrderComplaintMessage,
  OrderComplaintStatus,
  OrderFulfillmentEvent,
  Product,
  Review,
  UserPreferences,
  UserProfile,
} from '../types';
import { buildCustomerReviewDocId } from '../lib/customerReviewDocId';
import { resolveOrderStatusFromFirestore } from '../lib/orderFirestoreStatus';
import { applyCheckoutStockInsideTransaction } from '../lib/orderInventoryTxn';
import { isDraftProductData, normalizeFirestoreProduct } from './normalizeStorefrontProduct';

const productsCollection = collection(db, 'products');
const usersCollection = collection(db, 'users');
const ordersCollection = collection(db, 'orders');
const couponsCollection = collection(db, 'coupons');
const reviewsCollection = collection(db, 'reviews');
const customersCollection = collection(db, 'customers');
const orderComplaintsCollection = collection(db, 'orderComplaints');

export const getAllProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(productsCollection);
  return snapshot.docs
    .filter(d => !isDraftProductData(d.data() as Record<string, unknown>))
    .map(d => normalizeFirestoreProduct(d.id, d.data() as Record<string, unknown>));
};

export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  const [legacySnap, adminSnap] = await Promise.all([
    getDocs(query(productsCollection, where('category', '==', category))),
    getDocs(query(productsCollection, where('categories', 'array-contains', category))),
  ]);
  const map = new Map<string, Product>();
  for (const d of legacySnap.docs) {
    const raw = d.data() as Record<string, unknown>;
    if (!isDraftProductData(raw)) map.set(d.id, normalizeFirestoreProduct(d.id, raw));
  }
  for (const d of adminSnap.docs) {
    const raw = d.data() as Record<string, unknown>;
    if (!isDraftProductData(raw)) map.set(d.id, normalizeFirestoreProduct(d.id, raw));
  }
  return Array.from(map.values());
};

export const getProductsByIds = async (ids: string[]): Promise<Product[]> => {
  if (!ids.length) return [];
  const documents = await Promise.all(ids.map(id => getDoc(doc(productsCollection, id))));
  return documents
    .filter(snapshot => snapshot.exists())
    .map(snapshot => normalizeFirestoreProduct(snapshot.id, snapshot.data() as Record<string, unknown>));
};

export const getCategories = async (): Promise<string[]> => {
  const snapshot = await getDocs(productsCollection);
  const categories = new Set<string>();
  snapshot.docs.forEach(d => {
    const data = d.data() as Record<string, unknown>;
    if (isDraftProductData(data)) return;
    const cat = typeof data.category === 'string' ? data.category.trim() : '';
    if (cat) categories.add(cat);
    if (Array.isArray(data.categories)) {
      data.categories.forEach(c => {
        if (typeof c === 'string' && c.trim()) categories.add(c.trim());
      });
    }
  });
  return Array.from(categories);
};

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  if (!slug.trim()) return null;
  const byId = await getDoc(doc(productsCollection, slug));
  if (byId.exists()) {
    const raw = byId.data() as Record<string, unknown>;
    if (isDraftProductData(raw)) return null;
    return normalizeFirestoreProduct(byId.id, raw);
  }
  const q = query(productsCollection, where('slug', '==', slug));
  const snapshot = await getDocs(q);
  if (!snapshot.docs.length) return null;
  const d = snapshot.docs[0];
  const raw = d.data() as Record<string, unknown>;
  if (isDraftProductData(raw)) return null;
  return normalizeFirestoreProduct(d.id, raw);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userDoc = doc(usersCollection, uid);
  const snapshot = await getDoc(userDoc);
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
};

export const syncUserProfile = async (profile: UserProfile) => {
  const userDoc = doc(usersCollection, profile.uid);
  await setDoc(userDoc, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
};

export const updateUserAddresses = async (uid: string, addresses: Address[]) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, { savedAddresses: addresses, updatedAt: serverTimestamp() });
};

export const updateUserPreferences = async (uid: string, preferences: Partial<UserPreferences>) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, { preferences, updatedAt: serverTimestamp() });
};

export const updateUserNotifications = async (uid: string, notifications: Partial<NotificationSettings>) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, { notifications, updatedAt: serverTimestamp() });
};

export const updateUserCommunicationPreferences = async (uid: string, communicationPreferences: Partial<CommunicationPreferences>) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, { communicationPreferences, updatedAt: serverTimestamp() });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snapshot = await getDocs(usersCollection);
  return snapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as Omit<UserProfile, 'uid'>) }));
};

export const getOrders = async (): Promise<Order[]> => {
  const snapshot = await getDocs(query(ordersCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => {
    const raw = doc.data() as Record<string, unknown>;
    const row = { id: doc.id, ...(raw as Omit<Order, 'id'>) };
    return { ...row, status: resolveOrderStatusFromFirestore(raw) };
  });
};

function orderPlacedTimeMs(data: Omit<Order, 'id'>): number {
  if (data.placedAt) {
    const t = new Date(data.placedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const created = (data as unknown as { createdAt?: { toMillis?: () => number } }).createdAt;
  if (created && typeof created.toMillis === 'function') return created.toMillis();
  return 0;
}

/**
 * Loads orders for the signed-in customer. Uses equality on `userId` only (no composite index),
 * then sorts by `placedAt` / `createdAt` in memory so the query works without deploying indexes.
 */
export const getOrdersByUser = async (uid: string): Promise<Order[]> => {
  const q = query(ordersCollection, where('userId', '==', uid));
  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>;
    const row = { id: d.id, ...(raw as Omit<Order, 'id'>) };
    const resolved = resolveOrderStatusFromFirestore(raw);
    return { ...row, status: resolved };
  });
  return orders.sort((a, b) => orderPlacedTimeMs(b) - orderPlacedTimeMs(a));
};

export function generateOrderReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GRP-${ts}-${rand}`;
}

export const createOrder = async (order: Omit<Order, 'id'>) => {
  const placed = order.placedAt || new Date().toISOString();
  const initialEvent: OrderFulfillmentEvent = {
    at: placed,
    status: order.status,
    actor: 'customer',
    note: 'Order placed',
  };
  const orderRef = doc(ordersCollection);
  const orderIdHuman = order.orderId?.trim() || generateOrderReference();

  const payload = {
    ...order,
    orderId: orderIdHuman,
    fulfillmentEvents: order.fulfillmentEvents?.length ? order.fulfillmentEvents : [initialEvent],
    createdAt: serverTimestamp(),
  };

  await runTransaction(db, async (tx) => {
    await applyCheckoutStockInsideTransaction(
      db,
      tx,
      order.items.map((i) => ({
        productId: i.productId,
        sku: i.sku,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
      })),
      { userId: order.userId, orderId: orderIdHuman }
    );
    tx.set(orderRef, payload);
  });

  return orderRef.id;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']) => {
  const orderDoc = doc(ordersCollection, orderId);
  const ev: OrderFulfillmentEvent = {
    at: new Date().toISOString(),
    status,
    actor: 'system',
    note: `Status set to ${status}`,
  };
  await updateDoc(orderDoc, {
    status,
    updatedAt: serverTimestamp(),
    fulfillmentEvents: arrayUnion(ev),
  });
};

const AWAITING_SHIPMENT: Order['status'][] = ['pending', 'confirmed', 'printed', 'packed'];

/**
 * Customer cancels before shipment. Enforced again in Firestore rules.
 */
export const customerCancelOrder = async (orderId: string, uid: string, reason?: string) => {
  const orderRef = doc(ordersCollection, orderId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as Record<string, unknown>;
    if (String(data.userId ?? '') !== uid) throw new Error('Not authorized');
    const st = resolveOrderStatusFromFirestore(data);
    if (st === 'cancelled') throw new Error('Order is already cancelled');
    if (!AWAITING_SHIPMENT.includes(st)) {
      throw new Error('This order can no longer be cancelled online. Contact support.');
    }
    const now = new Date().toISOString();
    const ev: OrderFulfillmentEvent = {
      at: now,
      status: 'cancelled',
      actor: 'customer',
      note: reason?.trim() ? `Cancelled by customer: ${reason.trim()}` : 'Cancelled by customer',
    };
    tx.update(orderRef, {
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: reason?.trim() ?? '',
      updatedAt: serverTimestamp(),
      fulfillmentEvents: arrayUnion(ev),
    });
  });
};

/**
 * Customer requests a return (admin approves / completes in dashboard).
 */
export const customerRequestOrderReturn = async (orderId: string, uid: string, reason: string) => {
  const orderRef = doc(ordersCollection, orderId);
  const trimmed = reason.trim();
  if (trimmed.length < 8) throw new Error('Please describe the issue in at least 8 characters.');

  await runTransaction(db, async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as Record<string, unknown>;
    if (String(data.userId ?? '') !== uid) throw new Error('Not authorized');
    const st = resolveOrderStatusFromFirestore(data);
    if (st === 'returned') throw new Error('This order is already marked as returned.');
    if (st !== 'shipped' && st !== 'delivered') {
      throw new Error('Returns can only be requested after the order has shipped.');
    }
    const existing = data.returnRequest as { status?: string } | undefined;
    if (existing?.status === 'pending') throw new Error('You already have a return request in progress.');
    if (existing?.status === 'approved' || existing?.status === 'completed') {
      throw new Error('A return has already been processed for this order.');
    }
    const now = new Date().toISOString();
    const ev: OrderFulfillmentEvent = {
      at: now,
      status: st,
      actor: 'customer',
      note: 'Customer requested a return',
    };
    tx.update(orderRef, {
      returnRequest: {
        status: 'pending',
        reason: trimmed,
        requestedAt: now,
      },
      updatedAt: serverTimestamp(),
      fulfillmentEvents: arrayUnion(ev),
    });
  });
};

export const createProduct = async (product: Omit<Product, 'id'>) => {
  const docRef = await addDoc(productsCollection, { ...product, createdAt: serverTimestamp() });
  return docRef.id;
};

export const updateProduct = async (productId: string, product: Partial<Product>) => {
  const productDoc = doc(productsCollection, productId);
  await updateDoc(productDoc, { ...product, updatedAt: serverTimestamp() });
};

export const deleteProduct = async (productId: string) => {
  const productDoc = doc(productsCollection, productId);
  await deleteDoc(productDoc);
};

export const getCoupons = async (): Promise<Coupon[]> => {
  const snapshot = await getDocs(couponsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Coupon, 'id'>) }));
};

export const createCoupon = async (coupon: Omit<Coupon, 'id'>) => {
  const docRef = await addDoc(couponsCollection, coupon);
  return docRef.id;
};

function tsToIso(v: unknown): string | undefined {
  if (
    v &&
    typeof v === 'object' &&
    'toDate' in (v as object) &&
    typeof (v as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === 'string') return v;
  return undefined;
}

export async function upsertCustomerFromOrder(args: {
  uid: string;
  email: string;
  name: string;
  phone: string;
  phoneAlt?: string;
  orderTotal: number;
}): Promise<void> {
  const ref = doc(customersCollection, args.uid);
  const snap = await getDoc(ref);
  const nameParts = args.name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '—';
  if (!snap.exists()) {
    await setDoc(ref, {
      email: args.email.trim().toLowerCase(),
      firstName,
      lastName,
      phone: args.phone.trim(),
      phoneAlt: args.phoneAlt?.trim() || '',
      status: 'active',
      totalOrders: 1,
      totalSpent: args.orderTotal,
      lastOrderDate: serverTimestamp(),
      registeredAt: serverTimestamp(),
      addresses: [],
      wishlistCount: 0,
    });
  } else {
    const prev = snap.data() as Record<string, unknown>;
    const prevAlt = typeof prev.phoneAlt === 'string' ? prev.phoneAlt : '';
    await updateDoc(ref, {
      email: args.email.trim().toLowerCase(),
      phone: args.phone.trim(),
      phoneAlt: args.phoneAlt?.trim() || prevAlt || '',
      firstName,
      lastName,
      totalOrders: increment(1),
      totalSpent: increment(args.orderTotal),
      lastOrderDate: serverTimestamp(),
    });
  }
}

function mapFirestoreReviewDoc(id: string, data: Record<string, unknown>): Review {
  const src = data.source === 'admin' ? 'admin' : 'customer';
  const imgs = Array.isArray(data.images)
    ? data.images.map(x => String(x ?? '').trim()).filter(Boolean)
    : [];
  return {
    id,
    author: String(data.author ?? 'Customer'),
    rating: Number(data.rating ?? 0),
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    date: String(data.date ?? new Date().toISOString()),
    source: src,
    ...(imgs.length ? { images: imgs } : {}),
    ...(typeof data.productId === 'string' ? { productId: data.productId } : {}),
  };
}

export const getReviewsForProduct = async (productId: string): Promise<Review[]> => {
  const q = query(reviewsCollection, where('productId', '==', productId));
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map(d => mapFirestoreReviewDoc(d.id, d.data() as Record<string, unknown>));
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const hasCustomerSubmittedReview = async (
  uid: string,
  orderFirestoreId: string,
  productId: string,
): Promise<boolean> => {
  const id = buildCustomerReviewDocId(uid, orderFirestoreId, productId);
  const snap = await getDoc(doc(reviewsCollection, id));
  return snap.exists();
};

export const submitCustomerProductReview = async (params: {
  uid: string;
  orderFirestoreId: string;
  productId: string;
  rating: number;
  title: string;
  content: string;
  authorName: string;
}): Promise<void> => {
  const docId = buildCustomerReviewDocId(params.uid, params.orderFirestoreId, params.productId);
  const reviewRef = doc(reviewsCollection, docId);
  const orderRef = doc(ordersCollection, params.orderFirestoreId);
  const r = Math.min(5, Math.max(1, Math.round(Number(params.rating))));
  const title = params.title.trim();
  const content = params.content.trim();
  if (content.length < 4) throw new Error('Please write at least a few words for your review.');
  await runTransaction(db, async tx => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found');
    const data = orderSnap.data() as Record<string, unknown>;
    if (String(data.userId ?? '') !== params.uid) throw new Error('Not authorized');
    const st = resolveOrderStatusFromFirestore(data);
    if (st !== 'delivered') {
      throw new Error('You can leave a review after your order is delivered.');
    }
    const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
    const hasProduct = items.some(it => String(it.productId ?? '') === params.productId);
    if (!hasProduct) throw new Error('This product is not on that order.');
    const existing = await tx.get(reviewRef);
    if (existing.exists()) throw new Error('You already reviewed this product for this order.');
    const now = new Date().toISOString();
    tx.set(reviewRef, {
      id: docId,
      author: params.authorName.trim() || 'Customer',
      rating: r,
      title,
      content,
      date: now,
      source: 'customer',
      productId: params.productId,
      userId: params.uid,
      orderFirestoreId: params.orderFirestoreId,
      createdAt: serverTimestamp(),
    });
  });
};

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function threadFromFirestoreData(x: Record<string, unknown>): OrderComplaintMessage[] {
  const raw = x.thread;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((entry, i) => {
        const m = entry as Record<string, unknown>;
        const body = String(m.body ?? '').trim();
        if (!body) return null;
        return {
          id: String(m.id ?? `m${i}`),
          author: m.author === 'admin' ? 'admin' : 'customer',
          body,
          createdAt:
            typeof m.createdAt === 'string' && m.createdAt
              ? m.createdAt
              : tsToIso(m.createdAt) ?? '',
        } as OrderComplaintMessage;
      })
      .filter((m): m is OrderComplaintMessage => m != null);
  }
  const msgs: OrderComplaintMessage[] = [];
  const msg = String(x.message ?? '').trim();
  const created = tsToIso(x.createdAt) ?? '';
  if (msg) msgs.push({ id: 'legacy-open', author: 'customer', body: msg, createdAt: created });
  const ar = x.adminResponse != null ? String(x.adminResponse).trim() : '';
  if (ar) msgs.push({ id: 'legacy-admin', author: 'admin', body: ar, createdAt: tsToIso(x.updatedAt) ?? created });
  return msgs;
}

function mapOrderComplaintDoc(id: string, x: Record<string, unknown>): OrderComplaint {
  return {
    id,
    orderFirestoreId: String(x.orderFirestoreId ?? ''),
    orderHumanId: String(x.orderHumanId ?? ''),
    userId: String(x.userId ?? ''),
    customerName: String(x.customerName ?? ''),
    customerEmail: String(x.customerEmail ?? ''),
    phone: String(x.phone ?? ''),
    phoneAlt: x.phoneAlt != null ? String(x.phoneAlt) : undefined,
    message: String(x.message ?? ''),
    status: (x.status as OrderComplaintStatus) || 'open',
    adminResponse: x.adminResponse != null ? String(x.adminResponse) : undefined,
    thread: threadFromFirestoreData(x),
    createdAt: tsToIso(x.createdAt),
    updatedAt: tsToIso(x.updatedAt),
    resolvedAt: x.resolvedAt != null ? tsToIso(x.resolvedAt) : undefined,
  };
}

/** Most recently updated complaint for this user + order (for one thread per order UX). */
export const getLatestOrderComplaintForUserOrder = async (
  uid: string,
  orderFirestoreId: string,
): Promise<OrderComplaint | null> => {
  const list = await getOrderComplaintsByUser(uid);
  const forOrder = list.filter(c => c.orderFirestoreId === orderFirestoreId);
  if (forOrder.length === 0) return null;
  forOrder.sort((a, b) => {
    const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return tb - ta;
  });
  return forOrder[0] ?? null;
};

export const appendCustomerOrderComplaintMessage = async (params: {
  complaintId: string;
  uid: string;
  body: string;
  phone?: string;
  phoneAlt?: string;
}): Promise<void> => {
  const body = params.body.trim();
  if (body.length < 4) throw new Error('Please write at least 4 characters.');
  const ref = doc(orderComplaintsCollection, params.complaintId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Complaint not found');
    const x = snap.data() as Record<string, unknown>;
    if (String(x.userId ?? '') !== params.uid) throw new Error('Not authorized');
    const thread = threadFromFirestoreData(x);
    thread.push({ id: newMessageId(), author: 'customer', body, createdAt: new Date().toISOString() });
    const st = (x.status as OrderComplaintStatus) || 'open';
    const reopen = st === 'closed' || st === 'resolved';
    const nextStatus: OrderComplaintStatus = reopen ? 'open' : st;
    const updates: Record<string, unknown> = {
      thread,
      message: String(x.message ?? ''),
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (reopen) updates.resolvedAt = deleteField();
    const ph = params.phone?.trim();
    if (ph != null && ph.length >= 8) updates.phone = ph;
    if (params.phoneAlt !== undefined) updates.phoneAlt = params.phoneAlt.trim();
    tx.update(ref, updates);
  });
};

export const createOrderComplaint = async (params: {
  uid: string;
  orderFirestoreId: string;
  orderHumanId: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  phoneAlt?: string;
  message: string;
}): Promise<string> => {
  const phone = params.phone.trim();
  if (phone.length < 8) throw new Error('Enter a valid phone number (at least 8 characters).');
  const msg = params.message.trim();
  if (msg.length < 8) throw new Error('Please describe your feedback in at least 8 characters.');
  const orderRef = doc(ordersCollection, params.orderFirestoreId);
  const o = await getDoc(orderRef);
  if (!o.exists()) throw new Error('Order not found');
  const od = o.data() as Record<string, unknown>;
  if (String(od.userId ?? '') !== params.uid) throw new Error('Not authorized');

  const existing = await getLatestOrderComplaintForUserOrder(params.uid, params.orderFirestoreId);
  if (existing) {
    await appendCustomerOrderComplaintMessage({
      complaintId: existing.id,
      uid: params.uid,
      body: msg,
      phone,
      phoneAlt: params.phoneAlt,
    });
    return existing.id;
  }

  const nowIso = new Date().toISOString();
  const ref = await addDoc(orderComplaintsCollection, {
    orderFirestoreId: params.orderFirestoreId,
    orderHumanId: params.orderHumanId,
    userId: params.uid,
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim().toLowerCase(),
    phone,
    phoneAlt: params.phoneAlt?.trim() || '',
    message: msg,
    thread: [{ id: newMessageId(), author: 'customer', body: msg, createdAt: nowIso }],
    status: 'open' as OrderComplaintStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getOrderComplaintsByUser = async (uid: string): Promise<OrderComplaint[]> => {
  const q = query(orderComplaintsCollection, where('userId', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => mapOrderComplaintDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
};

export const getAllOrderComplaints = async (): Promise<OrderComplaint[]> => {
  const snapshot = await getDocs(query(orderComplaintsCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(d => mapOrderComplaintDoc(d.id, d.data() as Record<string, unknown>));
};

export const updateOrderComplaintAdmin = async (
  complaintId: string,
  patch: { status?: OrderComplaintStatus; newAdminMessage?: string },
): Promise<void> => {
  const ref = doc(orderComplaintsCollection, complaintId);
  const reply = patch.newAdminMessage?.trim() ?? '';
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Complaint not found');
    const x = snap.data() as Record<string, unknown>;
    let thread = threadFromFirestoreData(x);
    if (reply) {
      thread = [
        ...thread,
        { id: newMessageId(), author: 'admin' as const, body: reply, createdAt: new Date().toISOString() },
      ];
    }
    const prevStatus = (x.status as OrderComplaintStatus) || 'open';
    const status = patch.status ?? prevStatus;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      thread,
      status,
      updatedAt: serverTimestamp(),
    };
    if (reply) updates.adminResponse = reply;
    if (status === 'resolved' || status === 'closed') updates.resolvedAt = now;
    else updates.resolvedAt = deleteField();
    tx.update(ref, updates);
  });
};

export const getReviews = async (): Promise<Review[]> => {
  const snapshot = await getDocs(reviewsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Review, 'id'>) }));
};

export const updateUserWishlist = async (uid: string, productId: string, add = true) => {
  const userDoc = doc(usersCollection, uid);
  await setDoc(
    userDoc,
    add
      ? { wishlist: arrayUnion(productId), updatedAt: serverTimestamp() }
      : { wishlist: arrayRemove(productId), updatedAt: serverTimestamp() },
    { merge: true },
  );
};

export const updateUserRecentlyViewed = async (uid: string, productId: string) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, {
    recentlyViewed: arrayUnion(productId),
    updatedAt: serverTimestamp(),
  });
};
