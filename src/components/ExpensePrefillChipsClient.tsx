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
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
          Quick add
        </p>
      </div>
      <div
        ref={scrollContainerRef}
        className="no-scrollbar flex gap-3 overflow-x-auto pb-2"
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
                  source: "home_prefill",
                })
              }
              className={cn(
                "bg-surface-2 group flex min-h-14 min-w-[168px] items-center gap-3 rounded-[24px] border border-border/45 px-3 py-3 text-left shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_38%,transparent)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out select-none hover:-translate-y-0.5 hover:border-ring/20 hover:bg-surface-3 focus-visible:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none active:scale-[0.98] active:bg-secondary"
              )}
            >
              <ExpenseItemIcon category={item.category} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {noteLabel}
                </p>
                <p className="text-muted-foreground text-xs font-medium">
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
