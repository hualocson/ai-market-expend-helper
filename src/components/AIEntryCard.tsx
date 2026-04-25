import Link from "next/link";

import { ArrowUpRight, Sparkles } from "lucide-react";

const AIEntryCard = () => {
  return (
    <Link
      href="/ai"
      aria-label="Open Spendly AI expense chat"
      className="ds-interactive-card ds-surface-2 group focus-visible:ring-ring/40 relative flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="bg-primary/15 text-primary ring-primary/35 grid size-11 shrink-0 place-items-center rounded-xl ring-1"
      >
        <Sparkles className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
          Spendly AI
          <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
            New
          </span>
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs leading-5">
          Type a sentence, I&rsquo;ll turn it into an expense.
        </p>
      </div>
      <span
        aria-hidden="true"
        className="text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 grid size-8 shrink-0 place-items-center rounded-full transition-colors"
      >
        <ArrowUpRight className="size-4" />
      </span>
    </Link>
  );
};

export default AIEntryCard;
