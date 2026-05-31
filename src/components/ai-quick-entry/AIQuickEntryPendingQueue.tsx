"use client";

import React from "react";

import { cn } from "@/lib/utils";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPendingQueueProps = {
  pendingEntries: QuickEntry[];
  onOpenPreview: () => void;
};

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntryPendingQueue = ({
  pendingEntries,
  onOpenPreview,
}: AIQuickEntryPendingQueueProps) => {
  if (pendingEntries.length === 0) {
    return null;
  }

  const orderedEntries = newestFirst(pendingEntries);
  const visibleEntries = orderedEntries.slice(0, 2);
  const hiddenCount = Math.max(
    pendingEntries.length - visibleEntries.length,
    0
  );

  return (
    <div className="space-y-2" data-testid="ai-quick-entry-pending-queue">
      {visibleEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-label={`Preview pending expense: ${entry.input}`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className="block w-full text-left"
        >
          <AIQuickEntryRow entry={entry} variant="pending" />
        </button>
      ))}

      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-label={`Preview ${hiddenCount} more parsing expense${
            hiddenCount === 1 ? "" : "s"
          }`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className={cn(
            "text-muted-foreground bg-surface-3/55 ds-glass glass-border flex h-9 w-full items-center rounded-[18px] px-4 text-left text-xs font-semibold"
          )}
        >
          +{hiddenCount} more parsing
        </button>
      ) : null}
    </div>
  );
};

export default AIQuickEntryPendingQueue;
