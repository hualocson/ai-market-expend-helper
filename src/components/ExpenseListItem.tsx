"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  deleteExpenseEntry,
  updateExpenseEntry,
} from "@/app/actions/expense-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { formatVnd } from "@/lib/utils";
import { Pencil, Trash2, XIcon } from "lucide-react";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import ManualExpenseForm from "@/components/ManualExpenseForm";

type ExpenseListItemData = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
};

const ACTION_WIDTH = 180;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3;
const CLOSE_THRESHOLD = ACTION_WIDTH * 0.1;
const VELOCITY_THRESHOLD = 600;
const OPEN_EVENT_NAME = "expense-list-item-open";

const ExpenseListItem = ({ expense }: { expense: ExpenseListItemData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const formattedAmount = useMemo(
    () => formatVnd(expense.amount),
    [expense.amount]
  );
  const formattedDate = useMemo(
    () => dayjs(expense.date).format("DD/MM/YYYY"),
    [expense.date]
  );
  const initialExpense = useMemo(
    () => ({
      date: formattedDate,
      amount: expense.amount,
      note: expense.note,
      category: expense.category,
      paidBy: expense.paidBy,
    }),
    [
      expense.amount,
      expense.category,
      expense.note,
      expense.paidBy,
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
    return () =>
      window.removeEventListener(OPEN_EVENT_NAME, handleOtherOpen);
  }, [expense.id]);

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

  const handleUpdate = async (payload: TExpense & { paidBy: string }) => {
    await updateExpenseEntry(expense.id, payload);
    router.refresh();
  };

  return (
    <>
      <div className="relative isolate overflow-hidden">
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
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditOpen(true);
              setIsOpen(false);
            }}
          >
            <Pencil className="h-4 w-4" />
            Update
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleDeleteRequest}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            Delete
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
          animate={{ opacity: isOpen ? 0.3 : 1, scale: isOpen ? 0.9 : 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-wrap items-center gap-4 py-4">
            <ExpenseItemIcon category={expense.category as Category} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-foreground truncate text-base font-semibold">
                {expense.category}
              </p>
              {expense.note ? (
                <p className="text-muted-foreground truncate text-xs">
                  {expense.note}
                </p>
              ) : null}
            </div>
            <div className="text-foreground text-right text-sm font-semibold">
              -{formattedAmount} VND
            </div>
          </div>
        </motion.div>
      </div>

      <Drawer open={editOpen} onOpenChange={setEditOpen} direction="right">
        <DrawerContent className="backdrop-blur data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:max-w-[min(100svw,680px)]!">
          <DrawerHeader className="text-left">
            <DrawerTitle>Edit expense</DrawerTitle>
            <DrawerDescription>
              Update the details for this entry.
            </DrawerDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 rounded-full"
              onClick={() => setEditOpen(false)}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          <div className="no-scrollbar overflow-y-auto px-4 pb-6 sm:px-6">
            <ManualExpenseForm
              initialExpense={initialExpense}
              onSubmit={handleUpdate}
              submitLabel="Update Expense"
              loadingLabel="Updating..."
              successMessage="Expense updated successfully!"
              errorMessage="Failed to update expense."
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <div className="flex items-start gap-4 border-b bg-muted/40 px-6 py-5">
            <div className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle>Delete this expense?</DialogTitle>
              <DialogDescription>
                We will remove it from your list. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-3 px-6 py-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
              <span className="text-muted-foreground">Expense</span>
              <span className="font-semibold">{expense.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">-{formattedAmount} VND</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {expense.note ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-muted-foreground">
                {expense.note}
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
