import { motion, type MotionProps } from 'framer-motion';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonProps = ComponentPropsWithoutRef<'button'> & MotionProps & {
  className?: string;
  children: ReactNode;
};

export function Button({ className = '', children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      className={`inline-flex items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400 ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
