/**
 * Admin Hooks — clothing store Firestore schema (`StoreProduct`, `StoreOrder`).
 */

import { useCallback, useEffect, useState } from 'react';
import type { AdminCustomer } from '../types';
import type { StoreOrder, StoreProduct, StoreProductStatus, VariantInventoryRow } from '../types/store';
import {
  productService,
  orderService,
  customerService,
  analyticsService,
} from '../services';

function mapUiStatusToStore(status?: string): StoreProductStatus | '' {
  if (!status) return '';
  if (status === 'published' || status === 'active') return 'active';
  if (status === 'draft') return 'draft';
  return '';
}

export function useAdminProducts(filters?: { category?: string; status?: string }) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await productService.fetchPage({
        category: filters?.category,
        status: mapUiStatusToStore(filters?.status),
        pageSize: 100,
      });
      setProducts(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [filters?.category, filters?.status]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

export function useAdminProduct(productId: string) {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!productId) return;
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
    void run();
  }, [productId]);

  return { product, loading, error };
}

export function useAdminOrders(filters?: { awaitingShipment?: boolean; status?: string }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await orderService.fetchPage({
        awaitingShipment: filters?.awaitingShipment,
        status: (filters?.status as StoreOrder['status']) || '',
        pageSize: 80,
      });
      setOrders(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [filters?.awaitingShipment, filters?.status]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

export function useAdminOrder(orderId: string) {
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setError(null);
      setLoading(false);
      return;
    }
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
  }, [orderId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { order, loading, error, refetch };
}

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
    void fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, error, refetch: fetchCustomers };
}

export function useAdminCustomer(customerId: string) {
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!customerId) return;
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
    void run();
  }, [customerId]);

  return { customer, loading, error };
}

export function useAdminInventory() {
  const [inventory, setInventory] = useState<VariantInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const { rows } = await productService.fetchVariantInventoryPage({ pageSize: 80 });
      setInventory(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  return { inventory, loading, error, refetch: fetchInventory };
}

export function useSalesAnalytics(dateFrom?: Date, dateTo?: Date) {
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof analyticsService.getSalesAnalytics>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
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
    void run();
  }, [dateFrom, dateTo]);

  return { analytics, loading, error };
}

export function useDashboardSnapshot() {
  const [data, setData] = useState<{
    revenue: number;
    orderCount: number;
    outOfStockSkus: number;
    pendingShippingCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await analyticsService.getDashboardSnapshot();
      setData(snap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot: data, loading, error, refresh };
}

export function usePendingOrdersListener() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = orderService.subscribePendingShipping(
      (next) => {
        setOrders(next);
        setError(null);
      },
      12
    );
    return () => unsub();
  }, []);

  return { orders, error };
}

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
