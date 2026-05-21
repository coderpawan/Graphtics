/**
 * Admin Inventory Page
 */

import { useState } from 'react';
import { AlertTriangle, Edit } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { DataTable, Button, Badge } from '../../components/shared/Components';
import { useAdminInventory } from '../../hooks/useAdmin';
import { getInventoryStatusColor } from '../../utils/helpers';

export default function AdminInventory() {
  const { inventory, loading } = useAdminInventory();
  const [filters, setFilters] = useState({
    status: '',
  });

  const filteredInventory = inventory.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });

  const lowStockCount = inventory.filter((i) => i.status === 'low-stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'out-of-stock').length;

  const columns = [
    {
      key: 'sku' as const,
      label: 'SKU',
      sortable: true,
    },
    {
      key: 'productName' as const,
      label: 'Product',
      sortable: true,
    },
    {
      key: 'quantity' as const,
      label: 'Total Stock',
      sortable: true,
    },
    {
      key: 'availableQuantity' as const,
      label: 'Available',
      sortable: true,
    },
    {
      key: 'reservedQuantity' as const,
      label: 'Reserved',
    },
    {
      key: 'reorderLevel' as const,
      label: 'Reorder Level',
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (status: string) => (
        <Badge
          text={status}
          variant={
            status === 'in-stock'
              ? 'success'
              : status === 'low-stock'
              ? 'warning'
              : 'error'
          }
        />
      ),
    },
    {
      key: 'id' as const,
      label: 'Actions',
      render: () => (
        <button className="p-1 hover:bg-slate-100 rounded transition-colors">
          <Edit className="w-4 h-4 text-slate-600" />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-600 mt-1">Monitor and manage stock levels</p>
        </div>

        {/* Alerts */}
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lowStockCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-yellow-900">
                    {lowStockCount} items running low on stock
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Please reorder these items to avoid stockouts
                  </p>
                </div>
              </div>
            )}

            {outOfStockCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">
                    {outOfStockCount} items are out of stock
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    These items need immediate restocking
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          {[
            { value: '', label: 'All Items' },
            { value: 'in-stock', label: 'In Stock' },
            { value: 'low-stock', label: 'Low Stock' },
            { value: 'out-of-stock', label: 'Out of Stock' },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilters({ status: status.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.status === status.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <DataTable
            columns={columns}
            data={filteredInventory}
            loading={loading}
            searchPlaceholder="Search by SKU or product name..."
          />
        </div>
      </div>
    </AdminLayout>
  );
}
