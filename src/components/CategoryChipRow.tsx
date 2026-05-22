"use client";

import React, { useMemo, useState } from "react";

import { Category } from "@/enums";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import ExpenseItemIcon from "./ExpenseItemIcon";

export type TCategoryChipRowProps = {
  value: Category;
  onChange: (next: Category) => void;
};

const ALL_CATEGORIES = Object.values(Category) as Category[];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const CategoryChipRow = ({ value, onChange }: TCategoryChipRowProps) => {
  const [expanded, setExpanded] = useState(false);

  const orderedCategories = useMemo(() => {
    if (!expanded) {
      return [value];
    }
    return [value, ...ALL_CATEGORIES.filter((c) => c !== value)];
  }, [expanded, value]);

  const handleChipClick = (category: Category) => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    if (category !== value) {
      onChange(category);
    }
    setExpanded(false);
  };

  return (
    <div
      className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pt-1"
      role="radiogroup"
      aria-label="Category"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {orderedCategories.map((category) => {
          const isActive = category === value;
          const showChevron = isActive && !expanded;
          return (
            <motion.button
              layout
              key={category}
              type="button"
              onClick={() => handleChipClick(category)}
              aria-pressed={isActive}
              initial={{ opacity: 0, x: -12, filter: "blur(2px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -12, filter: "blur(2px)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium",
                isActive
                  ? "border-foreground/20 bg-muted"
                  : "bg-muted/50 hover:bg-muted border-transparent"
              )}
            >
              <ExpenseItemIcon category={category} size="sm" />
              <motion.span className="whitespace-nowrap">
                {category}
              </motion.span>
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

export default CategoryChipRow;
