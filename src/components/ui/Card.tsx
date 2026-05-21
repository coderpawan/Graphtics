import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-glass rounded-[32px] border border-white/10 p-6 shadow-[0_28px_80px_-36px_rgba(0,0,0,0.65)] ${className}`}>
      {children}
    </div>
  );
}
