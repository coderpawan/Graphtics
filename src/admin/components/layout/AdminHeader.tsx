/**
 * Admin Header Navigation
 */

import { useState } from 'react';
import { Menu, Bell, Search, User, Settings, LogOut } from 'lucide-react';
import { useAdminStore } from '../../store/adminStore';
import { useAdminAuth } from '../../context/AdminContext';

export function AdminHeader() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { setSidebarOpen } = useAdminStore();
  const { adminUser, logout } = useAdminAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-600 hover:text-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-2 max-w-xs">
            <Search className="w-4 h-4 text-slate-500 mr-2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-slate-900 placeholder-slate-500 outline-none w-full"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative text-slate-600 hover:text-slate-900">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-sm font-medium">
                {adminUser?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <span className="text-sm font-medium text-slate-900 hidden sm:inline">
                {adminUser?.name}
              </span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <p className="text-sm font-medium text-slate-900">{adminUser?.name}</p>
                  <p className="text-xs text-slate-500">{adminUser?.role}</p>
                </div>

                <button className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                  <User className="w-4 h-4 mr-3" />
                  Profile
                </button>

                <button className="w-full flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                  <Settings className="w-4 h-4 mr-3" />
                  Settings
                </button>

                <button
                  onClick={() => {
                    handleLogout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-200"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
