"use client";

import React, { useMemo, useRef, useState } from "react";

import { Category } from "@/enums";
import { useDeleteExpenseMutation } from "@/lib/mutations";
import { formatVnd } from "@/lib/utils";
import { NotebookIcon, Trash2 } from "lucide-react";
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
import VndSymbol from "@/components/VndSymbol";

import type { ExpenseListItemData } from "./ExpenseListItem";

type ExpenseDeleteConfirmDialogProps = {
  expense: ExpenseListItemData | null;
  onOpenChange: (open: boolean) => void;
};

const ExpenseDeleteConfirmDialog = ({
  expense,
  onOpenChange,
}: ExpenseDeleteConfirmDialogProps) => {
  const deleteExpenseMutation = useDeleteExpenseMutation();
  const deleteInFlightRef = useRef(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const isDeleting = deleteExpenseMutation.isPending || deleteInFlight;
  const formattedAmount = useMemo(
    () => (expense ? formatVnd(expense.amount) : ""),
    [expense]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isDeleting || deleteInFlightRef.current)) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleDelete = async () => {
    if (
      !expense ||
      deleteExpenseMutation.isPending ||
      deleteInFlightRef.current
    ) {
      return;
    }

    deleteInFlightRef.current = true;
    setDeleteInFlight(true);
    const loadingToastId = toast.loading("Deleting expense...");

    try {
      await deleteExpenseMutation.mutateAsync({
        id: expense.id,
        clientId: expense.clientId,
      });
      toast.success("Expense deleted.", { id: loadingToastId });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.", { id: loadingToastId });
    } finally {
      deleteInFlightRef.current = false;
      setDeleteInFlight(false);
    }
  };

  return (
    <Dialog open={Boolean(expense)} onOpenChange={handleOpenChange}>
      {expense ? (
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
                <p className="text-muted-foreground text-sm">{expense.date}</p>
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
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              Delete expense
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
};

export default ExpenseDeleteConfirmDialog;
