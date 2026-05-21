/**
 * @deprecated This store is deprecated. Use `useAuth()` from AuthContext instead.
 * 
 * AuthContext provides the same functionality with better Firestore integration,
 * offline support, and automatic persistence. This store is kept for backward compatibility
 * but should not be used in new code.
 * 
 * Example:
 * ```tsx
 * import { useAuth } from '../context/AuthContext';
 * const { user, signIn, signUp, signOut } = useAuth();
 * ```
 */

import { create } from 'zustand';
import type { UserProfile } from '../types';

type AuthState = {
  user: UserProfile | null;
  token: string | null;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
};

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  token: null,
  setUser: user => set({ user }),
  setToken: token => set({ token }),
}));
