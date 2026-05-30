import React from "react";

const AIEntrySkeleton = () => (
  <div
    data-ai-entry-skeleton
    className="bg-surface-2/65 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]"
  >
    <div className="flex items-center gap-4">
      <span className="bg-muted size-12 shrink-0 animate-pulse rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <span className="bg-muted block h-4 w-2/3 animate-pulse rounded-md" />
        <span className="bg-muted block h-3 w-1/3 animate-pulse rounded-md" />
      </div>
      <span className="bg-muted block h-4 w-14 shrink-0 animate-pulse rounded-md" />
    </div>
  </div>
);

export default AIEntrySkeleton;
