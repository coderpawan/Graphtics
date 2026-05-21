import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { productCatalog } from '../data/products';
import { ProductGrid } from '../components/product/ProductGrid';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const heroHighlights = [
  'Limited capsules',
  'Premium streetwear drops',
  'Fast checkout & crypto-ready',
];

export default function HomePage() {
  useEffect(() => {
    document.title = 'Graphtics | Home';
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-violet-500/10 ring-1 ring-white/10">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <span>Streetwear drops curated for the next wave of creators.</span>
          </div>
          <div className="space-y-6">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              Premium t-shirts for the culture, built for the digital-native generation.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Explore limited edition designs, anime-inspired graphics, and streetwear essentials made for bold self-expression.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110" to="/shop">
              Shop the drop
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 hover:text-white" to="/category/anime">
              Explore anime <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {heroHighlights.map(highlight => (
              <Card key={highlight} className="border-white/5 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Pro feature</p>
                <p className="mt-3 text-sm text-slate-200">{highlight}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl">
          <div className="absolute inset-0 bg-hero-gradient opacity-80" />
          <div className="relative space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/95 p-5 shadow-xl">
              <img src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1100&q=80" alt="Hero apparel" className="h-[420px] w-full rounded-3xl object-cover" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/90 p-4">
                <p className="text-slate-500">New arrivals</p>
                <p className="mt-2 text-lg font-semibold text-white">Cyberpunk varsity jacket.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-slate-900/90 p-4">
                <p className="text-slate-500">Trending</p>
                <p className="mt-2 text-lg font-semibold text-white">Hyper glow monochrome.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Featured drops</p>
            <h2 className="text-3xl font-semibold text-white">Trending capsules</h2>
          </div>
          <Link to="/shop" className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300 transition hover:text-white">
            View all
          </Link>
        </div>
        <ProductGrid products={productCatalog} />
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <Card className="p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-violet-300">Limited release</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Drop countdown</h3>
          <p className="mt-4 text-slate-400">Stay ahead with live launch alerts, restock reminders, and premium capsule access.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge>Fast shipping</Badge>
            <Badge variant="accent">Limited stocks</Badge>
            <Badge variant="success">Streetwear first</Badge>
          </div>
        </Card>
        <Card className="p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-violet-300">Community</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Verified reviews</h3>
          <p className="mt-4 text-slate-400">Real creator feedback, style insight, and hype from the streetwear community.</p>
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl bg-slate-950/80 p-4">
              <p className="font-semibold text-white">"The fit is insane and the visuals are top tier."</p>
              <p className="mt-2 text-sm text-slate-400">— Nia, Tokyo</p>
            </div>
            <div className="rounded-3xl bg-slate-950/80 p-4">
              <p className="font-semibold text-white">"Feels like a premium drop product, not a template."</p>
              <p className="mt-2 text-sm text-slate-400">— Eli, LA</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
