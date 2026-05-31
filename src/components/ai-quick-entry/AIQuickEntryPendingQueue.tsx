"use client";

import React from "react";

import { cn } from "@/lib/utils";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPendingQueueProps = {
  activeEntries: QuickEntry[];
  onOpenPreview: () => void;
};

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntryPendingQueue = ({
  activeEntries,
  onOpenPreview,
}: AIQuickEntryPendingQueueProps) => {
  if (activeEntries.length === 0) {
    return null;
  }

  const orderedEntries = newestFirst(activeEntries);
  const visibleEntries = orderedEntries.slice(0, 2);
  const hiddenCount = Math.max(activeEntries.length - visibleEntries.length, 0);

  return (
    <div className="space-y-2" data-testid="ai-quick-entry-pending-queue">
      {visibleEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-label={`Preview active expense: ${entry.input}`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className="block w-full text-left"
        >
          <AIQuickEntryRow entry={entry} variant="active" />
        </button>
      ))}

      {hiddenCount > 0 ? (
        <button
          type="button"
          aria-label={`Preview ${hiddenCount} more active expense${
            hiddenCount === 1 ? "" : "s"
          }`}
          onClick={onOpenPreview}
          onPointerDown={(event) => event.preventDefault()}
          className={cn(
            "text-muted-foreground bg-surface-3/55 ds-glass glass-border flex min-h-11 w-full items-center rounded-[18px] px-4 text-left text-xs font-semibold"
          )}
        >
          +{hiddenCount} more active
        </button>
      ) : null}
    </div>
  );
};

export default AIQuickEntryPendingQueue;
