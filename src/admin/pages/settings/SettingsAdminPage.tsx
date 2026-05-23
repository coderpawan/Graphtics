/**
 * Admin settings — session & environment hints (super-admin only).
 */

import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button } from '../../components/shared/Components';
import { useAdminAuth } from '../../context/AdminContext';
import { DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME } from '../../auth/localAdminSession';

export default function SettingsAdminPage() {
  const { adminUser, logout } = useAdminAuth();

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="mt-1 text-slate-600">Admin session and sign-in reference.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Signed in as</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{adminUser?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-900">{adminUser?.role}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{adminUser?.email}</dd>
              </div>
            </dl>
            <Button className="mt-6" variant="danger" onClick={() => void logout()}>
              Sign out everywhere
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Default demo credentials</p>
            <p className="mt-2">
              Username: <code className="rounded bg-white/80 px-1">{DEFAULT_ADMIN_USERNAME}</code> — Password:{' '}
              <code className="rounded bg-white/80 px-1">{DEFAULT_ADMIN_PASSWORD}</code>
            </p>
            <p className="mt-2 text-amber-900">
              Override with <code className="text-xs">VITE_ADMIN_USERNAME</code> and{' '}
              <code className="text-xs">VITE_ADMIN_PASSWORD</code> in your <code className="text-xs">.env</code>.
            </p>
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
