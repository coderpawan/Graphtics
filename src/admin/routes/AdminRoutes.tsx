/**
 * Admin routing — `useRoutes` so paths are relative to parent `/admin/*` (matches reliably).
 */

import { lazy, Suspense, useMemo, type ReactElement } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { AdminProtectedRoute } from './AdminProtectedRoute';

const AdminLogin = lazy(() => import('../pages/AdminLogin'));
const AdminDashboard = lazy(() => import('../pages/dashboard/AdminDashboard'));
const ProductsList = lazy(() => import('../pages/products/ProductsList'));
const ProductFormPage = lazy(() => import('../pages/products/ProductFormPage'));
const CategoriesPage = lazy(() => import('../pages/products/CategoriesPage'));
const OrdersList = lazy(() => import('../pages/orders/OrdersList'));
const OrdersReturnsPage = lazy(() => import('../pages/orders/OrdersReturnsPage'));
const CustomersList = lazy(() => import('../pages/customers/CustomersList'));
const InventoryList = lazy(() => import('../pages/inventory/InventoryList'));
const LowStockAlertsPage = lazy(() => import('../pages/inventory/LowStockAlertsPage'));
const StockLedgerPage = lazy(() => import('../pages/inventory/StockLedgerPage'));
const AnalyticsDashboard = lazy(() => import('../pages/analytics/AnalyticsDashboard'));
const ReportsExportPage = lazy(() => import('../pages/reports/ReportsExportPage'));
const OrderDetailPage = lazy(() => import('../pages/orders/OrderDetailPage'));
const CustomerDetailPage = lazy(() => import('../pages/customers/CustomerDetailPage'));
const VipCustomersPage = lazy(() => import('../pages/customers/VipCustomersPage'));
const ComplaintsPage = lazy(() => import('../pages/support/ComplaintsPage'));
const SettingsAdminPage = lazy(() => import('../pages/settings/SettingsAdminPage'));

/** Mount under `<AdminLayout />` from `src/routes.tsx` so `AdminProvider` wraps the tree once. */
export function AdminRoutes() {
  const routes = useMemo(
    () => [
      { index: true as const, element: <Navigate to="dashboard" replace /> },
        { path: 'login', element: <AdminLogin /> },
        {
          path: 'dashboard',
          element: (
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'products',
          element: (
            <AdminProtectedRoute requiredRole="product-manager">
              <ProductsList />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'products/categories',
          element: (
            <AdminProtectedRoute requiredRole="product-manager">
              <CategoriesPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'products/new',
          element: (
            <AdminProtectedRoute requiredRole="product-manager">
              <ProductFormPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'products/:id/edit',
          element: (
            <AdminProtectedRoute requiredRole="product-manager">
              <ProductFormPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'orders',
          element: (
            <AdminProtectedRoute>
              <OrdersList />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'orders/returns',
          element: (
            <AdminProtectedRoute>
              <OrdersReturnsPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'orders/:id',
          element: (
            <AdminProtectedRoute>
              <OrderDetailPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'customers',
          element: (
            <AdminProtectedRoute requiredRole="customer-support">
              <CustomersList />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'customers/vip',
          element: (
            <AdminProtectedRoute requiredRole="customer-support">
              <VipCustomersPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'customers/:id',
          element: (
            <AdminProtectedRoute requiredRole="customer-support">
              <CustomerDetailPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'inventory',
          element: (
            <AdminProtectedRoute requiredRole="inventory-manager">
              <InventoryList />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'inventory/alerts',
          element: (
            <AdminProtectedRoute requiredRole="inventory-manager">
              <LowStockAlertsPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'inventory/ledger',
          element: (
            <AdminProtectedRoute requiredRole="inventory-manager">
              <StockLedgerPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'analytics',
          element: (
            <AdminProtectedRoute>
              <AnalyticsDashboard />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'reports',
          element: (
            <AdminProtectedRoute requiredRole="finance-manager">
              <ReportsExportPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'reports/sales',
          element: (
            <AdminProtectedRoute requiredRole="finance-manager">
              <ReportsExportPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'reports/financial',
          element: (
            <AdminProtectedRoute requiredRole="finance-manager">
              <ReportsExportPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'support/complaints',
          element: (
            <AdminProtectedRoute requiredRole="customer-support">
              <ComplaintsPage />
            </AdminProtectedRoute>
          ),
        },
        {
          path: 'settings',
          element: (
            <AdminProtectedRoute requiredRole="super-admin">
              <SettingsAdminPage />
            </AdminProtectedRoute>
          ),
        },
        { path: '*', element: <Navigate to="/admin/dashboard" replace /> },
    ],
    []
  );

  const element: ReactElement | null = useRoutes(routes);

  return <Suspense fallback={<LoadingScreen variant="admin" />}>{element}</Suspense>;
}
