import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Heart, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { getProductBySlug, getReviewsForProduct } from '../firebase/firestore';
import type { MarketplaceLinks, Product, Review } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/cartStore';
import { getImageForProductColor, getImagesForProductColor } from '../lib/productMedia';
import {
  averageReviewRatingOneDecimal,
  formatRatingOneDecimal,
  getProductListingStarRating,
  mergeReviewsById,
} from '../lib/productReviewStats';
import { formatInr } from '../lib/formatCurrency';

function ReviewBlock({ rev, onImageClick }: { rev: Review; onImageClick?: (url: string) => void }) {
  const gallery =
    rev.images && rev.images.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {rev.images.map((url, i) =>
          onImageClick ? (
            <button
              key={`${rev.id}-img-${i}`}
              type="button"
              className="overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-violet-400/60 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-500"
              onClick={() => onImageClick(url)}
            >
              <img src={url} alt="" className="h-20 w-20 object-cover" />
            </button>
          ) : (
            <img key={`${rev.id}-img-${i}`} src={url} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/10" />
          ),
        )}
      </div>
    ) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-white">{rev.author}</p>
        <span className="text-amber-300">{formatRatingOneDecimal(rev.rating)}★</span>
      </div>
      {rev.title ? <p className="mt-1 text-sm font-medium text-violet-200">{rev.title}</p> : null}
      <p className="mt-2 text-sm text-slate-300">{rev.content}</p>
      {gallery}
      <p className="mt-2 text-xs text-slate-500">{new Date(rev.date).toLocaleDateString()}</p>
    </div>
  );
}

function normalizeOutboundUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

const MARKETPLACE_ENTRIES: { key: keyof MarketplaceLinks; label: string }[] = [
  { key: 'amazon', label: 'Shop on Amazon' },
  { key: 'flipkart', label: 'Shop on Flipkart' },
  { key: 'meesho', label: 'Shop on Meesho' },
  { key: 'myntra', label: 'Shop on Myntra' },
];

export default function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, toggleWishlist } = useAuth();
  const addToCart = useCartStore(state => state.addItem);
  const clearCart = useCartStore(state => state.clearCart);
  const [slideIndex, setSlideIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('');
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [expandedReviewImage, setExpandedReviewImage] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery<Product | null>({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug ?? ''),
    enabled: Boolean(slug),
  });

  const { data: customerReviews = [] } = useQuery({
    queryKey: ['product-reviews-firestore', product?.id],
    queryFn: () => (product?.id ? getReviewsForProduct(product.id) : Promise.resolve([])),
    enabled: Boolean(product?.id),
  });

  const mergedReviews = useMemo(() => {
    if (!product) return [];
    return mergeReviewsById(product.reviews, customerReviews);
  }, [product, customerReviews]);

  const reviewAverage = useMemo(() => {
    if (!mergedReviews.length) return product?.rating ?? 0;
    return averageReviewRatingOneDecimal(mergedReviews);
  }, [mergedReviews, product?.rating]);

  const listingFallbackRating = product ? getProductListingStarRating(product) : 0;

  const slides = useMemo(() => {
    if (!product || !selectedColor) return [];
    return getImagesForProductColor(product, selectedColor);
  }, [product, selectedColor]);

  useEffect(() => {
    if (!product) return;
    const first =
      product.defaultDisplayColor && product.colors.includes(product.defaultDisplayColor)
        ? product.defaultDisplayColor
        : product.colors[0] ?? '';
    setSelectedSize(product.sizes[0] ?? 'M');
    setSelectedColor(first);
    setSlideIndex(0);
    setQuantity(1);
  }, [product]);

  useEffect(() => {
    setSlideIndex(i => {
      if (!product || !selectedColor) return 0;
      const list = getImagesForProductColor(product, selectedColor);
      if (list.length === 0) return 0;
      return Math.min(i, list.length - 1);
    });
  }, [product, selectedColor]);

  const heroSrc =
    slides[slideIndex] ?? product?.images?.[0] ?? 'https://placehold.co/600x800/1e293b/94a3b8?text=Graphtics';

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    const exact = product.variants.find(v => v.size === selectedSize && v.color === selectedColor);
    if (exact) return exact;
    return product.variants.find(v => v.color === selectedColor) ?? product.variants[0] ?? null;
  }, [product, selectedSize, selectedColor]);

  const maxQuantity = useMemo(() => {
    if (!selectedVariant) return 0;
    const st = selectedVariant.stock;
    if (typeof st !== 'number' || !Number.isFinite(st) || st <= 0) return 0;
    return Math.min(999, st);
  }, [selectedVariant]);

  useEffect(() => {
    if (maxQuantity <= 0) {
      setQuantity(0);
      return;
    }
    setQuantity(q => Math.min(Math.max(1, q), maxQuantity));
  }, [maxQuantity, selectedSize, selectedColor]);

  const isWishlisted = useMemo(() => {
    return product ? (user?.wishlist?.includes(product.id) ?? false) : false;
  }, [product, user?.wishlist]);

  const selectColor = (color: string) => {
    setSelectedColor(color);
    setSlideIndex(0);
  };

  const buildCartItem = () => {
    if (!product) return null;
    if (maxQuantity <= 0 || quantity < 1) return null;
    const lineSku = selectedVariant?.sku?.trim() || product.sku;
    const image = getImageForProductColor(product, selectedColor);
    return {
      productId: product.id,
      variantId: `${product.id}-${selectedSize}-${selectedColor}`,
      size: selectedSize,
      color: selectedColor,
      quantity,
      price: product.price,
      name: product.name,
      image,
      lineSku,
    };
  };

  const handleAddToCart = () => {
    const item = buildCartItem();
    if (item) addToCart(item);
  };

  const handleBuyNow = () => {
    const item = buildCartItem();
    if (!item) return;
    clearCart();
    addToCart(item);
    navigate('/checkout');
  };

  const stockLabel = useMemo(() => {
    if (!product || !selectedColor || !selectedSize) return null;
    const st = selectedVariant?.stock;
    if (typeof st !== 'number' || !Number.isFinite(st)) {
      return `Stock unavailable for ${selectedColor} · ${selectedSize}.`;
    }
    if (st <= 0) return `Out of stock for ${selectedColor} · ${selectedSize}.`;
    return `${st} in stock for ${selectedColor} · ${selectedSize}.`;
  }, [product, selectedColor, selectedSize, selectedVariant?.stock]);

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

  const canPurchase = maxQuantity > 0 && quantity >= 1;
  const showCarouselStrip = slides.length > 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/80 p-4 shadow-2xl">
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => setSlideIndex(i => (i - 1 + slides.length) % slides.length)}
                  className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/80 p-2 text-white shadow-lg transition hover:bg-slate-900"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => setSlideIndex(i => (i + 1) % slides.length)}
                  className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-slate-950/80 p-2 text-white shadow-lg transition hover:bg-slate-900"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
            <img
              src={heroSrc}
              alt={`${product.name} — view ${slideIndex + 1}`}
              className="h-[480px] w-full rounded-[28px] object-cover transition duration-500"
            />
          </div>
          {showCarouselStrip && (
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">Gallery ({selectedColor})</p>
              <div className="flex flex-wrap gap-3">
                {slides.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setSlideIndex(idx)}
                    className={`overflow-hidden rounded-2xl border-2 bg-slate-900/80 p-0.5 transition ${
                      slideIndex === idx ? 'border-violet-400 ring-2 ring-violet-500/40' : 'border-white/10 hover:border-violet-400/50'
                    }`}
                  >
                    <img src={url} alt="" className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {product.colors.length > 1 && (
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">Other colours</p>
              <div className="flex flex-wrap gap-3">
                {product.colors.map(color => {
                  const thumb = getImageForProductColor(product, color);
                  const active = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => selectColor(color)}
                      title={color}
                      className={`relative overflow-hidden rounded-2xl border-2 bg-slate-900/80 p-0.5 transition ${
                        active ? 'border-violet-400 ring-2 ring-violet-500/40' : 'border-white/10 hover:border-violet-400/50'
                      }`}
                    >
                      <img src={thumb} alt={`${product.name} — ${color}`} className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/55 py-1 text-center text-[10px] font-medium text-white">
                        {color}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
                <p className="text-sm text-slate-400">
                  {product.sku}
                  {mergedReviews.length > 0 ? (
                    <>
                      {' '}
                      ·{' '}
                      <button
                        type="button"
                        onClick={() => setReviewsModalOpen(true)}
                        className="text-violet-300 underline decoration-violet-500/40 underline-offset-2 transition hover:text-violet-200"
                      >
                        {formatRatingOneDecimal(reviewAverage)} ★ ({mergedReviews.length} review
                        {mergedReviews.length === 1 ? '' : 's'})
                      </button>
                    </>
                  ) : listingFallbackRating > 0 ? (
                    <>
                      {' '}
                      · {formatRatingOneDecimal(listingFallbackRating)} ★
                    </>
                  ) : null}
                </p>
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
                <p className="text-3xl font-semibold text-white">{formatInr(product.price)}</p>
                {product.compareAtPrice ? (
                  <p className="text-sm text-slate-500 line-through">{formatInr(product.compareAtPrice)}</p>
                ) : null}
              </div>
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
                      onClick={() => selectColor(color)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${selectedColor === color ? 'border-violet-400 bg-violet-500/10 text-white' : 'border-white/10 text-slate-300 hover:border-violet-400/30'}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
              {stockLabel && <p className="text-sm text-slate-300">{stockLabel}</p>}
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Quantity</p>
                {maxQuantity > 0 ? (
                  <div className="mt-3 flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/90 px-3 py-2">
                    <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="text-slate-200">
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      aria-label="Quantity"
                      className="min-w-[48px] flex-1 bg-transparent text-center text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        setQuantity(Number.isFinite(v) ? Math.min(maxQuantity, Math.max(1, v)) : 1);
                      }}
                    />
                    <button type="button" onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} className="text-slate-200">
                      +
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-200/90">This size and colour combination is out of stock.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-violet-500/30 bg-violet-950/20 p-5 text-sm text-slate-200">
            <p className="font-medium text-white">Bulk & custom orders</p>
            <p className="mt-2 text-slate-300">
              Need more than we show in stock, or a custom run? Our management team can quote availability and pricing.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Bulk order — contact management
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button onClick={handleAddToCart} disabled={!canPurchase} className="w-full inline-flex items-center justify-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Add to cart
            </Button>
            <Button
              type="button"
              onClick={handleBuyNow}
              disabled={!canPurchase}
              className="w-full bg-slate-700/90 text-white hover:bg-slate-600 disabled:opacity-50"
            >
              Buy now
            </Button>
          </div>
          {MARKETPLACE_ENTRIES.some(({ key }) => product.marketplaceLinks?.[key]?.trim()) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {MARKETPLACE_ENTRIES.map(({ key, label }) => {
                const raw = product.marketplaceLinks?.[key]?.trim();
                if (!raw) return null;
                const href = normalizeOutboundUrl(raw);
                if (!href) return null;
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-slate-800/80 px-4 py-3 text-center text-sm font-medium text-white transition hover:border-violet-400/50 hover:bg-slate-800"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          )}
          <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-300">
            <p>{product.description}</p>
            {product.highlights && product.highlights.length > 0 && (
              <ul className="mt-4 space-y-2">
                {product.highlights.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 24)}`} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={reviewsModalOpen}
        title={`All reviews (${mergedReviews.length})`}
        onClose={() => setReviewsModalOpen(false)}
      >
        <div className="max-h-[min(70vh,520px)] space-y-6 overflow-y-auto pr-1">
          {mergedReviews.map(rev => (
            <div key={rev.id} className="border-b border-white/10 pb-5 last:border-0 last:pb-0">
              <ReviewBlock rev={rev} onImageClick={url => setExpandedReviewImage(url)} />
            </div>
          ))}
        </div>
      </Modal>

      {expandedReviewImage ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Review photo enlarged"
          onClick={() => setExpandedReviewImage(null)}
        >
          <div className="relative max-h-[92vh] max-w-[min(96vw,900px)]" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -right-1 -top-12 rounded-full border border-white/20 bg-slate-900/90 p-2 text-white transition hover:bg-slate-800 sm:-right-12 sm:top-0"
              onClick={() => setExpandedReviewImage(null)}
              aria-label="Close photo"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={expandedReviewImage}
              alt=""
              className="max-h-[88vh] w-full rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
