"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { useDeleteExpenseMutation } from "@/lib/mutations";
import { cn, formatVnd } from "@/lib/utils";
import { Copy, NotebookIcon, Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import PaidByIcon from "@/components/PaidByIcon";
import VndSymbol from "@/components/VndSymbol";

export type ExpenseListItemData = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
};

type ExpenseListItemProps = {
  expense: ExpenseListItemData;
  onEditExpense: (expense: ExpenseListItemData) => void;
};

const ACTION_WIDTH = 270;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3;
const CLOSE_THRESHOLD = ACTION_WIDTH * 0.1;
const VELOCITY_THRESHOLD = 600;
const OPEN_EVENT_NAME = "expense-list-item-open";

const ExpenseListItem = ({ expense, onEditExpense }: ExpenseListItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteExpenseMutation = useDeleteExpenseMutation();
  const isDeleting = deleteExpenseMutation.isPending;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragClickGuardRef = useRef(false);

  const formattedAmount = useMemo(
    () => formatVnd(expense.amount),
    [expense.amount]
  );
  const formattedDate = useMemo(
    () => dayjs(expense.date).format("DD/MM/YYYY"),
    [expense.date]
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
      setIsOpen(true);
      window.dispatchEvent(
        new CustomEvent(OPEN_EVENT_NAME, { detail: expense.id })
      );
      return;
    }

    if (shouldClose && isOpen) {
      setIsOpen(false);
    }

    window.setTimeout(() => {
      dragClickGuardRef.current = false;
    }, 0);
  };

  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      const detailId =
        event instanceof CustomEvent ? (event.detail as number) : null;

      if (detailId !== expense.id) {
        setIsOpen(false);
      }
    };

    window.addEventListener(OPEN_EVENT_NAME, handleOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT_NAME, handleOtherOpen);
  }, [expense.id]);

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
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleOutsidePointer);
    return () =>
      window.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isOpen]);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    const loadingToastId = toast.loading("Deleting expense...");

    try {
      await deleteExpenseMutation.mutateAsync(expense.id);
      toast.success("Expense deleted.", { id: loadingToastId });
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.", { id: loadingToastId });
    }
  };

  const handleDeleteRequest = () => {
    setConfirmOpen(true);
    setIsOpen(false);
  };

  const handleDuplicate = () => {
    dispatchExpensePrefill({
      amount: expense.amount,
      note: expense.note ?? "",
      category: expense.category,
      source: "repeat_entry",
    });
    setIsOpen(false);
  };

  const openEditSheet = () => {
    onEditExpense(expense);
    setIsOpen(false);
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
    <>
      <div
        className="bg-surface-2/85 relative isolate overflow-hidden rounded-[22px] px-3 py-3 shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_52%,transparent)]"
        ref={containerRef}
        data-expense-list-item
      >
        <motion.div
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? "0%" : "100%" }}
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
            disabled={isDeleting}
            className="backdrop-blur-md"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </motion.div>

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
            <ExpenseItemIcon
              category={expense.category as Category}
              className={cn(
                "shrink-0",
                !expense.note && "bg-warning/15 text-warning"
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-foreground/90 truncate font-semibold">
                {expense.note || "<No note>"}
              </p>
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <p className="bg-muted text-muted-foreground max-w-[140px] truncate rounded-2xl px-3 text-sm">
                  {expense.category}
                </p>
                {expense.budgetId ? (
                  <p className="bg-success/10 text-success max-w-[160px] truncate rounded-2xl px-3 text-sm">
                    {budgetBadgeLabel}
                  </p>
                ) : (
                  <span className="bg-warning size-2 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--warning)_55%,transparent)]" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-destructive text-right text-sm font-semibold">
                -{formattedAmount} <VndSymbol />
              </p>
              {expense.paidBy ? (
                <div className="flex justify-end">
                  <PaidByIcon paidBy={expense.paidBy} size="sm" />
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <div className="bg-muted/40 flex items-start gap-4 border-b px-6 py-5">
            <div className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle>Delete this expense?</DialogTitle>
              <DialogDescription>
                We will remove it from your list. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="bg-card/80 border-border mx-2 space-y-4 rounded-xl border p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">{formattedDate}</p>
                <div className="flex items-center gap-2">
                  <ExpenseItemIcon
                    category={expense.category as Category}
                    size="sm"
                  />
                  <span className="text-sm font-medium">
                    {expense.category}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Amount
                </p>
                <p className="text-destructive text-lg font-semibold">
                  -{formattedAmount} <VndSymbol />
                </p>
              </div>
            </div>
            {expense.note ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <NotebookIcon className="size-4" />
                <span className="text-sm font-medium">{expense.note}</span>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeleting}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                await handleDelete();
                setConfirmOpen(false);
              }}
              disabled={isDeleting}
            >
              Delete expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(ExpenseListItem);
