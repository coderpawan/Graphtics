/**
 * Admin System Type Definitions
 */

// Admin Roles and Permissions
export type AdminRole = 'super-admin' | 'product-manager' | 'inventory-manager' | 'finance-manager' | 'customer-support';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: AdminRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: 'products' | 'orders' | 'customers' | 'inventory' | 'analytics' | 'reports' | 'settings' | 'staff';
  action: 'create' | 'read' | 'update' | 'delete' | 'export';
}

// Product Management
export interface AdminProduct {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description: string;
  slug: string;
  category: string;
  subcategory: string;
  collection?: string;
  gender?: 'male' | 'female' | 'unisex';
  material?: string;
  fabricType?: string;
  fitType?: 'slim' | 'regular' | 'oversized' | 'skinny';
  price: {
    cost: number;
    retail: number;
    wholesale?: number;
  };
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    validFrom: Date;
    validUntil: Date;
  };
  images: ProductImage[];
  variants: ProductVariant[];
  tags: string[];
  seoMetadata: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
  status: 'draft' | 'published' | 'archived';
  inventory: {
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  price?: number;
  stock: number;
  images?: ProductImage[];
}

// Order Management
export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  paymentMethod: 'credit-card' | 'debit-card' | 'paypal' | 'stripe' | 'bank-transfer';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  shippingAddress: Address;
  billingAddress: Address;
  notes?: string;
  trackingNumber?: string;
  carrier?: string;
  returnRequests: ReturnRequest[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  subtotal: number;
}

export interface ReturnRequest {
  id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  refundAmount: number;
  requestedAt: Date;
  resolvedAt?: Date;
}

export interface Address {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

// Customer Management
export interface AdminCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'suspended' | 'blocked';
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  addresses: Address[];
  wishlistCount: number;
  registeredAt: Date;
  notes?: string;
}

// Inventory Management
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  lastRestocked?: Date;
  warehouse?: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

export interface InventoryAuditLog {
  id: string;
  itemId: string;
  action: 'add' | 'remove' | 'adjust' | 'return' | 'damage';
  quantityChange: number;
  reason?: string;
  user: string;
  timestamp: Date;
}

// Analytics & Reports
export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  refundRate: number;
  topProducts: ProductSales[];
  salesByCategory: CategorySales[];
  salesTrend: SalesTrendData[];
  chartData?: ChartData[];
}

export interface ProductSales {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  returnRate: number;
}

export interface CategorySales {
  category: string;
  sales: number;
  percentage: number;
}

export interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
  revenue: number;
}

export interface ChartData {
  label: string;
  value: number;
  percentage?: number;
}

// Accounting & Financial Reports
export interface FinancialReport {
  id: string;
  period: string; // YYYY-MM-DD to YYYY-MM-DD
  revenue: number;
  expenses: number;
  profit: number;
  tax: number;
  refunds: number;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  createdAt: Date;
}

// Activity & Audit Logs
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

// Admin Dashboard
export interface DashboardMetrics {
  todayRevenue: number;
  todayOrders: number;
  thisMonthRevenue: number;
  thisMonthOrders: number;
  pendingOrders: number;
  lowStockProducts: number;
  activeCustomers: number;
  topProducts: AdminProduct[];
}

export interface DashboardChartData {
  label: string;
  value: number;
  color?: string;
}
