/**
 * Admin Context — session-based admin access (no Firestore gate on load).
 * Optional Firebase sign-out on logout keeps store session separate.
 */

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { auth } from '../../firebase/config';
import type { AdminUser } from '../types';
import {
  clearAdminSession,
  createLocalSuperAdmin,
  credentialsMatch,
  isAdminSessionStored,
  persistAdminSession,
} from '../auth/localAdminSession';

interface AdminContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function initialAdminUser(): AdminUser | null {
  return isAdminSessionStored() ? createLocalSuperAdmin() : null;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(initialAdminUser);
  /** Reserved for future async admin bootstrap; keep false so routes render immediately */
  const [loading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    if (!credentialsMatch(username, password)) {
      throw new Error('Invalid credentials');
    }
    persistAdminSession();
    setAdminUser(createLocalSuperAdmin());
  }, []);

  const logout = useCallback(async () => {
    clearAdminSession();
    setAdminUser(null);
    try {
      await auth.signOut();
    } catch {
      /* ignore */
    }
  }, []);

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!adminUser) return false;
    if (adminUser.role === 'super-admin') return true;
    return adminUser.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  }, [adminUser]);

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        loading,
        isAdmin: !!adminUser,
        hasPermission,
        login,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminProvider');
  }
  return context;
}
