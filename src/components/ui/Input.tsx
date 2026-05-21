import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 ${className}`}
      {...props}
    />
  );
}
