import Link from "next/link";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-card/80 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-card/80 shadow-lg">
            <CloudOff className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Offline mode
            </p>
            <h1 className="text-3xl font-semibold">You&apos;re offline</h1>
          </div>
        </header>

        <section className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150">
          <div className="rounded-3xl border border-white/10 bg-card/70 p-6 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">What still works</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Spendly keeps recent data on-device so you can stay in flow.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
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

          <div className="rounded-3xl border border-white/10 bg-background/60 p-6 shadow-lg backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Get back online</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Check your connection or move closer to a stronger signal. Spendly
              will refresh the moment you&apos;re connected.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
                href="/"
              >
                Back to dashboard
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-card/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-card"
                href="/transactions"
              >
                Browse transactions
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-auto rounded-3xl border border-white/10 bg-card/60 p-5 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
          Tip: Keep this app pinned. Spendly will sync quietly in the background
          when your connection returns.
        </footer>
      </main>
    </div>
  );
}
