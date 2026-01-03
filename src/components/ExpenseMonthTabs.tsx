"use client";

import { useEffect, useRef } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

type MonthItem = {
  value: string;
  label: string;
  href: string;
  isActive: boolean;
};

type ExpenseMonthTabsProps = {
  items: MonthItem[];
};

const ExpenseMonthTabs = ({ items }: ExpenseMonthTabsProps) => {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!activeRef.current) {
      return;
    }
    activeRef.current.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
    activeRef.current.focus({ preventScroll: true });
  }, []);

  return (
    <div className="no-scrollbar scroll-fade-x flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto pr-2 pb-2">
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          ref={item.isActive ? activeRef : undefined}
          aria-current={item.isActive ? "date" : undefined}
          className={cn(
            "snap-center rounded-full px-5 py-2 text-xs font-medium transition-all focus:ring-0 focus:ring-offset-0 focus:outline-none",
            item.isActive
              ? "bg-foreground text-background"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};

export default ExpenseMonthTabs;
