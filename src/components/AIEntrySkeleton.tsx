import React from "react";

type AIEntrySkeletonProps = {
  input: string;
};

const AIEntrySkeleton = ({ input }: AIEntrySkeletonProps) => (
  <div
    data-ai-entry-skeleton
    className="bg-surface-2/95 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]"
  >
    <div className="flex items-center gap-4">
      <span className="bg-muted size-12 shrink-0 animate-pulse rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-foreground/90 truncate font-semibold">{input}</p>
        <span className="bg-muted block h-6 w-1/3 animate-pulse rounded-md" />
      </div>
      <span className="bg-muted block h-4 w-14 shrink-0 animate-pulse rounded-md" />
    </div>
  </div>
);

export default AIEntrySkeleton;
