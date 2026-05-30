"use client";

import React from "react";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type AIQuickEntryStatusBarProps = {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  completedOpen: boolean;
  onToggleCompleted: () => void;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const buildVisibleLabel = ({
  totalCount,
  pendingCount,
  completedCount,
  failedCount,
}: Pick<
  AIQuickEntryStatusBarProps,
  "totalCount" | "pendingCount" | "completedCount" | "failedCount"
>) => {
  const parts = [pluralize(totalCount, "entry", "entries")];

  if (pendingCount > 0) {
    parts.push(`${pendingCount} parsing`);
  }
  if (completedCount > 0) {
    parts.push(`${completedCount} done`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return parts.join(" · ");
};

const buildAccessibleLabel = ({
  totalCount,
  pendingCount,
  completedCount,
  failedCount,
  completedOpen,
}: AIQuickEntryStatusBarProps) => {
  const parts = [`${pluralize(totalCount, "entry", "entries")}`];

  if (pendingCount > 0) {
    parts.push(`${pendingCount} parsing`);
  }
  if (completedCount > 0) {
    parts.push(`${completedCount} completed`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return `AI quick entry status: ${parts.join(", ")}. ${
    completedOpen ? "Hide" : "Show"
  } completed entries.`;
};

const AIQuickEntryStatusBar = (props: AIQuickEntryStatusBarProps) => {
  const {
    completedOpen,
    onToggleCompleted,
    totalCount,
    pendingCount,
    completedCount,
    failedCount,
  } = props;

  if (totalCount <= 0) {
    return null;
  }

  return (
    <button
      type="button"
      aria-expanded={completedOpen}
      aria-label={buildAccessibleLabel(props)}
      onClick={onToggleCompleted}
      onPointerDown={(event) => event.preventDefault()}
      className="text-muted-foreground mx-auto flex h-8 max-w-[390px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium"
    >
      <span>
        {buildVisibleLabel({
          totalCount,
          pendingCount,
          completedCount,
          failedCount,
        })}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "size-3.5 transition-transform duration-150 ease-out",
          completedOpen && "rotate-180"
        )}
      />
    </button>
  );
};

export default AIQuickEntryStatusBar;
