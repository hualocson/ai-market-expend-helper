"use client";

import React from "react";
import { useEffect, useMemo, useRef } from "react";

import { Category } from "@/enums";
import {
  type BudgetColorId,
  getBudgetColorOption,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import type { ExpenseListItemSyncStatus } from "@/lib/expenses/list-model";
import { cn, formatVnd } from "@/lib/utils";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import PaidByIcon from "@/components/PaidByIcon";
import VndSymbol from "@/components/VndSymbol";

export type ExpenseListItemData = {
  id: number;
  clientId?: string | null;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon: string | null;
  budgetColor: BudgetColorId | null;
  syncStatus?: ExpenseListItemSyncStatus;
};

type ExpenseListItemProps = {
  actionOpen: boolean;
  expense: ExpenseListItemData;
  onActionOpenChange: (open: boolean) => void;
  onDeleteExpense: (expense: ExpenseListItemData) => void;
  onEditExpense: (expense: ExpenseListItemData) => void;
};

const ACTION_WIDTH = 270;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3;
const CLOSE_THRESHOLD = ACTION_WIDTH * 0.1;
const VELOCITY_THRESHOLD = 600;
const OPEN_EVENT_NAME = "expense-list-item-open";

const EXPENSE_SYNC_DOT_LABEL: Record<
  Exclude<ExpenseListItemSyncStatus, "synced">,
  string
> = {
  pending: "Sync pending",
  failed: "Sync failed",
};

const ExpenseSyncStatusDot = ({
  status,
}: {
  status?: ExpenseListItemSyncStatus;
}) => {
  if (status !== "pending" && status !== "failed") {
    return null;
  }

  const label = EXPENSE_SYNC_DOT_LABEL[status];

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "pending" &&
          "bg-slate-400 shadow-[0_0_10px_rgb(148_163_184_/_0.45)]",
        status === "failed" &&
          "bg-destructive shadow-[0_0_10px_color-mix(in_srgb,var(--destructive)_45%,transparent)]"
      )}
    />
  );
};

const CategoryBadge = ({ category }: { category: string }) => (
  <span
    aria-label={`Category: ${category}`}
    className="bg-muted text-muted-foreground inline-flex max-w-[150px] min-w-0 items-center gap-1.5 rounded-2xl py-0.5 pr-2 pl-0.5 text-sm"
  >
    <ExpenseItemIcon
      category={category as Category}
      size="sm"
      className="size-5 shrink-0"
    />
    <span className="min-w-0 truncate">{category}</span>
  </span>
);

const BudgetIcon = ({
  icon,
  color,
}: {
  icon: string | null;
  color: BudgetColorId | null;
}) => {
  const normalizedIcon = normalizeBudgetIcon(icon);
  const colorOption = getBudgetColorOption(normalizeBudgetColor(color));

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-full text-xl font-medium",
        colorOption.chipClassName
      )}
    >
      {normalizedIcon}
    </span>
  );
};

const BudgetName = ({ name }: { name: string }) => (
  <span
    aria-label={`Budget: ${name}`}
    className="text-muted-foreground max-w-[160px] min-w-0 truncate text-sm"
  >
    {name}
  </span>
);

const ExpenseListItem = ({
  actionOpen,
  expense,
  onActionOpenChange,
  onDeleteExpense,
  onEditExpense,
}: ExpenseListItemProps) => {
  const isOpen = actionOpen;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragClickGuardRef = useRef(false);

  const formattedAmount = useMemo(
    () => formatVnd(expense.amount),
    [expense.amount]
  );
  const budgetBadgeLabel = useMemo(() => {
    if (expense.budgetName?.trim()) {
      return expense.budgetName;
    }
    if (expense.budgetId) {
      return "Budget assigned";
    }
    return "";
  }, [expense.budgetId, expense.budgetName]);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const { x: offsetX } = info.offset;
    const { x: velocityX } = info.velocity;
    const shouldOpen =
      offsetX <= -OPEN_THRESHOLD || velocityX <= -VELOCITY_THRESHOLD;
    const shouldClose =
      offsetX >= -CLOSE_THRESHOLD || velocityX >= VELOCITY_THRESHOLD;

    if (shouldOpen && !isOpen) {
      onActionOpenChange(true);
      window.dispatchEvent(
        new CustomEvent(OPEN_EVENT_NAME, { detail: expense.id })
      );
      return;
    }

    if (shouldClose && isOpen) {
      onActionOpenChange(false);
    }

    window.setTimeout(() => {
      dragClickGuardRef.current = false;
    }, 0);
  };

  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      const detailId =
        event instanceof CustomEvent ? (event.detail as number) : null;

      if (isOpen && detailId !== expense.id) {
        onActionOpenChange(false);
      }
    };

    window.addEventListener(OPEN_EVENT_NAME, handleOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT_NAME, handleOtherOpen);
  }, [expense.id, isOpen, onActionOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(target)) {
        onActionOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", handleOutsidePointer);
    return () =>
      window.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isOpen, onActionOpenChange]);

  const handleDeleteRequest = () => {
    onDeleteExpense(expense);
    onActionOpenChange(false);
  };

  const handleDuplicate = () => {
    dispatchExpensePrefill({
      amount: expense.amount,
      note: expense.note ?? "",
      category: expense.category,
      source: "repeat_entry",
    });
    onActionOpenChange(false);
  };

  const openEditSheet = () => {
    onEditExpense(expense);
    onActionOpenChange(false);
  };

  const handleItemClick = () => {
    if (dragClickGuardRef.current) {
      dragClickGuardRef.current = false;
      return;
    }

    openEditSheet();
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openEditSheet();
  };

  return (
    <div
      className="bg-surface-2/65 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]"
      ref={containerRef}
      data-expense-list-item
    >
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="expense-row-actions"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 40,
              mass: 0.7,
              duration: 0.4,
            }}
            className="absolute inset-y-0 right-0 z-50 flex items-center justify-end gap-2"
          >
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Duplicate expense"
              onClick={handleDuplicate}
              className="backdrop-blur-md"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Edit expense"
              onClick={openEditSheet}
              className="backdrop-blur-md"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              aria-label="Delete expense"
              onClick={handleDeleteRequest}
              className="backdrop-blur-md"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onClick={handleItemClick}
        onDragStart={() => {
          dragClickGuardRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onKeyDown={handleItemKeyDown}
        dragTransition={{
          bounceStiffness: 500,
          bounceDamping: 15,
          min: 20,
        }}
        role="button"
        tabIndex={0}
        aria-label={`Edit expense ${expense.note || expense.category}`}
        className="focus-visible:ring-ring/40 relative cursor-pointer rounded-[16px] transition-[transform] outline-none focus-visible:ring-2 active:scale-[0.99]"
        whileDrag={{ cursor: "grabbing" }}
        animate={{
          opacity: isOpen ? 0.3 : 1,
          paddingLeft: isOpen ? 8 : 0,
          paddingRight: isOpen ? 8 : 0,
          scale: isOpen ? 0.96 : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {expense.budgetId ? (
            <BudgetIcon
              icon={expense.budgetIcon ?? null}
              color={expense.budgetColor ?? null}
            />
          ) : (
            <ExpenseItemIcon
              category={expense.category as Category}
              className={cn(
                "shrink-0",
                !expense.note && "bg-warning/15 text-warning"
              )}
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-foreground/90 truncate font-semibold">
              {expense.note || "<No note>"}
            </p>
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <CategoryBadge category={expense.category} />
              {expense.budgetId ? (
                <BudgetName name={budgetBadgeLabel} />
              ) : (
                <span className="bg-warning size-2 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--warning)_55%,transparent)]" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-destructive text-right text-sm font-semibold">
              -{formattedAmount} <VndSymbol />
            </p>
            {expense.paidBy || expense.syncStatus ? (
              <div className="flex items-center justify-end gap-1.5">
                <ExpenseSyncStatusDot status={expense.syncStatus} />
                {expense.paidBy ? (
                  <PaidByIcon paidBy={expense.paidBy} size="sm" />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(ExpenseListItem);
