"use client";

import React from "react";

import {
  BUDGET_COLOR_OPTIONS,
  type BudgetColorId,
} from "@/lib/budget-appearance";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type BudgetColorListProps = {
  value: BudgetColorId;
  onChange: (color: BudgetColorId) => void;
  className?: string;
};

const BudgetColorList = ({
  value,
  onChange,
  className,
}: BudgetColorListProps) => (
  <div
    aria-label="Budget colors"
    className={cn(
      "no-scrollbar -mx-1 flex flex-nowrap gap-2 overflow-x-auto pr-4 pb-1",
      className
    )}
  >
    {BUDGET_COLOR_OPTIONS.map((option, index) => {
      const selected = value === option.id;
      const isFirstItem = index === 0;

      return (
        <button
          key={option.id}
          type="button"
          aria-label={`Budget color ${option.label}`}
          aria-pressed={selected}
          onClick={() => onChange(option.id)}
          className={cn(
            "relative grid shrink-0 place-items-center rounded-full border transition-[transform,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none active:scale-[0.96]",
            selected ? "border-primary/40 shadow-sm" : "border-white/10",
            isFirstItem && "ml-4"
          )}
        >
          <span className={cn("size-8 rounded-full", option.swatchClassName)} />
          {selected ? (
            <Check className="text-foreground absolute h-3.5 w-3.5" />
          ) : null}
        </button>
      );
    })}
  </div>
);

export default BudgetColorList;
