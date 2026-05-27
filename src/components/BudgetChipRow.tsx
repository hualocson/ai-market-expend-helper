"use client";

import React, { useMemo, useState } from "react";

import {
  type BudgetColorId,
  getBudgetColorOption,
  normalizeBudgetColor,
} from "@/lib/budget-appearance";
import { type TBudgetOption, groupBudgetOptions } from "@/lib/budget-options";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import BudgetBadge from "./BudgetBadge";

export type TBudgetChipRowSelectedBudget = {
  id: number;
  name?: string | null;
  icon?: string | null;
  color?: BudgetColorId | string | null;
};

export type TBudgetChipRowProps = {
  value: number | null;
  options: TBudgetOption[];
  selectedBudget?: TBudgetChipRowSelectedBudget | null;
  loading?: boolean;
  suggesting?: boolean;
  onChange: (next: number | null) => void;
};

type TBudgetChipOption =
  | {
      kind: "none";
      key: "none";
      id: null;
      name: "No budget";
    }
  | {
      kind: "budget";
      key: string;
      id: number;
      name: string;
      icon?: string | null;
      color?: BudgetColorId | string | null;
    }
  | {
      kind: "loading";
      key: "loading";
      id: null;
      name: "Loading budgets";
    };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NO_BUDGET_OPTION: TBudgetChipOption = {
  kind: "none",
  key: "none",
  id: null,
  name: "No budget",
};
const LOADING_OPTION: TBudgetChipOption = {
  kind: "loading",
  key: "loading",
  id: null,
  name: "Loading budgets",
};

const getButtonToneClassName = (
  option: TBudgetChipOption,
  isActive: boolean
) => {
  if (option.kind === "budget") {
    return getBudgetColorOption(normalizeBudgetColor(option.color))
      .chipClassName;
  }
  if (option.kind === "loading") {
    return "text-muted-foreground bg-muted/50 hover:bg-muted/50";
  }
  return isActive ? "bg-white/10" : "bg-muted/50 hover:bg-muted";
};

const BudgetChipRow = ({
  value,
  options,
  selectedBudget,
  loading = false,
  suggesting = false,
  onChange,
}: TBudgetChipRowProps) => {
  const [expanded, setExpanded] = useState(false);

  const budgetOptions = useMemo(() => {
    const groups = groupBudgetOptions(options);
    return [...groups.week, ...groups.month, ...groups.custom].map(
      (budget): TBudgetChipOption => ({
        kind: "budget",
        key: `budget-${budget.id}`,
        id: budget.id,
        name: budget.name,
        icon: budget.icon,
        color: budget.color,
      })
    );
  }, [options]);

  const selectedOption = useMemo((): TBudgetChipOption => {
    if (value === null) {
      return NO_BUDGET_OPTION;
    }

    const fetched = budgetOptions.find((budget) => budget.id === value);
    if (fetched) {
      return fetched;
    }

    if (selectedBudget?.id === value) {
      return {
        kind: "budget",
        key: `budget-${selectedBudget.id}`,
        id: selectedBudget.id,
        name: selectedBudget.name ?? "Budget",
        icon: selectedBudget.icon,
        color: selectedBudget.color,
      };
    }

    return {
      kind: "budget",
      key: `budget-${value}`,
      id: value,
      name: "Budget",
    };
  }, [budgetOptions, selectedBudget, value]);

  const orderedOptions = useMemo(() => {
    if (!expanded) {
      return [selectedOption];
    }

    const rest = [NO_BUDGET_OPTION, ...budgetOptions].filter(
      (option) => option.key !== selectedOption.key
    );
    if (loading) {
      rest.push(LOADING_OPTION);
    }
    return [selectedOption, ...rest];
  }, [budgetOptions, expanded, loading, selectedOption]);

  const handleChipClick = (option: TBudgetChipOption) => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    if (option.kind === "loading") {
      return;
    }
    if (option.id !== value) {
      onChange(option.id);
    }
    setExpanded(false);
  };

  const handleChipPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  return (
    <div
      className="no-scrollbar flex w-[100svw] items-center gap-2 overflow-x-auto pt-1 pr-4"
      role="radiogroup"
      aria-label="Budget"
      aria-busy={loading}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {suggesting ? (
          <motion.div
            layout
            role="status"
            aria-label="Suggesting budget"
            key="suggesting-budget"
            initial={{ opacity: 0, x: -12, filter: "blur(2px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -12, filter: "blur(2px)" }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="text-muted-foreground bg-muted/50 ml-4 grid size-9 shrink-0 place-items-center rounded-full border-none"
          >
            <span className="bg-background/30 grid size-5 shrink-0 place-items-center rounded-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </span>
          </motion.div>
        ) : null}
        {orderedOptions.map((option, index) => {
          const isActive = option.kind !== "loading" && option.id === value;
          const showChevron = isActive && !expanded;
          const isFirstItem = index === 0;
          return (
            <motion.button
              layout
              key={option.key}
              type="button"
              onPointerDown={handleChipPointerDown}
              onClick={() => handleChipClick(option)}
              aria-label={option.name}
              aria-pressed={isActive}
              disabled={option.kind === "loading"}
              initial={{ opacity: 0, x: -12, filter: "blur(2px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -12, filter: "blur(2px)" }}
              whileTap={{ scale: option.kind === "loading" ? 1 : 0.97 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border-none px-3 py-2 text-sm font-medium",
                getButtonToneClassName(option, isActive),
                isFirstItem && !suggesting && "ml-4"
              )}
            >
              {option.kind === "budget" ? (
                <BudgetBadge
                  icon={option.icon}
                  color={option.color}
                  name={option.name}
                  className="border-0 bg-transparent p-0 text-current"
                  iconClassName="size-5 text-sm"
                  nameClassName="text-sm font-medium"
                />
              ) : (
                <>
                  <span className="bg-background/30 grid size-5 shrink-0 place-items-center rounded-full">
                    {option.kind === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wallet className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <motion.span className="whitespace-nowrap">
                    {option.name}
                  </motion.span>
                </>
              )}
              <AnimatePresence initial={false} mode="popLayout">
                {showChevron && (
                  <motion.span
                    layout
                    key="chevron"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, x: -6, filter: "blur(2px)" }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="flex"
                  >
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default BudgetChipRow;
