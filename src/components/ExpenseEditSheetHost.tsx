"use client";

import React, { useMemo } from "react";

import dayjs from "@/configs/date";
import { useDeleteExpenseMutation } from "@/lib/mutations";
import { toast } from "sonner";

import QuickExpenseSheet, {
  type TQuickExpenseSheetInitialExpense,
} from "@/components/QuickExpenseSheet";

export type ExpenseEditSheetHostExpense = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId?: number | null;
  budgetName?: string | null;
};

type ExpenseEditSheetHostProps = {
  expense: ExpenseEditSheetHostExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const formatInitialExpenseDate = (date: string) => {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : date;
};

const ExpenseEditSheetHost = ({
  expense,
  open,
  onOpenChange,
}: ExpenseEditSheetHostProps) => {
  const deleteExpenseMutation = useDeleteExpenseMutation();
  const isDeleting = deleteExpenseMutation.isPending;
  const initialExpense =
    useMemo<TQuickExpenseSheetInitialExpense | null>(() => {
      if (!expense) {
        return null;
      }

      return {
        date: formatInitialExpenseDate(expense.date),
        amount: expense.amount,
        note: expense.note,
        category: expense.category,
        paidBy: expense.paidBy,
        budgetId: expense.budgetId ?? null,
        budgetName: expense.budgetName ?? null,
      };
    }, [expense]);

  const handleConfirmDelete = async () => {
    if (!expense || isDeleting) {
      return;
    }

    const loadingToastId = toast.loading("Deleting expense...");

    try {
      await deleteExpenseMutation.mutateAsync(expense.id);
      toast.success("Expense deleted.", { id: loadingToastId });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense.", { id: loadingToastId });
    }
  };

  return (
    <QuickExpenseSheet
      mode="edit"
      open={open && Boolean(expense)}
      onOpenChange={onOpenChange}
      showTrigger={false}
      transactionId={expense?.id}
      initialExpense={initialExpense}
      onConfirmDelete={handleConfirmDelete}
    />
  );
};

export default ExpenseEditSheetHost;
