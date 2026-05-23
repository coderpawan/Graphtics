/**
 * Admin Protected Route Component
 */

import { Link, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAdminAuth } from '../context/AdminContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import type { AdminRole } from '../types';

interface AdminProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AdminRole;
}

export function AdminProtectedRoute({
  children,
  requiredRole,
}: AdminProtectedRouteProps) {
  const location = useLocation();
  const { adminUser, loading, isAdmin } = useAdminAuth();

  if (loading) {
    return <LoadingScreen variant="admin" />;
  }

  // Not authenticated — use admin login, not storefront /auth
  if (!adminUser || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Role-based access: super-admin may access any route except explicit super-admin-only is still only super-admin
  if (requiredRole) {
    const isSuper = adminUser.role === 'super-admin';
    const allowed =
      requiredRole === 'super-admin'
        ? isSuper
        : isSuper || adminUser.role === requiredRole;
    if (!allowed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-slate-900">Access denied</h1>
            <p className="mb-6 text-slate-600">You don&apos;t have permission to access this page.</p>
            <Link
              to="/admin/dashboard"
              className="inline-block rounded-lg bg-violet-600 px-6 py-2 text-white transition-colors hover:bg-violet-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
