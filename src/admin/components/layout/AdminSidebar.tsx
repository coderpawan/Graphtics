/**
 * Admin Sidebar Navigation
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Boxes,
  DollarSign,
  FileText,
} from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { useAdminAuth } from '../../context/AdminContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: Package,
    children: [
      { label: 'All Products', href: '/admin/products', icon: Package },
      { label: 'Add Product', href: '/admin/products/new', icon: Package },
      { label: 'Categories', href: '/admin/products/categories', icon: Package },
    ],
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    children: [
      { label: 'All Orders', href: '/admin/orders', icon: ShoppingCart },
      { label: 'Pending', href: '/admin/orders?status=pending', icon: ShoppingCart },
      { label: 'Returns', href: '/admin/orders/returns', icon: ShoppingCart },
    ],
  },
  {
    label: 'Inventory',
    href: '/admin/inventory',
    icon: Boxes,
    children: [
      { label: 'Stock matrix', href: '/admin/inventory', icon: Boxes },
      { label: 'Low stock alerts', href: '/admin/inventory/alerts', icon: Boxes },
      { label: 'Stock ledger', href: '/admin/inventory/ledger', icon: Boxes },
    ],
  },
  {
    label: 'Customers',
    href: '/admin/customers',
    icon: Users,
    children: [
      { label: 'All Customers', href: '/admin/customers', icon: Users },
      { label: 'VIP Customers', href: '/admin/customers/vip', icon: Users },
    ],
  },
  {
    label: 'Support',
    href: '/admin/support/complaints',
    icon: FileText,
    children: [
      { label: 'Complaints & redressal', href: '/admin/support/complaints', icon: FileText },
    ],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: FileText,
    children: [
      { label: 'Sales Reports', href: '/admin/reports/sales', icon: FileText },
      { label: 'Financial Reports', href: '/admin/reports/financial', icon: DollarSign },
    ],
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useAdminStore();
  const { logout } = useAdminAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (label: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return isActive(item.href);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen z-40 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0 md:z-0 bg-slate-900 text-white w-64 flex flex-col`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <Link to="/admin/dashboard" className="font-bold text-xl">
            Graphtics
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => (
            <div key={item.label}>
              <button
                onClick={() => {
                  if (item.children) {
                    toggleExpanded(item.label);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isParentActive(item)
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Link to={item.href} className="flex items-center flex-1">
                  <item.icon className="w-4 h-4 mr-3" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
                {item.children && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${expandedItems.has(item.label) ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {/* Children */}
              {item.children && expandedItems.has(item.label) && (
                <div className="ml-3 mt-1 space-y-1 border-l border-slate-700">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      to={child.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive(child.href)
                          ? 'text-white bg-slate-700'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <child.icon className="w-3 h-3 mr-2" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-slate-700 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
