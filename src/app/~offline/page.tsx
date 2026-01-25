import Link from "next/link";

import { CloudOff, RefreshCw, Wifi } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="bg-background text-foreground relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/20 absolute top-12 -left-24 h-64 w-64 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="bg-card/80 absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 pt-8 pb-16 sm:px-6">
        <header className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-4 duration-700">
          <div className="bg-card/80 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 shadow-lg">
            <CloudOff className="text-primary h-6 w-6" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.35em] uppercase">
              Offline mode
            </p>
            <h1 className="text-3xl font-semibold">You&apos;re offline</h1>
          </div>
        </header>

        <section className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 delay-150 duration-700">
          <div className="bg-card/70 rounded-3xl border border-white/10 p-6 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">What still works</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Spendly keeps recent data on-device so you can stay in flow.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="bg-primary/15 text-primary mt-0.5 flex h-8 w-8 items-center justify-center rounded-full">
                  <RefreshCw className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">Log expenses offline</p>
                  <p className="text-muted-foreground">
                    New entries queue up and sync automatically later.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200">
                  <Wifi className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">View recent activity</p>
                  <p className="text-muted-foreground">
                    Your latest expenses stay available for quick recall.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-background/60 rounded-3xl border border-white/10 p-6 shadow-lg backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Get back online</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Check your connection or move closer to a stronger signal. Spendly
              will refresh the moment you&apos;re connected.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                className="bg-primary text-primary-foreground shadow-primary/30 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg transition hover:brightness-110"
                href="/"
              >
                Back to dashboard
              </Link>
              <Link
                className="bg-card/70 text-foreground hover:bg-card inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold transition"
                href="/transactions"
              >
                Browse transactions
              </Link>
            </div>
          </div>
        </section>

        <footer className="bg-card/60 text-muted-foreground animate-in fade-in slide-in-from-bottom-2 mt-auto rounded-3xl border border-white/10 p-5 text-xs delay-300 duration-700">
          Tip: Keep this app pinned. Spendly will sync quietly in the background
          when your connection returns.
        </footer>
      </main>
    </div>
  );
}
