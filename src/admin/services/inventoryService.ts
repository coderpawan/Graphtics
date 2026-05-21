/**
 * Admin Inventory Service - Firebase operations for inventory
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  QueryConstraint,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { InventoryItem, InventoryAuditLog } from '../types';

const INVENTORY_COLLECTION = 'inventory';
const AUDIT_COLLECTION = 'inventoryAuditLogs';

interface InventoryQueryOptions {
  search?: string;
  status?: string;
  limit?: number;
}

export const inventoryService = {
  // Get all inventory items with filters
  async getInventory(options: InventoryQueryOptions = {}) {
    try {
      const constraints: QueryConstraint[] = [];

      if (options.status) {
        constraints.push(where('status', '==', options.status));
      }

      constraints.push(orderBy('productName', 'asc'));
      constraints.push(limit(options.limit || 50));

      const q = query(collection(db, INVENTORY_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      console.error('Error fetching inventory:', error);
      throw error;
    }
  },

  // Get single inventory item
  async getInventoryItem(itemId: string) {
    try {
      const docRef = doc(db, INVENTORY_COLLECTION, itemId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Inventory item not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as InventoryItem;
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      throw error;
    }
  },

  // Get inventory by product
  async getInventoryByProduct(productId: string) {
    try {
      const q = query(
        collection(db, INVENTORY_COLLECTION),
        where('productId', '==', productId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      console.error('Error fetching product inventory:', error);
      throw error;
    }
  },

  // Update inventory quantity
  async updateInventoryQuantity(
    itemId: string,
    newQuantity: number,
    reason: string
  ) {
    try {
      const docRef = doc(db, INVENTORY_COLLECTION, itemId);
      const item = await getDoc(docRef);

      if (!item.exists()) {
        throw new Error('Inventory item not found');
      }

      const currentQuantity = item.data().quantity;
      const change = newQuantity - currentQuantity;

      // Update inventory
      await updateDoc(docRef, {
        quantity: newQuantity,
        availableQuantity: Math.max(0, newQuantity - (item.data().reservedQuantity || 0)),
        status: newQuantity === 0 ? 'out-of-stock' : newQuantity < (item.data().reorderLevel || 10) ? 'low-stock' : 'in-stock',
        lastRestocked: new Date(),
      });

      // Add audit log
      await this.addAuditLog({
        itemId,
        action: 'adjust',
        quantityChange: change,
        reason,
        user: 'admin', // Should be replaced with actual user
        timestamp: new Date(),
      } as Omit<InventoryAuditLog, 'id'>);

      return newQuantity;
    } catch (error) {
      console.error('Error updating inventory quantity:', error);
      throw error;
    }
  },

  // Bulk update inventory
  async bulkUpdateInventory(updates: { itemId: string; quantity: number; reason: string }[]) {
    try {
      const promises = updates.map(({ itemId, quantity, reason }) =>
        this.updateInventoryQuantity(itemId, quantity, reason)
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Error bulk updating inventory:', error);
      throw error;
    }
  },

  // Get low stock items
  async getLowStockItems(threshold?: number) {
    try {
      const q = query(
        collection(db, INVENTORY_COLLECTION),
        where('status', 'in', ['low-stock', 'out-of-stock']),
        orderBy('availableQuantity', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      throw error;
    }
  },

  // Get out of stock items
  async getOutOfStockItems() {
    try {
      const q = query(
        collection(db, INVENTORY_COLLECTION),
        where('status', '==', 'out-of-stock')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      console.error('Error fetching out of stock items:', error);
      throw error;
    }
  },

  // Add audit log
  async addAuditLog(log: Omit<InventoryAuditLog, 'id'>) {
    try {
      const docRef = await addDoc(collection(db, AUDIT_COLLECTION), log);
      return {
        id: docRef.id,
        ...log,
      } as InventoryAuditLog;
    } catch (error) {
      console.error('Error adding audit log:', error);
      throw error;
    }
  },

  // Get audit logs for item
  async getAuditLogs(itemId: string) {
    try {
      const q = query(
        collection(db, AUDIT_COLLECTION),
        where('itemId', '==', itemId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryAuditLog));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  },

  // Get inventory statistics
  async getInventoryStatistics() {
    try {
      const q = query(collection(db, INVENTORY_COLLECTION));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));

      const stats = {
        totalItems: items.length,
        totalQuantity: items.reduce((sum, i) => sum + (i.quantity || 0), 0),
        totalAvailable: items.reduce((sum, i) => sum + (i.availableQuantity || 0), 0),
        totalReserved: items.reduce((sum, i) => sum + (i.reservedQuantity || 0), 0),
        lowStockCount: items.filter((i) => i.status === 'low-stock').length,
        outOfStockCount: items.filter((i) => i.status === 'out-of-stock').length,
      };

      return stats;
    } catch (error) {
      console.error('Error calculating inventory statistics:', error);
      throw error;
    }
  },
};
