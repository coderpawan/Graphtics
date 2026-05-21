import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, ShieldCheck, Share2, ShoppingBag } from 'lucide-react';
import { getProductBySlug } from '../firebase/firestore';
import type { Product } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/cartStore';

export default function ProductPage() {
  const { slug } = useParams();
  const { user, toggleWishlist } = useAuth();
  const addToCart = useCartStore(state => state.addItem);
  const [activeImage, setActiveImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('');

  const { data: product, isLoading } = useQuery<Product | null>({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug ?? ''),
    enabled: Boolean(slug),
  });

  useEffect(() => {
    if (product) {
      setActiveImage(product.images[0] ?? '');
      setSelectedSize(product.sizes[0] ?? 'M');
      setSelectedColor(product.colors[0] ?? '');
    }
  }, [product]);

  const isWishlisted = useMemo(() => {
    return product ? user?.wishlist.includes(product.id) : false;
  }, [product, user?.wishlist]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      productId: product.id,
      variantId: `${product.id}-${selectedSize}-${selectedColor}`,
      size: selectedSize,
      color: selectedColor,
      quantity,
      price: product.price,
      name: product.name,
      image: product.images[0] ?? '',
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="text-xl text-slate-300">Loading product details…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="text-xl text-slate-300">Product not found. Explore the latest collection instead.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/80 p-4 shadow-2xl">
            <img src={activeImage} alt={product.name} className="h-[480px] w-full rounded-[28px] object-cover transition duration-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {product.images.map(image => (
              <button key={image} onClick={() => setActiveImage(image)} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-1 transition hover:border-violet-400">
                <img src={image} alt={product.name} className="h-28 w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Badge variant="accent">{product.category}</Badge>
              {product.isLimited && <Badge>Limited</Badge>}
              {product.isNew && <Badge variant="success">New</Badge>}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-semibold text-white">{product.name}</h1>
                <p className="text-sm text-slate-400">{product.sku} · {product.rating} ★</p>
              </div>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`rounded-full border p-3 transition ${isWishlisted ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-white/10 text-slate-300 hover:border-violet-400'}`}
              >
                <Heart className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold text-white">${product.price}</p>
                {product.compareAtPrice && <p className="text-sm text-slate-500 line-through">${product.compareAtPrice}</p>}
              </div>
              <Badge variant="success">{product.stock} in stock</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Size</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${selectedSize === size ? 'border-violet-400 bg-violet-500/10 text-white' : 'border-white/10 text-slate-300 hover:border-violet-400/30'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Color</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${selectedColor === color ? 'border-violet-400 bg-violet-500/10 text-white' : 'border-white/10 text-slate-300 hover:border-violet-400/30'}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Quantity</p>
                <div className="mt-3 flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/90 px-3 py-2">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="text-slate-200">-</button>
                  <span className="min-w-[32px] text-center text-white">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="text-slate-200">+</button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button onClick={handleAddToCart} className="w-full inline-flex items-center justify-center gap-2"><ShoppingBag className="h-4 w-4" /> Add to cart</Button>
            <Button className="w-full bg-slate-700/90 text-white hover:bg-slate-600">Buy now</Button>
          </div>
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-300">
            <p>{product.description}</p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-400" /> Premium 220 GSM cotton blend.</li>
              <li className="flex items-center gap-2"><Share2 className="h-4 w-4 text-violet-400" /> Designed for print, style, and comfort.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
