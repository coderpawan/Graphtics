export function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-4 text-center text-slate-300">
        <div className="h-24 w-24 animate-spin rounded-full border border-slate-700 border-t-violet-400" />
        <div>
          <p className="text-lg font-semibold text-white">Loading the streetwear drop...</p>
          <p className="text-sm text-slate-500">Preparing your Graphtics experience.</p>
        </div>
      </div>
    </div>
  );
}
