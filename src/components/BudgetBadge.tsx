"use client";

import React from "react";

import {
  type BudgetColorId,
  getBudgetColorOption,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { cn } from "@/lib/utils";

export type TBudgetBadgeProps = {
  icon?: string | null;
  color?: BudgetColorId | string | null;
  name?: string | null;
  iconOnly?: boolean;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
};

const BudgetBadge = ({
  icon,
  color,
  name,
  iconOnly = false,
  className,
  iconClassName,
  nameClassName,
}: TBudgetBadgeProps) => {
  const normalizedIcon = normalizeBudgetIcon(icon);
  const colorOption = getBudgetColorOption(normalizeBudgetColor(color));
  const label = name?.trim() || "Budget assigned";

  return (
    <span
      aria-label={`Budget: ${label}`}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium",
        colorOption.chipClassName,
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center text-sm",
          iconClassName
        )}
      >
        {normalizedIcon}
      </span>
      {iconOnly ? null : (
        <span className={cn("min-w-0 truncate", nameClassName)}>{label}</span>
      )}
    </span>
  );
};

export default BudgetBadge;
