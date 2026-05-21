import { create } from 'zustand';
import type { Product } from '../types';
import { productCatalog } from '../data/products';

type ProductState = {
  products: Product[];
  selectedProduct: Product | null;
  loadProducts: () => void;
  setSelectedProduct: (product: Product | null) => void;
};

export const useProductStore = create<ProductState>(set => ({
  products: [],
  selectedProduct: null,
  loadProducts: () => set({ products: productCatalog }),
  setSelectedProduct: product => set({ selectedProduct: product }),
}));
