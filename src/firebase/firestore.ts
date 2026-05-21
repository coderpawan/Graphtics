import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { Address, CommunicationPreferences, Coupon, NotificationSettings, Order, Product, Review, UserPreferences, UserProfile } from '../types';

const productsCollection = collection(db, 'products');
const usersCollection = collection(db, 'users');
const ordersCollection = collection(db, 'orders');
const couponsCollection = collection(db, 'coupons');
const reviewsCollection = collection(db, 'reviews');

export const getAllProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(productsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Product, 'id'>) }));
};

export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  const q = query(productsCollection, where('category', '==', category));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Product, 'id'>) }));
};

export const getProductsByIds = async (ids: string[]): Promise<Product[]> => {
  if (!ids.length) return [];
  const documents = await Promise.all(ids.map(id => getDoc(doc(productsCollection, id))));
  return documents
    .filter(snapshot => snapshot.exists())
    .map(snapshot => ({ id: snapshot.id, ...(snapshot.data() as Omit<Product, 'id'>) }));
};

export const getCategories = async (): Promise<string[]> => {
  const snapshot = await getDocs(productsCollection);
  const categories = new Set<string>();
  snapshot.docs.forEach(doc => {
    const data = doc.data() as Pick<Product, 'category'>;
    if (data.category) categories.add(data.category);
  });
  return Array.from(categories);
};

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  const q = query(productsCollection, where('slug', '==', slug));
  const snapshot = await getDocs(q);
  if (!snapshot.docs.length) return null;
  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() as Omit<Product, 'id'>) };
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
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Order, 'id'>) }));
};

export const getOrdersByUser = async (uid: string): Promise<Order[]> => {
  const q = query(ordersCollection, where('userId', '==', uid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Order, 'id'>) }));
};

export const createOrder = async (order: Omit<Order, 'id'>) => {
  const docRef = await addDoc(ordersCollection, { ...order, createdAt: serverTimestamp() });
  return docRef.id;
};

export const updateOrderStatus = async (orderId: string, status: Order['status']) => {
  const orderDoc = doc(ordersCollection, orderId);
  await updateDoc(orderDoc, { status, updatedAt: serverTimestamp() });
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

export const getReviews = async (): Promise<Review[]> => {
  const snapshot = await getDocs(reviewsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Review, 'id'>) }));
};

export const updateUserWishlist = async (uid: string, productId: string, add = true) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, add ? { wishlist: arrayUnion(productId) } : { wishlist: arrayRemove(productId) });
};

export const updateUserRecentlyViewed = async (uid: string, productId: string) => {
  const userDoc = doc(usersCollection, uid);
  await updateDoc(userDoc, {
    recentlyViewed: arrayUnion(productId),
    updatedAt: serverTimestamp(),
  });
};
