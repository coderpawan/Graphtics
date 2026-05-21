import type { ReactNode } from 'react';

export function Badge({ children, variant = 'secondary' }: { children: ReactNode; variant?: 'secondary' | 'accent' | 'success' }) {
  const classes = {
    secondary: 'bg-white/5 text-slate-200',
    accent: 'bg-violet-500/15 text-violet-300',
    success: 'bg-emerald-500/10 text-emerald-200',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${classes[variant]}`}>{children}</span>;
}
