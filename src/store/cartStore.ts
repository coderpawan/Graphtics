import { create } from 'zustand';
import type { CartItem } from '../types';

const CART_STORAGE_KEY = 'graphtics_cart';

const getStoredCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as CartItem[]) : [];
  } catch {
    return [];
  }
};

const persistCart = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
};

type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>(set => ({
  items: getStoredCart(),
  addItem: item =>
    set(state => {
      const existing = state.items.find(i => i.variantId === item.variantId && i.size === item.size);
      const updatedItems = existing
        ? state.items.map(i =>
            i.variantId === item.variantId && i.size === item.size
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          )
        : [...state.items, item];
      persistCart(updatedItems);
      return { items: updatedItems };
    }),
  removeItem: variantId =>
    set(state => {
      const updatedItems = state.items.filter(item => item.variantId !== variantId);
      persistCart(updatedItems);
      return { items: updatedItems };
    }),
  updateQuantity: (variantId, quantity) =>
    set(state => {
      const updatedItems = state.items.map(item => (item.variantId === variantId ? { ...item, quantity } : item));
      persistCart(updatedItems);
      return { items: updatedItems };
    }),
  clearCart: () => {
    persistCart([]);
    return { items: [] };
  },
}));
