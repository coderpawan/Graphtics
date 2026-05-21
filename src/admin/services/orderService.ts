/**
 * Admin Order Service - Firebase operations for orders
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  QueryConstraint,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AdminOrder, OrderStatus } from '../types';

const COLLECTION = 'orders';

interface OrderQueryOptions {
  search?: string;
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export const orderService = {
  // Get all orders with filters
  async getOrders(options: OrderQueryOptions = {}) {
    try {
      const constraints: QueryConstraint[] = [];

      if (options.status) {
        constraints.push(where('status', '==', options.status));
      }

      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(options.limit || 20));

      const q = query(collection(db, COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminOrder));
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },

  // Get single order
  async getOrder(orderId: string) {
    try {
      const docRef = doc(db, COLLECTION, orderId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Order not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as AdminOrder;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  },

  // Update order status
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    try {
      const docRef = doc(db, COLLECTION, orderId);
      await updateDoc(docRef, {
        status,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  },

  // Update order
  async updateOrder(orderId: string, updates: Partial<AdminOrder>) {
    try {
      const docRef = doc(db, COLLECTION, orderId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  },

  // Get orders by customer
  async getOrdersByCustomer(customerId: string) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminOrder));
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      throw error;
    }
  },

  // Get pending orders
  async getPendingOrders() {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminOrder));
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      throw error;
    }
  },

  // Get return requests
  async getReturnRequests() {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('returnRequests', '!=', []),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminOrder));
    } catch (error) {
      console.error('Error fetching return requests:', error);
      throw error;
    }
  },

  // Process refund
  async processRefund(
    orderId: string,
    amount: number,
    reason: string
  ) {
    try {
      const docRef = doc(db, COLLECTION, orderId);
      await updateDoc(docRef, {
        paymentStatus: 'refunded',
        status: 'returned',
        updatedAt: new Date(),
        refundReason: reason,
        refundAmount: amount,
        refundProcessedAt: new Date(),
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  },

  // Get sales metrics
  async getSalesMetrics(dateFrom?: Date, dateTo?: Date) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('status', 'in', ['delivered', 'shipped']),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminOrder));

      const metrics = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        totalItems: orders.reduce((sum, o) => sum + o.items.length, 0),
        averageOrderValue: 0,
      };

      metrics.averageOrderValue = metrics.totalRevenue / metrics.totalOrders || 0;

      return metrics;
    } catch (error) {
      console.error('Error calculating sales metrics:', error);
      throw error;
    }
  },
};
