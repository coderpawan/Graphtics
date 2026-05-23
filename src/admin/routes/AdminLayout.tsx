/**
 * Shell for all `/admin/*` pages: provider + suspense + outlet.
 */

import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { AdminProvider } from '../context/AdminContext';

export function AdminLayout() {
  return (
    <AdminProvider>
      <Suspense fallback={<LoadingScreen variant="admin" />}>
        <Outlet />
      </Suspense>
    </AdminProvider>
  );
}
