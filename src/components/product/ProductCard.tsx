import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import type { Product } from '../../types';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';

export function ProductCard({ product }: { product: Product }) {
  const { user, toggleWishlist } = useAuth();
  const isWishlisted = user?.wishlist.includes(product.id) ?? false;

  return (
    <motion.article whileHover={{ y: -6 }} className="group overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 p-5 transition hover:border-violet-400/30">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/80">
        <img src={product.images[0]} alt={product.name} className="h-72 w-full object-cover transition duration-500 group-hover:scale-105" />
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          className={`absolute right-4 top-4 rounded-full p-3 text-slate-200 shadow-xl backdrop-blur-xl transition ${isWishlisted ? 'bg-pink-500/20 text-pink-400' : 'bg-slate-950/80 hover:bg-slate-900/95'}`}
        >
          <Heart className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{product.name}</h3>
          <p className="mt-2 text-sm text-slate-400">{product.category}</p>
        </div>
        <Badge variant={product.isLimited ? 'accent' : product.isTrending ? 'success' : 'secondary'}>
          {product.isLimited ? 'Limited' : product.isTrending ? 'Trending' : 'Classic'}
        </Badge>
      </div>
      <div className="mt-5 flex items-center justify-between text-sm text-slate-300">
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 text-amber-400" />
          <span>{product.rating.toFixed(1)}</span>
        </div>
        <div className="font-semibold text-white">${product.price}</div>
      </div>
      <Link
        to={`/product/${product.slug}`}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Preview
      </Link>
    </motion.article>
  );
}
