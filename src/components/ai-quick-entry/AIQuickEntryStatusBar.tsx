"use client";

import React from "react";

import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

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

type StatusCountProps = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  count: number;
  testId: string;
  className?: string;
};

const StatusCount = ({
  icon: Icon,
  count,
  testId,
  className,
}: StatusCountProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 text-white/90 tabular-nums",
      className
    )}
  >
    <Icon aria-hidden className="size-3.5" />
    <span data-testid={testId}>{count}</span>
  </span>
);

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
      className="glass-border ds-glass mx-auto flex h-9 max-w-[320px] items-center justify-center gap-1.5 rounded-full bg-black/85 px-4 text-xs font-semibold text-white"
    >
      <span className="flex items-center gap-2.5">
        <StatusCount
          icon={Sparkles}
          count={totalCount}
          testId="ai-status-total-count"
        />
        {pendingCount > 0 ? (
          <StatusCount
            icon={LoaderCircle}
            count={pendingCount}
            testId="ai-status-pending-count"
            className="[&_svg]:animate-spin"
          />
        ) : null}
        {completedCount > 0 ? (
          <StatusCount
            icon={Check}
            count={completedCount}
            testId="ai-status-completed-count"
          />
        ) : null}
        {failedCount > 0 ? (
          <StatusCount
            icon={TriangleAlert}
            count={failedCount}
            testId="ai-status-failed-count"
            className="text-destructive [&_svg]:text-destructive [&_[data-testid]]:text-destructive"
          />
        ) : null}
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
