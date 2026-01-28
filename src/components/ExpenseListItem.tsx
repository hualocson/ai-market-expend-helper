"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import {
  deleteExpenseEntry,
  updateExpenseEntry,
} from "@/app/actions/expense-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { cn, formatVnd } from "@/lib/utils";
import { Copy, Loader2, NotebookIcon, Pencil, Trash2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import ManualExpenseForm, {
  type ManualExpenseFormHandle,
} from "@/components/ManualExpenseForm";
import PaidByIcon from "@/components/PaidByIcon";

type ExpenseListItemData = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId?: number | null;
  budgetName?: string | null;
};

const ACTION_WIDTH = 270;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3;
const CLOSE_THRESHOLD = ACTION_WIDTH * 0.1;
const VELOCITY_THRESHOLD = 600;
const OPEN_EVENT_NAME = "expense-list-item-open";

const ExpenseListItem = ({ expense }: { expense: ExpenseListItemData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFormState, setEditFormState] = useState({
    canSubmit: false,
    loading: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const editFormRef = useRef<ManualExpenseFormHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editSubmitLabel = "Update Expense";
  const editLoadingLabel = "Updating...";

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
  const initialExpense = useMemo(
    () => ({
      date: formattedDate,
      amount: expense.amount,
      note: expense.note,
      category: expense.category,
      paidBy: expense.paidBy,
      budgetId: expense.budgetId ?? null,
    }),
    [
      expense.amount,
      expense.category,
      expense.note,
      expense.paidBy,
      expense.budgetId,
      formattedDate,
    ]
  );

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

    try {
      setIsDeleting(true);
      await deleteExpenseEntry(expense.id);
      toast.success("Expense deleted.");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRequest = () => {
    setConfirmOpen(true);
    setIsOpen(false);
  };

  const handleUpdate = async (
    payload: TExpense & { paidBy: string; budgetId?: number | null }
  ) => {
    await updateExpenseEntry(expense.id, payload);
    router.refresh();
  };

  const handleDuplicate = () => {
    dispatchExpensePrefill({
      amount: expense.amount,
      note: expense.note ?? "",
      category: expense.category,
    });
    setIsOpen(false);
  };

  return (
    <>
      <div
        className="relative isolate overflow-hidden"
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
            onClick={handleDuplicate}
            className="backdrop-blur-md"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => {
              setEditOpen(true);
              setIsOpen(false);
            }}
            className="backdrop-blur-md"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
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
          onDragEnd={handleDragEnd}
          dragTransition={{
            bounceStiffness: 500,
            bounceDamping: 15,
            min: 20,
          }}
          className="relative"
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
                !expense.note && "bg-amber-400/10 text-amber-300"
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-muted-foreground truncate font-semibold">
                {expense.note || "<No note>"}
              </p>
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <p className="max-w-[140px] truncate rounded-2xl bg-gray-500/30 px-3 text-sm text-gray-500">
                  {expense.category}
                </p>
                {expense.budgetId ? (
                  <p className="max-w-[160px] truncate rounded-2xl bg-emerald-400/10 px-3 text-sm text-emerald-300">
                    {budgetBadgeLabel}
                  </p>
                ) : (
                  <span className="size-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-right text-sm font-semibold text-rose-400">
                -{formattedAmount} VND
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

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="h-svh w-[90svw] backdrop-blur">
          <SheetHeader className="text-left">
            <SheetTitle>Edit expense</SheetTitle>
            <SheetDescription>
              Update the details for this entry.
            </SheetDescription>
          </SheetHeader>
          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
            <ManualExpenseForm
              ref={editFormRef}
              initialExpense={initialExpense}
              onSubmit={handleUpdate}
              submitLabel={editSubmitLabel}
              loadingLabel={editLoadingLabel}
              successMessage="Expense updated successfully!"
              errorMessage="Failed to update expense."
              onSuccess={() => setEditOpen(false)}
              showSubmitButton={false}
              onStateChange={setEditFormState}
              showBudgetSelect
            />
          </div>
          <SheetFooter className="border-t">
            <Button
              onClick={() => editFormRef.current?.submit()}
              disabled={!editFormState.canSubmit || editFormState.loading}
              className="h-10 w-full rounded-xl text-base font-medium"
            >
              {editFormState.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editLoadingLabel}
                </>
              ) : (
                editSubmitLabel
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
          <div className="mx-2 space-y-4 rounded-xl border border-white/15 bg-white/5 p-4 shadow-sm">
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
                  -{formattedAmount} VND
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

export default ExpenseListItem;
