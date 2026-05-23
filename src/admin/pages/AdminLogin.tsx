/**
 * Admin sign-in (local session). Does not use the storefront /auth page.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, adminUser } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ||
    '/admin/dashboard';

  useEffect(() => {
    if (adminUser) {
      navigate(from, { replace: true });
    }
  }, [adminUser, from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scheme-dark flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-300">Graphtics</p>
          <h1 className="text-2xl font-semibold text-white">Admin sign in</h1>
          <p className="text-sm text-slate-400">Use your admin username and password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-user" className="mb-2 block text-sm font-medium text-slate-200">
              Username
            </label>
            <Input
              id="admin-user"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Admin"
              className="bg-slate-950/80"
              required
            />
          </div>
          <div>
            <label htmlFor="admin-pass" className="mb-2 block text-sm font-medium text-slate-200">
              Password
            </label>
            <Input
              id="admin-pass"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="bg-slate-950/80"
              required
            />
          </div>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500">
          <Link to="/" className="text-violet-400 hover:text-violet-300">
            ← Back to store
          </Link>
        </p>
      </div>
    </div>
  );
}
