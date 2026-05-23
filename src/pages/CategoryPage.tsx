import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { ProductGrid } from '../components/product/ProductGrid';
import { Badge } from '../components/ui/Badge';

export default function CategoryPage() {
  const { category } = useParams();
  const { data: products = [], isLoading, isPlaceholderData } = useCatalogProducts();

  const filtered = useMemo(
    () =>
      products.filter(
        product =>
          product.category.toLowerCase() === category?.toLowerCase() ||
          (product.tags ?? []).some(tag => tag.toLowerCase() === category?.toLowerCase()),
      ),
    [category, products],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.28em] text-violet-300">Collection</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">{category ? category.replace(/\b\w/g, c => c.toUpperCase()) : 'Collections'}</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Discover bold drops, exclusive styles, and trending essentials from the Graphtics archives.</p>
      </header>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">Category: {category}</Badge>
          <Badge>Stocked</Badge>
          <Badge>Curated</Badge>
        </div>
        {isLoading && !isPlaceholderData && filtered.length === 0 ? (
          <p className="text-center text-slate-400">Loading collection…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400">No products match this collection yet.</p>
        ) : (
          <ProductGrid products={filtered} />
        )}
      </div>
    </div>
  );
}
