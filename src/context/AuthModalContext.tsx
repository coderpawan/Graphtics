import { createContext, useContext, useState } from 'react';

type AuthModalContextType = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AuthModalContext.Provider value={{ isOpen, openModal: () => setIsOpen(true), closeModal: () => setIsOpen(false) }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used inside AuthModalProvider');
  }
  return context;
}
