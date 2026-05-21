import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

export function Modal({ open, title, children, onClose }: { open: boolean; title?: string; children: ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
            initial={{ scale: 0.95, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 24, opacity: 0 }}
          >
            <div className="flex items-center justify-between gap-6">
              <div className="text-lg font-semibold text-white">{title}</div>
              <button className="rounded-full bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10" onClick={onClose}>
                Close
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
