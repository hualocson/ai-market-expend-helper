export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(1200px_circle_at_10%_10%,rgba(236,72,153,0.12),transparent_45%),radial-gradient(900px_circle_at_90%_0%,rgba(59,130,246,0.16),transparent_40%),linear-gradient(180deg,rgba(10,14,28,0.98),rgba(9,10,20,1))] px-6">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="relative mb-8 h-20 w-20">
          <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/10 shadow-2xl" />
          <div className="absolute inset-3 rounded-2xl border-2 border-transparent border-t-white/80 border-r-white/40 animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">
          Expend Tracker
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Loading</h1>
        <p className="mt-2 text-sm text-white/60">Preparing your dashboard</p>
        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500" />
        </div>
      </div>
    </main>
  );
}
