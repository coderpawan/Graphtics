import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="max-w-xl rounded-[32px] border border-white/10 bg-slate-950/90 p-10 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.28em] text-violet-300">404</p>
        <h1 className="mt-4 text-5xl font-semibold text-white">Page not found.</h1>
        <p className="mt-4 text-slate-400">The page you were trying to access does not exist. Return to the home stage and explore the latest drops.</p>
        <div className="mt-8">
          <Link to="/">
            <Button>Back to Graphtics</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
