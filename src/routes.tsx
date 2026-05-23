import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminLayout } from './admin/routes/AdminLayout';
import { AdminProtectedRoute } from './admin/routes/AdminProtectedRoute';

const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));

const AdminLogin = lazy(() => import('./admin/pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./admin/pages/dashboard/AdminDashboard'));
const ProductsList = lazy(() => import('./admin/pages/products/ProductsList'));
const ProductFormPage = lazy(() => import('./admin/pages/products/ProductFormPage'));
const CategoriesPage = lazy(() => import('./admin/pages/products/CategoriesPage'));
const OrdersList = lazy(() => import('./admin/pages/orders/OrdersList'));
const OrdersReturnsPage = lazy(() => import('./admin/pages/orders/OrdersReturnsPage'));
const OrderDetailPage = lazy(() => import('./admin/pages/orders/OrderDetailPage'));
const CustomersList = lazy(() => import('./admin/pages/customers/CustomersList'));
const VipCustomersPage = lazy(() => import('./admin/pages/customers/VipCustomersPage'));
const CustomerDetailPage = lazy(() => import('./admin/pages/customers/CustomerDetailPage'));
const InventoryList = lazy(() => import('./admin/pages/inventory/InventoryList'));
const LowStockAlertsPage = lazy(() => import('./admin/pages/inventory/LowStockAlertsPage'));
const StockLedgerPage = lazy(() => import('./admin/pages/inventory/StockLedgerPage'));
const AnalyticsDashboard = lazy(() => import('./admin/pages/analytics/AnalyticsDashboard'));
const ReportsExportPage = lazy(() => import('./admin/pages/reports/ReportsExportPage'));
const SettingsAdminPage = lazy(() => import('./admin/pages/settings/SettingsAdminPage'));
const ComplaintsPage = lazy(() => import('./admin/pages/support/ComplaintsPage'));

export function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/category/:category" element={<CategoryPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="login" element={<AdminLogin />} />
          <Route
            path="dashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="products"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <ProductsList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="products/categories"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <CategoriesPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="products/new"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <ProductFormPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="products/:id/edit"
            element={
              <AdminProtectedRoute requiredRole="product-manager">
                <ProductFormPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <AdminProtectedRoute>
                <OrdersList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="orders/returns"
            element={
              <AdminProtectedRoute>
                <OrdersReturnsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <AdminProtectedRoute>
                <OrderDetailPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="customers"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <CustomersList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="customers/vip"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <VipCustomersPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="customers/:id"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <CustomerDetailPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <AdminProtectedRoute requiredRole="inventory-manager">
                <InventoryList />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="inventory/alerts"
            element={
              <AdminProtectedRoute requiredRole="inventory-manager">
                <LowStockAlertsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="inventory/ledger"
            element={
              <AdminProtectedRoute requiredRole="inventory-manager">
                <StockLedgerPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <AdminProtectedRoute>
                <AnalyticsDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <ReportsExportPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="reports/sales"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <ReportsExportPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="reports/financial"
            element={
              <AdminProtectedRoute requiredRole="finance-manager">
                <ReportsExportPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="support/complaints"
            element={
              <AdminProtectedRoute requiredRole="customer-support">
                <ComplaintsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <AdminProtectedRoute requiredRole="super-admin">
                <SettingsAdminPage />
              </AdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
