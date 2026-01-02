import Link from "next/link";

import { ExternalLink } from "lucide-react";

import SiriOrb from "@/components/ui/siri-orb";

import ExpenseEntry from "@/components/ExpenseEntry";

const LINK =
  "https://docs.google.com/spreadsheets/d/1Li8wcsOnsEMN-Q3PFYYns2UvZ_8cTXdgH07RiPbiPe0";

export default function Home() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top,#1b1d25,#151822_50%,#0e1118_100%)]">
      <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(122,92,255,0.18),transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-[-120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(28,210,180,0.18),transparent_60%)] blur-3xl" />

      <div className="relative mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex shrink-0">
                  <SiriOrb size="48px" />
                </div>
                <h1 className="text-3xl leading-tight font-semibold text-slate-100 sm:text-4xl">
                  Track expenses in seconds.
                </h1>
              </div>
              <p className="text-muted-foreground text-base sm:text-lg">
                Use AI or a simple form. Confirm once and it goes straight to
                your sheet.
              </p>
            </div>
            <Link
              href={LINK}
              target="_blank"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Open Google Sheet
            </Link>
          </div>
        </header>
        <ExpenseEntry />
      </div>
    </div>
  );
}
