import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const createOrder = functions.https.onCall(async (data, context) => {
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

export const triggerOrderNotification = functions.firestore.document('orders/{orderId}').onCreate(async (snapshot) => {
  const order = snapshot.data();
  console.log('New order placed', snapshot.id, order);
  return null;
});
