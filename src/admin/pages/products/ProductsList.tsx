/**
 * Admin Products Page
 */

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { DataTable, Button, FormInput, Badge } from '../../components/shared/Components';
import { useAdminProducts } from '../../hooks/useAdmin';
import { formatCurrency } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

export default function AdminProducts() {
  const navigate = useNavigate();
  const { products, loading } = useAdminProducts();
  const [filters, setFilters] = useState({
    category: '',
    status: 'published',
  });

  const filteredProducts = products.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.status && p.status !== filters.status) return false;
    return true;
  });

  const columns = [
    {
      key: 'name' as const,
      label: 'Product Name',
      sortable: true,
    },
    {
      key: 'sku' as const,
      label: 'SKU',
    },
    {
      key: 'category' as const,
      label: 'Category',
    },
    {
      key: 'price' as const,
      label: 'Price',
      render: (price: any) => formatCurrency(price?.retail || 0),
    },
    {
      key: 'inventory' as const,
      label: 'Stock',
      render: (inv: any) => (
        <Badge
          text={inv?.availableStock || 0 > 0 ? `${inv?.availableStock} in stock` : 'Out of stock'}
          variant={inv?.availableStock || 0 > 10 ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (status: string) => (
        <Badge
          text={status}
          variant={status === 'published' ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'actions' as const,
      label: 'Actions',
      render: (_, product) => (
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-slate-100 rounded transition-colors">
            <Eye className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => navigate(`/admin/products/${product.id}/edit`)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-slate-600" />
          </button>
          <button className="p-1 hover:bg-red-50 rounded transition-colors">
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Products</h1>
            <p className="text-slate-600 mt-1">Manage your product catalog</p>
          </div>
          <Button
            onClick={() => navigate('/admin/products/new')}
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label="Search"
              placeholder="Search products..."
            />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Categories</option>
              <option value="shirts">Shirts</option>
              <option value="pants">Pants</option>
              <option value="accessories">Accessories</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <DataTable
            columns={columns}
            data={filteredProducts}
            loading={loading}
            onExport={() => {
              console.log('Export products');
            }}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
