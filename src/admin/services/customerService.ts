/**
 * Admin Customer Service - Firebase operations for customers
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AdminCustomer } from '../types';

const COLLECTION = 'customers';

interface CustomerQueryOptions {
  search?: string;
  status?: string;
  limit?: number;
}

export const customerService = {
  // Get all customers with filters
  async getCustomers(options: CustomerQueryOptions = {}) {
    try {
      const constraints = [];

      if (options.status) {
        constraints.push(where('status', '==', options.status));
      }

      constraints.push(orderBy('registeredAt', 'desc'));
      constraints.push(limit(options.limit || 100));

      const q = query(collection(db, COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminCustomer));
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  // Search customers by email or name
  async searchCustomers(searchTerm: string) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('email', '>=', searchTerm.toLowerCase()),
        where('email', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminCustomer));
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  },

  // Get single customer
  async getCustomer(customerId: string) {
    try {
      const docRef = doc(db, COLLECTION, customerId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Customer not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as AdminCustomer;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  },

  // Update customer
  async updateCustomer(customerId: string, updates: Partial<AdminCustomer>) {
    try {
      const docRef = doc(db, COLLECTION, customerId);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  // Suspend customer
  async suspendCustomer(customerId: string, reason: string) {
    try {
      const docRef = doc(db, COLLECTION, customerId);
      await updateDoc(docRef, {
        status: 'suspended',
        suspensionReason: reason,
        suspendedAt: new Date(),
      });
    } catch (error) {
      console.error('Error suspending customer:', error);
      throw error;
    }
  },

  // Block customer
  async blockCustomer(customerId: string, reason: string) {
    try {
      const docRef = doc(db, COLLECTION, customerId);
      await updateDoc(docRef, {
        status: 'blocked',
        blockReason: reason,
        blockedAt: new Date(),
      });
    } catch (error) {
      console.error('Error blocking customer:', error);
      throw error;
    }
  },

  // Unblock customer
  async unblockCustomer(customerId: string) {
    try {
      const docRef = doc(db, COLLECTION, customerId);
      await updateDoc(docRef, {
        status: 'active',
        blockedAt: null,
        blockReason: null,
      });
    } catch (error) {
      console.error('Error unblocking customer:', error);
      throw error;
    }
  },

  // Get VIP customers (high spenders)
  async getVIPCustomers(minSpent = 5000) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('totalSpent', '>=', minSpent),
        where('status', '==', 'active'),
        orderBy('totalSpent', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminCustomer));
    } catch (error) {
      console.error('Error fetching VIP customers:', error);
      throw error;
    }
  },

  // Get customer statistics
  async getCustomerStatistics() {
    try {
      const q = query(collection(db, COLLECTION));
      const snapshot = await getDocs(q);
      const customers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminCustomer));

      const stats = {
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c) => c.status === 'active').length,
        suspendedCustomers: customers.filter((c) => c.status === 'suspended').length,
        blockedCustomers: customers.filter((c) => c.status === 'blocked').length,
        totalSpent: customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
        averageLifetimeValue: 0,
      };

      stats.averageLifetimeValue = stats.totalSpent / stats.totalCustomers || 0;

      return stats;
    } catch (error) {
      console.error('Error calculating customer statistics:', error);
      throw error;
    }
  },
};
