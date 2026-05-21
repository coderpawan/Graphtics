/**
 * Admin Store - Zustand store for admin state management
 */

import { create } from 'zustand';
import type { AdminProduct, AdminOrder, AdminCustomer, InventoryItem, ActivityLog } from '../types';

interface AdminState {
  // UI State
  sidebarOpen: boolean;
  darkMode: boolean;
  
  // Data State
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  inventory: InventoryItem[];
  activityLogs: ActivityLog[];
  
  // Loading States
  productsLoading: boolean;
  ordersLoading: boolean;
  customersLoading: boolean;
  inventoryLoading: boolean;
  
  // Filters & Pagination
  productFilters: {
    search: string;
    category: string;
    status: string;
    page: number;
    limit: number;
  };
  orderFilters: {
    search: string;
    status: string;
    dateRange: { from: Date | null; to: Date | null };
    page: number;
    limit: number;
  };
  customerFilters: {
    search: string;
    status: string;
    page: number;
    limit: number;
  };

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setDarkMode: (dark: boolean) => void;
  
  setProducts: (products: AdminProduct[]) => void;
  setOrders: (orders: AdminOrder[]) => void;
  setCustomers: (customers: AdminCustomer[]) => void;
  setInventory: (inventory: InventoryItem[]) => void;
  
  setProductsLoading: (loading: boolean) => void;
  setOrdersLoading: (loading: boolean) => void;
  setCustomersLoading: (loading: boolean) => void;
  setInventoryLoading: (loading: boolean) => void;
  
  updateProductFilters: (filters: Partial<AdminState['productFilters']>) => void;
  updateOrderFilters: (filters: Partial<AdminState['orderFilters']>) => void;
  updateCustomerFilters: (filters: Partial<AdminState['customerFilters']>) => void;
  
  addProduct: (product: AdminProduct) => void;
  updateProduct: (product: AdminProduct) => void;
  deleteProduct: (productId: string) => void;
  
  addOrder: (order: AdminOrder) => void;
  updateOrder: (order: AdminOrder) => void;
  
  addCustomer: (customer: AdminCustomer) => void;
  updateCustomer: (customer: AdminCustomer) => void;
  
  addActivityLog: (log: ActivityLog) => void;
  clearActivityLogs: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  // Initial state
  sidebarOpen: true,
  darkMode: false,
  
  products: [],
  orders: [],
  customers: [],
  inventory: [],
  activityLogs: [],
  
  productsLoading: false,
  ordersLoading: false,
  customersLoading: false,
  inventoryLoading: false,
  
  productFilters: {
    search: '',
    category: '',
    status: 'published',
    page: 1,
    limit: 20,
  },
  orderFilters: {
    search: '',
    status: '',
    dateRange: { from: null, to: null },
    page: 1,
    limit: 20,
  },
  customerFilters: {
    search: '',
    status: 'active',
    page: 1,
    limit: 20,
  },

  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setDarkMode: (dark) => set({ darkMode: dark }),
  
  setProducts: (products) => set({ products }),
  setOrders: (orders) => set({ orders }),
  setCustomers: (customers) => set({ customers }),
  setInventory: (inventory) => set({ inventory }),
  
  setProductsLoading: (loading) => set({ productsLoading: loading }),
  setOrdersLoading: (loading) => set({ ordersLoading: loading }),
  setCustomersLoading: (loading) => set({ customersLoading: loading }),
  setInventoryLoading: (loading) => set({ inventoryLoading: loading }),
  
  updateProductFilters: (filters) =>
    set((state) => ({
      productFilters: { ...state.productFilters, ...filters },
    })),
  
  updateOrderFilters: (filters) =>
    set((state) => ({
      orderFilters: { ...state.orderFilters, ...filters },
    })),
  
  updateCustomerFilters: (filters) =>
    set((state) => ({
      customerFilters: { ...state.customerFilters, ...filters },
    })),
  
  addProduct: (product) =>
    set((state) => ({
      products: [product, ...state.products],
    })),
  
  updateProduct: (product) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === product.id ? product : p)),
    })),
  
  deleteProduct: (productId) =>
    set((state) => ({
      products: state.products.filter((p) => p.id !== productId),
    })),
  
  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders],
    })),
  
  updateOrder: (order) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === order.id ? order : o)),
    })),
  
  addCustomer: (customer) =>
    set((state) => ({
      customers: [customer, ...state.customers],
    })),
  
  updateCustomer: (customer) =>
    set((state) => ({
      customers: state.customers.map((c) => (c.id === customer.id ? customer : c)),
    })),
  
  addActivityLog: (log) =>
    set((state) => ({
      activityLogs: [log, ...state.activityLogs.slice(0, 99)],
    })),
  
  clearActivityLogs: () => set({ activityLogs: [] }),
}));
