import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

const allowedRoles = ['super-admin', 'staff', 'designer', 'inventory-manager'];

export function AdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const authorized = isAdmin || allowedRoles.includes(user.role);
  return authorized ? children : <Navigate to="/" replace />;
}
