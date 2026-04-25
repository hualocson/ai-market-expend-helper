import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import AIExpenseChat from "@/components/AIExpenseChat";

const AIChatPage = () => {
  return (
    <section className="relative mx-auto flex h-svh max-w-md flex-col overflow-x-hidden px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+16px)] sm:px-6">
      <header className="flex shrink-0 items-center gap-2 pb-4">
        <Link
          href="/"
          aria-label="Back to home"
          className="text-muted-foreground hover:text-foreground hover:bg-surface-2 focus-visible:ring-ring/40 -ml-1.5 inline-flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-foreground text-[15px] font-semibold tracking-tight">
          Spendly AI
        </h1>
      </header>

      <AIExpenseChat />
    </section>
  );
};

export default AIChatPage;
