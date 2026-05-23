import type { AdminUser } from '../types';

export const ADMIN_SESSION_STORAGE_KEY = 'graphtics_admin_session';

/** Default demo credentials (override with VITE_ADMIN_USERNAME / VITE_ADMIN_PASSWORD) */
export const DEFAULT_ADMIN_USERNAME = 'Admin';
export const DEFAULT_ADMIN_PASSWORD = '1234567890';

export function isAdminSessionStored(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === '1';
}

export function persistAdminSession(): void {
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, '1');
}

export function clearAdminSession(): void {
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export function createLocalSuperAdmin(): AdminUser {
  const now = new Date();
  return {
    id: 'local-super-admin',
    email: 'admin@graphtics.local',
    name: 'Admin',
    role: 'super-admin',
    permissions: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function credentialsMatch(username: string, password: string): boolean {
  const expectedUser =
    (import.meta.env.VITE_ADMIN_USERNAME as string | undefined)?.trim() ||
    DEFAULT_ADMIN_USERNAME;
  const expectedPass =
    (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || DEFAULT_ADMIN_PASSWORD;
  return username.trim() === expectedUser && password === expectedPass;
}
