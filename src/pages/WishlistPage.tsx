import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '../store/cartStore';
import { useAuth } from '../context/AuthContext';
import { getProductsByIds } from '../firebase/firestore';
import type { Product } from '../types';
import { getImageForProductColor, getProductListingImage } from '../lib/productMedia';
import { formatInr } from '../lib/formatCurrency';
import { ProductGrid } from '../components/product/ProductGrid';
import { Button } from '../components/ui/Button';

export default function WishlistPage() {
  const { user } = useAuth();
  const addToCart = useCartStore(state => state.addItem);
  const wishlistIds = user?.wishlist ?? [];

  const { data: items = [], isLoading } = useQuery<Product[]>({
    queryKey: ['wishlistProducts', wishlistIds],
    queryFn: () => getProductsByIds(wishlistIds),
    enabled: wishlistIds.length > 0,
  });

  const handleMoveToCart = (product: Product) => {
    const size = product.sizes?.[0] ?? 'M';
    const color =
      product.defaultDisplayColor && product.colors.includes(product.defaultDisplayColor)
        ? product.defaultDisplayColor
        : product.colors?.[0] ?? 'Default';
    const variant =
      product.variants.find(v => v.size === size && v.color === color) ??
      product.variants.find(v => v.color === color) ??
      product.variants[0];
    addToCart({
      productId: product.id,
      variantId: variant?.id ?? `${product.id}-${size}-${color}`,
      size,
      color,
      quantity: 1,
      price: product.price,
      name: product.name,
      image: getImageForProductColor(product, color),
      lineSku: variant?.sku?.trim() || product.sku,
    });
  };

  const content = useMemo(() => {
    if (!user) return <p className="text-slate-400">Please log in to see your wishlist.</p>;
    if (!wishlistIds.length) return <p className="text-slate-400">Your wishlist is empty. Add favorites to keep them here.</p>;
    if (isLoading) return <p className="text-slate-400">Loading your wishlist…</p>;
    if (!items.length) return <p className="text-slate-400">Wishlisted products are not available at the moment.</p>;

    return (
      <div className="grid gap-6 xl:grid-cols-3">
        {items.map(product => (
          <div key={product.id} className="rounded-[32px] border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
            <div className="overflow-hidden rounded-3xl bg-slate-900">
              <img
                src={getProductListingImage(product)}
                alt={product.name}
                className="h-56 w-full object-cover transition duration-300 hover:scale-105"
              />
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{product.category}</p>
              <h2 className="text-xl font-semibold text-white">{product.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span>{product.sizes[0] ?? 'Size N/A'}</span>
                <span>{product.colors[0] ?? 'Color N/A'}</span>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold text-white">{formatInr(product.price)}</p>
                {product.compareAtPrice ? (
                  <p className="text-sm line-through text-slate-500">{formatInr(product.compareAtPrice)}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleMoveToCart(product)} className="w-full">Move to cart</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [user, wishlistIds, isLoading, items]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-white">Wishlist</h1>
      <p className="mt-3 text-slate-400">Your curated picks are saved across devices and ready for checkout.</p>
      <div className="mt-10">{content}</div>
    </div>
  );
}
