/**
 * Admin Shared Components
 */

import { ReactNode } from 'react';
import { X } from 'lucide-react';

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'violet' | 'blue' | 'green' | 'red' | 'orange';
}

export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  trend = 'neutral',
  color = 'violet',
}: StatCardProps) {
  const colorClasses = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-slate-600',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {change && (
            <p className={`text-xs ${trendColors[trend]} mt-2`}>
              {trend === 'up' && '↑'} {trend === 'down' && '↓'} {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// Form Input Component
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function FormInput({ label, error, className = '', ...props }: FormInputProps) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <input
        {...props}
        className={`admin-control transition-colors ${error ? 'border-red-300 focus:ring-red-500' : ''} ${className}`.trim()}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Form Textarea Component
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function FormTextarea({ label, error, className = '', ...props }: FormTextareaProps) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <textarea
        {...props}
        className={`admin-control resize-none transition-colors ${error ? 'border-red-300 focus:ring-red-500' : ''} ${className}`.trim()}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Form Select Component
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function FormSelect({ label, error, options, className = '', ...props }: FormSelectProps) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <select
        {...props}
        className={`admin-control transition-colors ${error ? 'border-red-300 focus:ring-red-500' : ''} ${className}`.trim()}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Modal Component
interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  footer,
  size = 'md',
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto ${sizeClasses[size]}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary:
      'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-400',
    secondary:
      'bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
    ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${props.className || ''}`}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

// Badge Component
interface BadgeProps {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ text, variant = 'default' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {text}
    </span>
  );
}

export { DataTable } from './DataTable';
