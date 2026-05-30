"use client";

import React from "react";

import { cn } from "@/lib/utils";

import AIQuickEntryRow from "./AIQuickEntryRow";
import type { QuickEntry } from "./types";

type AIQuickEntryPendingStackProps = {
  pendingEntries: QuickEntry[];
  expanded: boolean;
  onToggleExpanded: () => void;
};

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntryPendingStack = ({
  pendingEntries,
  expanded,
  onToggleExpanded,
}: AIQuickEntryPendingStackProps) => {
  if (pendingEntries.length === 0) {
    return null;
  }

  const orderedEntries = newestFirst(pendingEntries);
  const frontEntry = orderedEntries[0];
  const visibleStackCards = orderedEntries.slice(0, 3);
  const canExpand = pendingEntries.length > 1;

  if (expanded && canExpand) {
    return (
      <div className="space-y-2" data-ai-pending-stack-state="expanded">
        <button
          type="button"
          aria-expanded="true"
          aria-label={`Collapse ${pendingEntries.length} pending expenses`}
          onClick={onToggleExpanded}
          onPointerDown={(event) => event.preventDefault()}
          className="text-muted-foreground w-full px-1 text-left text-xs font-medium"
        >
          {pendingEntries.length} parsing
        </button>
        <div className="no-scrollbar max-h-48 space-y-2 overflow-y-auto">
          {orderedEntries.map((entry) => (
            <AIQuickEntryRow key={entry.id} entry={entry} variant="pending" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded="false"
      aria-label={
        canExpand
          ? `Expand ${pendingEntries.length} pending expenses`
          : `Parsing expense: ${frontEntry.input}`
      }
      onClick={canExpand ? onToggleExpanded : undefined}
      onPointerDown={(event) => event.preventDefault()}
      className={cn(
        "relative block w-full text-left",
        !canExpand && "cursor-default"
      )}
      data-ai-pending-stack-state="collapsed"
    >
      <div className="relative">
        {visibleStackCards
          .slice(1)
          .reverse()
          .map((entry, index) => (
            <div
              key={entry.id}
              data-testid="ai-pending-stack-card"
              aria-hidden
              className={cn(
                "bg-surface-2/60 glass-border absolute inset-x-1 top-0 h-12 rounded-[18px]",
                index === 0 && "translate-y-2 scale-[0.98]",
                index === 1 && "translate-y-4 scale-[0.96]"
              )}
            />
          ))}
        <div
          data-testid="ai-pending-stack-card"
          className={cn(canExpand && visibleStackCards.length > 1 && "pb-4")}
        >
          <AIQuickEntryRow entry={frontEntry} variant="pending" />
        </div>
      </div>
    </button>
  );
};

export default AIQuickEntryPendingStack;
