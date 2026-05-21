import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart, Menu, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const { openModal } = useAuthModal();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const initials = user?.name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3 text-xl font-semibold tracking-[0.18em] text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm shadow-glow">G</span>
          Graphtics
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {['Shop', 'Anime', 'Streetwear', 'Drops'].map(label => (
            <NavLink
              key={label}
              to={label === 'Shop' ? '/shop' : `/category/${label.toLowerCase()}`}
              className={({ isActive }) =>
                `text-sm font-medium transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={openModal}
                className="hidden rounded-full border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 transition hover:border-violet-400/40 hover:text-white md:inline-flex"
              >
                Sign In
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={openModal}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 hover:text-white"
              >
                <User className="h-5 w-5" />
              </motion.button>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(prev => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-white transition hover:bg-slate-900"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{initials || 'U'}</span>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
                  <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Signed in as</p>
                    <p className="mt-1 text-white">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to="/account"
                      className="rounded-3xl px-4 py-3 text-sm text-slate-100 transition hover:bg-white/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      My account
                    </Link>
                    <Link
                      to="/orders"
                      className="rounded-3xl px-4 py-3 text-sm text-slate-100 transition hover:bg-white/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      Orders
                    </Link>
                    <Link
                      to="/wishlist"
                      className="rounded-3xl px-4 py-3 text-sm text-slate-100 transition hover:bg-white/5"
                      onClick={() => setMenuOpen(false)}
                    >
                      Wishlist
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await signOut();
                        setMenuOpen(false);
                      }}
                      className="rounded-3xl bg-white/5 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Link
            to="/wishlist"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 hover:text-white"
          >
            <Heart className="h-5 w-5" />
          </Link>
          <Link
            to="/cart"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 hover:text-white"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

