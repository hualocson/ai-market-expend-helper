"use client";

import { useEffect, useRef, useState } from "react";

import { Category } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { cn, formatVnd } from "@/lib/utils";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";

type PrefillChip = {
  note: string;
  category: Category;
  amount: number;
  totalFrequency: number;
};

const ExpensePrefillChipsClient = ({ items }: { items: PrefillChip[] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Handle scroll to update fade visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;

      // Show left fade if scrolled from start
      setShowLeftFade(scrollLeft > 10);

      // Show right fade if not scrolled to end
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    };

    // Initial check
    handleScroll();

    container.addEventListener("scroll", handleScroll);

    // Also check on resize
    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [items]);

  // Generate dynamic mask image based on scroll position
  const getMaskImage = () => {
    if (showLeftFade && showRightFade) {
      return "linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)";
    } else if (showLeftFade && !showRightFade) {
      return "linear-gradient(to right, transparent, black 2rem, black 100%)";
    } else if (!showLeftFade && showRightFade) {
      return "linear-gradient(to right, black 0%, black calc(100% - 2rem), transparent)";
    }
    return "none";
  };

  const maskImage = getMaskImage();

  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          Quick add
        </p>
      </div>
      <div
        ref={scrollContainerRef}
        className="no-scrollbar flex gap-2 overflow-x-auto pb-2"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        {items.map((item) => {
          const noteValue = item.note?.trim() ?? "";
          const noteLabel = noteValue.length ? noteValue : "Untitled";
          return (
            <button
              key={`${item.category}-${noteLabel}-${item.amount}-${item.totalFrequency}`}
              type="button"
              onClick={() =>
                dispatchExpensePrefill({
                  amount: item.amount,
                  note: noteValue,
                  category: item.category,
                })
              }
              className={cn(
                "flex min-w-[140px] items-center gap-2 rounded-3xl border border-transparent bg-white/10 px-2 py-1 text-left transition select-none hover:bg-white/20 active:scale-[0.96] active:bg-white/15"
              )}
            >
              <ExpenseItemIcon category={item.category} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{noteLabel}</p>
                <p className="text-muted-foreground text-xs">
                  {formatVnd(item.amount)} VND
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ExpensePrefillChipsClient;
