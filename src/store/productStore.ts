import { create } from 'zustand';
import type { Product } from '../types';
import { getAllProducts } from '../firebase/firestore';

type ProductState = {
  products: Product[];
  selectedProduct: Product | null;
  loadProducts: () => Promise<void>;
  setSelectedProduct: (product: Product | null) => void;
};

export const useProductStore = create<ProductState>(set => ({
  products: [],
  selectedProduct: null,
  loadProducts: async () => {
    const products = await getAllProducts();
    set({ products });
  },
  setSelectedProduct: product => set({ selectedProduct: product }),
}));
