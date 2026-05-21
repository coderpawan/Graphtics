/**
 * Admin Hooks - Custom React hooks for admin functionality
 */

import { useCallback, useState, useEffect } from 'react';
import type { AdminProduct, AdminOrder, AdminCustomer, InventoryItem } from '../types';
import {
  productService,
  orderService,
  customerService,
  inventoryService,
  analyticsService,
} from '../services';

// Hook for products
export function useAdminProducts(filters?: { category?: string; status?: string }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts(filters);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

// Hook for single product
export function useAdminProduct(productId: string) {
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const data = await productService.getProduct(productId);
        setProduct(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  return { product, loading, error };
}

// Hook for orders
export function useAdminOrders(filters?: { status?: string }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orderService.getOrders(filters);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

// Hook for single order
export function useAdminOrder(orderId: string) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        const data = await orderService.getOrder(orderId);
        setOrder(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch order');
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  return { order, loading, error };
}

// Hook for customers
export function useAdminCustomers(filters?: { status?: string }) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customerService.getCustomers(filters);
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, error, refetch: fetchCustomers };
}

// Hook for single customer
export function useAdminCustomer(customerId: string) {
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        setLoading(true);
        const data = await customerService.getCustomer(customerId);
        setCustomer(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch customer');
      } finally {
        setLoading(false);
      }
    }

    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  return { customer, loading, error };
}

// Hook for inventory
export function useAdminInventory(filters?: { status?: string }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getInventory(filters);
      setInventory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return { inventory, loading, error, refetch: fetchInventory };
}

// Hook for analytics
export function useSalesAnalytics(dateFrom?: Date, dateTo?: Date) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const data = await analyticsService.getSalesAnalytics(dateFrom, dateTo);
        setAnalytics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateFrom, dateTo]);

  return { analytics, loading, error };
}

// Hook for debounced search
export function useDebouncedSearch<T>(
  searchFn: (term: string) => Promise<T[]>,
  delay = 300
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const data = await searchFn(searchTerm);
        setResults(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, searchFn, delay]);

  return { searchTerm, setSearchTerm, results, loading, error };
}
