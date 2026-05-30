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
      className="glass-border-b mx-auto flex h-9 max-w-[320px] items-center justify-center gap-1.5 rounded-full bg-black/90 px-4 text-xs font-semibold text-white shadow-[0_14px_36px_color-mix(in_srgb,#000000_70%,transparent)]"
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
