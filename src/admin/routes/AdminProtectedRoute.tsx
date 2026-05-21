/**
 * Admin Protected Route Component
 */

import { Navigate, useLocation } from 'react-router-dom';
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
  const { adminUser, loading, isAdmin, hasPermission } = useAdminAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Not authenticated
  if (!adminUser || !isAdmin) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRole && requiredRole !== 'super-admin') {
    if (adminUser.role !== 'super-admin' && adminUser.role !== requiredRole) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Access Denied
            </h1>
            <p className="text-slate-600 mb-6">
              You don't have permission to access this page.
            </p>
            <a
              href="/admin/dashboard"
              className="inline-block px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
