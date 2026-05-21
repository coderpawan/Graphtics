/**
 * Admin Product Service - Firebase operations for products
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  QueryConstraint,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AdminProduct } from '../types';

const COLLECTION = 'products';

interface ProductQueryOptions {
  search?: string;
  category?: string;
  status?: string;
  limit?: number;
  startAfter?: DocumentSnapshot;
}

export const productService = {
  // Get all products with filters
  async getProducts(options: ProductQueryOptions = {}) {
    try {
      const constraints: QueryConstraint[] = [];

      if (options.status) {
        constraints.push(where('status', '==', options.status));
      }

      if (options.category) {
        constraints.push(where('category', '==', options.category));
      }

      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(options.limit || 20));

      if (options.startAfter) {
        constraints.push(startAfter(options.startAfter));
      }

      const q = query(collection(db, COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminProduct));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  // Search products by name or SKU
  async searchProducts(searchTerm: string) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminProduct));
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  },

  // Get single product
  async getProduct(productId: string) {
    try {
      const docRef = doc(db, COLLECTION, productId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Product not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as AdminProduct;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  // Create product
  async createProduct(product: Omit<AdminProduct, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...product,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id: docRef.id,
        ...product,
        createdAt: now,
        updatedAt: now,
      } as AdminProduct;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  // Update product
  async updateProduct(productId: string, updates: Partial<AdminProduct>) {
    try {
      const docRef = doc(db, COLLECTION, productId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });

      return {
        id: productId,
        ...updates,
      } as Partial<AdminProduct>;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  // Delete product (soft delete - archive)
  async deleteProduct(productId: string) {
    try {
      const docRef = doc(db, COLLECTION, productId);
      await updateDoc(docRef, {
        status: 'archived',
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // Bulk update products
  async bulkUpdateProducts(updates: { id: string; data: Partial<AdminProduct> }[]) {
    try {
      const promises = updates.map(({ id, data }) =>
        updateDoc(doc(db, COLLECTION, id), {
          ...data,
          updatedAt: new Date(),
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Error bulk updating products:', error);
      throw error;
    }
  },

  // Get products by category
  async getProductsByCategory(category: string) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('category', '==', category),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminProduct));
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  },

  // Get low stock products
  async getLowStockProducts(threshold = 10) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('inventory.availableStock', '<', threshold),
        where('status', '==', 'published')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminProduct));
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      throw error;
    }
  },

  // Get top selling products
  async getTopSellingProducts(limit = 10) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'published'),
        orderBy('unitsSold', 'desc'),
        limit(limit)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as AdminProduct));
    } catch (error) {
      console.error('Error fetching top selling products:', error);
      throw error;
    }
  },
};
