/**
 * Admin Context - Manages admin authentication and state
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { AdminUser } from '../types';
import { useToast } from '../../components/ui/Toast';

interface AdminContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Fetch admin user data from Firestore
          const adminDocRef = doc(db, 'admins', firebaseUser.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (adminDocSnap.exists()) {
            const adminData = adminDocSnap.data() as AdminUser;
            setAdminUser(adminData);
          } else {
            // User is authenticated but not an admin
            setAdminUser(null);
          }
        } else {
          setAdminUser(null);
        }
      } catch (err) {
        console.error('Error loading admin user:', err);
        error('Failed to load admin profile');
        setAdminUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [error]);

  const hasPermission = (resource: string, action: string): boolean => {
    if (!adminUser) return false;

    // Super admin has all permissions
    if (adminUser.role === 'super-admin') return true;

    // Check specific permissions
    return adminUser.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setAdminUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      throw err;
    }
  };

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        loading,
        isAdmin: !!adminUser,
        hasPermission,
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
