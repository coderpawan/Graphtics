/**
 * Admin Utilities - Helper functions for admin operations
 */

import type { AdminProduct, AdminOrder, OrderStatus } from '../types';

// Format currency
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format date with time
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get order status badge color
export function getOrderStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Get inventory status color
export function getInventoryStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'in-stock': 'bg-green-100 text-green-800',
    'low-stock': 'bg-yellow-100 text-yellow-800',
    'out-of-stock': 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Calculate profit margin
export function calculateProfitMargin(cost: number, retail: number): number {
  if (retail === 0) return 0;
  return ((retail - cost) / retail) * 100;
}

// Calculate discount percentage
export function calculateDiscountPercentage(original: number, discounted: number): number {
  if (original === 0) return 0;
  return ((original - discounted) / original) * 100;
}

// Format SKU
export function formatSKU(sku: string): string {
  return sku.toUpperCase();
}

// Generate SKU
export function generateSKU(productName: string, variant?: string): string {
  const name = productName
    .split(' ')
    .map((word) => word.substring(0, 2).toUpperCase())
    .join('');

  const timestamp = Date.now().toString().substring(7);
  const variantCode = variant ? variant.substring(0, 2).toUpperCase() : 'XX';

  return `${name}-${variantCode}-${timestamp}`;
}

// Validate product
export function validateProduct(product: Partial<AdminProduct>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!product.sku || product.sku.trim().length === 0) {
    errors.push('SKU is required');
  }

  if (!product.category || product.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (!product.price || product.price.retail <= 0) {
    errors.push('Retail price must be greater than 0');
  }

  if (product.price && product.price.cost && product.price.cost >= product.price.retail) {
    errors.push('Cost price must be less than retail price');
  }

  if (!product.images || product.images.length === 0) {
    errors.push('At least one product image is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export data to CSV
export function exportToCSV(data: any[], filename: string = 'export.csv'): void {
  if (data.length === 0) return;

  // Get all unique keys
  const headers = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value || '');
          return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Export data to JSON
export function exportToJSON(data: any[], filename: string = 'export.json'): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Calculate pagination
export function calculatePagination(total: number, limit: number, page: number) {
  return {
    total,
    limit,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
    offset: (page - 1) * limit,
  };
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Check if admin has permission
export function hasPermission(role: string, resource: string, action: string): boolean {
  const rolePermissions: Record<string, Array<[string, string]>> = {
    'super-admin': [['*', '*']],
    'product-manager': [
      ['products', 'create'],
      ['products', 'read'],
      ['products', 'update'],
      ['products', 'delete'],
      ['products', 'export'],
    ],
    'inventory-manager': [
      ['inventory', 'read'],
      ['inventory', 'update'],
      ['inventory', 'export'],
    ],
    'finance-manager': [
      ['orders', 'read'],
      ['reports', 'read'],
      ['reports', 'export'],
    ],
    'customer-support': [
      ['customers', 'read'],
      ['orders', 'read'],
      ['orders', 'update'],
    ],
  };

  const permissions = rolePermissions[role] || [];
  return permissions.some(([r, a]) => (r === '*' && a === '*') || (r === resource && a === action));
}

// Truncate text
export function truncate(text: string, maxLength: number = 50): string {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

// Calculate revenue metrics
export function calculateRevenueMetrics(orders: AdminOrder[]) {
  return {
    totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    totalTax: orders.reduce((sum, o) => sum + (o.tax || 0), 0),
    totalShipping: orders.reduce((sum, o) => sum + (o.shipping || 0), 0),
    totalDiscounts: orders.reduce((sum, o) => sum + (o.items.reduce((itemSum, i) => itemSum + (i.discount || 0), 0)), 0),
    totalOrders: orders.length,
    averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length : 0,
  };
}
