"use client";

import React, { type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";

type AIQuickEntryStatusBarProps = {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  onOpenPreview: () => void;
};

const animationVars = {
  "--resize-dur": "300ms",
  "--resize-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
} as CSSProperties;

const buildAccessibleLabel = ({
  pendingCount,
  completedCount,
  failedCount,
}: AIQuickEntryStatusBarProps) => {
  const parts = [];

  if (pendingCount > 0) {
    parts.push(`${pendingCount} parsing`);
  }
  if (completedCount > 0) {
    parts.push(`${completedCount} completed`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return `AI quick entry status: ${
    parts.length > 0 ? parts.join(", ") : "no entries"
  }. Open preview.`;
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
    totalCount,
    onOpenPreview,
    pendingCount,
    completedCount,
    failedCount,
  } = props;

  return (
    <button
      type="button"
      aria-label={buildAccessibleLabel(props)}
      onClick={onOpenPreview}
      onPointerDown={(event) => event.preventDefault()}
      className={cn(
        "glass-border ds-glass mx-auto flex h-11 max-w-[320px] min-w-[150px] items-center justify-between gap-1.5 rounded-[20px] bg-black/85 px-4 text-xs font-semibold text-white",
        pendingCount > 0 && "bg-amber-200/15"
      )}
      style={{
        ...animationVars,
        width: pendingCount > 0 ? 250 : 150,
        height: 44,
        transition: "width var(--resize-dur) var(--resize-ease)",
        willChange: "width, height",
      }}
    >
      <span className="flex items-center gap-2.5">
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
        {pendingCount > 0 ? (
          <StatusCount
            icon={LoaderCircle}
            count={pendingCount}
            testId="ai-status-pending-count"
            className="[&_svg]:animate-spin"
          />
        ) : null}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "size-3.5 transition-transform duration-150 ease-out",
          totalCount === 0 && "opacity-0"
        )}
      />
    </button>
  );
};

export default AIQuickEntryStatusBar;
