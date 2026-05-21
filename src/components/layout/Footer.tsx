import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/90 py-12 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold text-white">Graphtics</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            A premium GenZ streetwear platform with bold drops, creative collections, and immersive fashion-tech experiences.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Explore</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li><Link to="/shop" className="hover:text-white">Shop</Link></li>
            <li><Link to="/auth" className="hover:text-white">Account</Link></li>
            <li><Link to="/wishlist" className="hover:text-white">Wishlist</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Brand</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-white">Drops</a></li>
            <li><a href="#" className="hover:text-white">Print Lab</a></li>
            <li><a href="#" className="hover:text-white">Press</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-4 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">© 2026 Graphtics. Built for bold creators.</p>
        <p className="text-sm text-slate-500">Designed for modern fashion, tech, and street culture.</p>
      </div>
    </footer>
  );
}
