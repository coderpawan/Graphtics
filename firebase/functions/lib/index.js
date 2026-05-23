"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerOrderNotification = exports.createOrder = exports.onProductCreateSyncRating = exports.onProductCuratedReviewsChangeSyncRating = exports.onCustomerReviewCreateSyncProductRating = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
function averageRatingOneDecimal(rows) {
    if (!rows.length)
        return 0;
    const sum = rows.reduce((acc, r) => acc + (Number.isFinite(r.rating) ? r.rating : 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
}
/** Curated + legacy embedded `reviews` on the product document (matches storefront normalizer order). */
function ratingRowsFromProductDoc(data) {
    const out = [];
    const curatedRaw = Array.isArray(data.curatedReviews) ? data.curatedReviews : [];
    for (let idx = 0; idx < curatedRaw.length; idx++) {
        const o = curatedRaw[idx];
        if (!o || typeof o !== 'object')
            continue;
        const row = o;
        out.push({
            id: String(row.id ?? `cur-${idx}`),
            rating: Math.min(5, Math.max(1, Number(row.rating ?? 5))),
        });
    }
    const embedded = Array.isArray(data.reviews) ? data.reviews : [];
    for (let idx = 0; idx < embedded.length; idx++) {
        const o = embedded[idx];
        if (!o || typeof o !== 'object')
            continue;
        const row = o;
        out.push({
            id: String(row.id ?? `emb-${idx}`),
            rating: Math.min(5, Math.max(1, Number(row.rating ?? 1))),
        });
    }
    return out;
}
function mergeById(local, remote) {
    const byId = new Map();
    for (const r of local)
        byId.set(r.id, r);
    for (const r of remote)
        byId.set(r.id, r);
    return [...byId.values()];
}
/**
 * Writes `products/{productId}.rating` as the one-decimal average of curated + embedded + `reviews` docs.
 * Skips when there are no merged reviews (keeps an existing manual rating).
 */
async function syncProductRatingFromReviews(productId) {
    const ref = db.collection('products').doc(productId);
    const snap = await ref.get();
    if (!snap.exists)
        return;
    const data = snap.data();
    if (data.status === 'draft')
        return;
    const local = ratingRowsFromProductDoc(data);
    const q = await db.collection('reviews').where('productId', '==', productId).get();
    const remote = q.docs.map(d => {
        const x = d.data();
        const r = Number(x.rating ?? 0);
        return { id: d.id, rating: Math.min(5, Math.max(1, Number.isFinite(r) ? r : 1)) };
    });
    const merged = mergeById(local, remote);
    if (!merged.length)
        return;
    const avg = averageRatingOneDecimal(merged);
    await ref.update({ rating: avg });
}
/** After a shopper review is created, refresh the denormalized product rating for grids / cards. */
exports.onCustomerReviewCreateSyncProductRating = functions.firestore
    .document('reviews/{reviewId}')
    .onCreate(async (snap) => {
    const pid = snap.data()?.productId;
    if (typeof pid !== 'string' || !pid.trim())
        return null;
    await syncProductRatingFromReviews(pid.trim());
    return null;
});
/** When admins change curated reviews on the product, recompute the aggregate rating. */
exports.onProductCuratedReviewsChangeSyncRating = functions.firestore
    .document('products/{productId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data()?.curatedReviews;
    const after = change.after.data()?.curatedReviews;
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null))
        return null;
    const productId = context.params.productId;
    await syncProductRatingFromReviews(productId);
    return null;
});
/** New products may ship with curated reviews on first write — align `rating` on create. */
exports.onProductCreateSyncRating = functions.firestore
    .document('products/{productId}')
    .onCreate(async (_snap, context) => {
    await syncProductRatingFromReviews(context.params.productId);
    return null;
});
exports.createOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const order = {
        ...data,
        userId: context.auth.uid,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const orderRef = await db.collection('orders').add(order);
    return { id: orderRef.id };
});
exports.triggerOrderNotification = functions.firestore.document('orders/{orderId}').onCreate(async (snapshot) => {
    const order = snapshot.data();
    console.log('New order placed', snapshot.id, order);
    return null;
});
//# sourceMappingURL=index.js.map