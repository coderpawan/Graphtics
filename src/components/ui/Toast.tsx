import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastData = {
  id: string;
  message: string;
  type: ToastType;
};

const ToastContext = createContext<{ showToast: (message: string, type?: ToastType) => void } | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}`;
    setToast({ id, message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="fixed right-4 top-4 z-50 w-[320px] rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{toast.type}</p>
          <p className="mt-2 text-sm text-white">{toast.message}</p>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
};

export function ToastRoot() {
  return <ToastProvider>{null}</ToastProvider>;
}
