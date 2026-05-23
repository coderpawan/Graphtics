import { useQuery } from '@tanstack/react-query';
import { getAllProducts } from '../firebase/firestore';
import type { Product } from '../types';
import { readCatalogCache, writeCatalogCache } from '../lib/catalogCache';

/**
 * Full product catalog from Firestore, with sessionStorage placeholder for instant paint.
 */
export function useCatalogProducts() {
  return useQuery({
    queryKey: ['products', 'catalog'],
    queryFn: async (): Promise<Product[]> => {
      const products = await getAllProducts();
      writeCatalogCache(products);
      return products;
    },
    placeholderData: readCatalogCache,
    staleTime: 60_000,
  });
}
