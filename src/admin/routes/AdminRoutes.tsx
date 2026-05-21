/**
 * Admin Routing System
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { AdminProvider } from '../context/AdminContext';
import { AdminProtectedRoute } from './AdminProtectedRoute';

// Lazy load admin pages
const AdminDashboard = lazy(() => import('../pages/dashboard/AdminDashboard'));
const ProductsList = lazy(() => import('../pages/products/ProductsList'));
const OrdersList = lazy(() => import('../pages/orders/OrdersList'));
const CustomersList = lazy(() => import('../pages/customers/CustomersList'));
const InventoryList = lazy(() => import('../pages/inventory/InventoryList'));

// Placeholder pages for future implementation
const AnalyticsPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-slate-600 mt-2">Coming soon...</p>
      </div>
    ),
  })
);

const ReportsPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-slate-600 mt-2">Coming soon...</p>
      </div>
    ),
  })
);

const SettingsPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-slate-600 mt-2">Coming soon...</p>
      </div>
    ),
  })
);

export function AdminRoutes() {
  return (
    <AdminProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />

          {/* Products */}
          <Route
            path="/products"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <ProductsList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/products/new"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Add Product</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/products/:id/edit"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Edit Product</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />

          {/* Orders */}
          <Route
            path="/orders"
            element={
              <AdminProtectedRoute>
                <OrdersList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <AdminProtectedRoute>
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Order Details</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/orders/returns"
            element={
              <AdminProtectedRoute>
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Returns</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />

          {/* Customers */}
          <Route
            path="/customers"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <CustomersList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Customer Details</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/customers/vip"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">VIP Customers</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />

          {/* Inventory */}
          <Route
            path="/inventory"
            element={
              <AdminProtectedRoute requiredRole="inventory-manager">
                <InventoryList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/inventory/alerts"
            element={
              <AdminProtectedRoute requiredRole="inventory-manager">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Low Stock Alerts</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />

          {/* Analytics */}
          <Route
            path="/analytics"
            element={
              <AdminProtectedRoute>
                <AnalyticsPage />
              </AdminProtectedRoute>
            }
          />

          {/* Reports */}
          <Route
            path="/reports"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <ReportsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/reports/sales"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Sales Reports</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/reports/financial"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <div className="p-8">
                  <h1 className="text-3xl font-bold">Financial Reports</h1>
                  <p className="text-slate-600 mt-2">Coming soon...</p>
                </div>
              </AdminProtectedRoute>
            }
          />

          {/* Settings */}
          <Route
            path="/settings"
            element={
              <AdminProtectedRoute requiredRole="super-admin">
                <SettingsPage />
              </AdminProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AdminProvider>
  );
}
