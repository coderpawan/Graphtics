/**
 * Admin Panel Index - Export all admin functionality
 */

// Export components
export * from './components';

// Export context
export { AdminProvider, useAdminAuth } from './context';

// Export hooks
export {
  useAdminProducts,
  useAdminProduct,
  useAdminOrders,
  useAdminOrder,
  useAdminCustomers,
  useAdminCustomer,
  useAdminInventory,
  useSalesAnalytics,
  useDebouncedSearch,
} from './hooks';

// Export services
export {
  productService,
  orderService,
  customerService,
  inventoryService,
  analyticsService,
  activityService,
  reportService,
  storageService,
} from './services';

// Export store
export { useAdminStore } from './store/adminStore';

// Export types
export type {
  AdminRole,
  AdminUser,
  Permission,
  AdminProduct,
  ProductImage,
  ProductVariant,
  AdminOrder,
  OrderItem,
  ReturnRequest,
  Address,
  AdminCustomer,
  InventoryItem,
  InventoryAuditLog,
  SalesAnalytics,
  ProductSales,
  CategorySales,
  SalesTrendData,
  ChartData,
  FinancialReport,
  ActivityLog,
  DashboardMetrics,
  DashboardChartData,
} from './types';

// Export utilities
export {
  formatCurrency,
  formatDate,
  formatDateTime,
  getOrderStatusColor,
  getInventoryStatusColor,
  calculateProfitMargin,
  calculateDiscountPercentage,
  formatSKU,
  generateSKU,
  validateProduct,
  exportToCSV,
  exportToJSON,
  calculatePagination,
  debounce,
  hasPermission,
  truncate,
  calculateRevenueMetrics,
} from './utils/helpers';

// Export routes
export { AdminRoutes } from './routes/AdminRoutes';
export { AdminProtectedRoute } from './routes/AdminProtectedRoute';
