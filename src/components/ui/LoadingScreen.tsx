type LoadingScreenProps = {
  /** Light background + dark text (admin shell uses bg-slate-50) */
  variant?: 'store' | 'admin';
};

export function LoadingScreen({ variant = 'store' }: LoadingScreenProps) {
  const isAdmin = variant === 'admin';
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div
        className={`flex flex-col items-center gap-4 text-center ${isAdmin ? 'text-slate-700' : 'text-slate-300'}`}
      >
        <div
          className={`h-24 w-24 animate-spin rounded-full border border-t-violet-500 ${
            isAdmin ? 'border-slate-300' : 'border-slate-700 border-t-violet-400'
          }`}
        />
        <div>
          <p className={`text-lg font-semibold ${isAdmin ? 'text-slate-900' : 'text-white'}`}>
            {isAdmin ? 'Loading admin…' : 'Loading the streetwear drop...'}
          </p>
          <p className={`text-sm ${isAdmin ? 'text-slate-500' : 'text-slate-500'}`}>
            {isAdmin ? 'Preparing your dashboard.' : 'Preparing your Graphtics experience.'}
          </p>
        </div>
      </div>
    </div>
  );
}
