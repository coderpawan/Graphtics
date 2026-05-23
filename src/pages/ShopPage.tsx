import { useMemo, useState } from 'react';
import { useCatalogProducts } from '../hooks/useCatalogProducts';
import { ProductGrid } from '../components/product/ProductGrid';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useDebounce } from '../hooks/useDebounce';
import { getProductListingStarRating } from '../lib/productReviewStats';
import { formatInr } from '../lib/formatCurrency';

export default function ShopPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState('Trending');
  const debouncedSearch = useDebounce(search, 240);

  const { data: products = [], isLoading, isPlaceholderData } = useCatalogProducts();

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category?.trim()) set.add(p.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    return products
      .filter(product =>
        (selectedCategory === 'All' || product.category === selectedCategory) &&
        [product.name, product.category, ...(product.tags ?? [])].some(value =>
          value.toLowerCase().includes(debouncedSearch.toLowerCase()),
        ),
      )
      .sort((a, b) => {
        if (sort === 'Price: Low to High') return a.price - b.price;
        if (sort === 'Price: High to Low') return b.price - a.price;
        return getProductListingStarRating(b) - getProductListingStarRating(a);
      });
  }, [products, debouncedSearch, selectedCategory, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-violet-300">Shop</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Explore the latest drops and curated collections.</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,320px)_minmax(220px,320px)]">
          <Input placeholder="Search tees, categories, vibes..." value={search} onChange={e => setSearch(e.target.value)} />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
          >
            <option>Trending</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
          </select>
        </div>
      </header>

      <div className="mb-10 flex flex-wrap gap-3">
        <Badge variant={selectedCategory === 'All' ? 'accent' : 'secondary'}>
          <button type="button" onClick={() => setSelectedCategory('All')} className="hover:text-white">All</button>
        </Badge>
        {categories.map(category => (
          <Badge key={category} variant={selectedCategory === category ? 'accent' : 'secondary'}>
            <button type="button" onClick={() => setSelectedCategory(category)} className="hover:text-white">
              {category}
            </button>
          </Badge>
        ))}
      </div>

      <section className="grid gap-8 lg:grid-cols-[2.5fr_1fr]">
        <div>
          {isLoading && !isPlaceholderData && filtered.length === 0 ? (
            <Card className="p-10 text-center text-slate-400">Loading products…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center text-slate-400">No products match your filters.</Card>
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
        <aside className="space-y-6">
          <Card className="p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Filter</p>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm text-slate-300">Price range</p>
                <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                  <span>{formatInr(500)}</span>
                  <span className="flex-1 h-0.5 bg-white/10" />
                  <span>{formatInr(5000)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-300">Availability</p>
                <div className="mt-3 flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-400" />
                    In stock
                  </label>
                </div>
              </div>
            </div>
          </Card>
          <Card className="rounded-[32px] p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Essentials</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Streetwear essentials</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Curated wardrobe builders for every drop, crafted with premium silhouettes and bold prints.</p>
          </Card>
        </aside>
      </section>
    </div>
  );
}
