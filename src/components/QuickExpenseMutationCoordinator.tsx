"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";
import { toast } from "sonner";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function QuickExpenseMutationCoordinator() {
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const { mutateAsync: updateExpense } = useUpdateExpenseMutation();
  const entries = useQuickExpenseRecoveryStore((state) => state.entries);
  const queuedEntries = useMemo(
    () => useQuickExpenseRecoveryStore.getState().getQueuedEntries(),
    [entries]
  );
  const markRunning = useQuickExpenseRecoveryStore((state) => state.markRunning);
  const attachToastId = useQuickExpenseRecoveryStore(
    (state) => state.attachToastId
  );
  const markFailed = useQuickExpenseRecoveryStore((state) => state.markFailed);
  const clear = useQuickExpenseRecoveryStore((state) => state.clear);
  const setActiveRecovery = useQuickExpenseRecoveryStore(
    (state) => state.setActiveRecovery
  );
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    queuedEntries.forEach((entry) => {
      const { operationId } = entry;

      if (inFlightRef.current.has(operationId)) {
        return;
      }

      inFlightRef.current.add(operationId);
      markRunning(operationId);

      const isEdit = entry.mode === "edit";
      const loadingToastId = toast.loading(
        isEdit ? "Updating expense..." : "Adding expense..."
      );
      attachToastId(operationId, loadingToastId);

      const runMutation = async () => {
        if (isEdit) {
          if (typeof entry.transactionId !== "number") {
            throw new Error("Failed to update expense");
          }

          await updateExpense({
            id: entry.transactionId,
            input: entry.payload,
          });
          return;
        }

        await createExpense(entry.payload);
      };

      runMutation()
        .then(() => {
          const latest =
            useQuickExpenseRecoveryStore.getState().entries[operationId];
          toast.success(isEdit ? "Expense updated" : "Expense added", {
            id: latest?.toastId,
          });
          clear(operationId);
        })
        .catch((error: unknown) => {
          const latest =
            useQuickExpenseRecoveryStore.getState().entries[operationId];
          markFailed(operationId);
          toast.error(
            getErrorMessage(
              error,
              isEdit ? "Failed to update expense" : "Failed to add expense"
            ),
            {
              id: latest?.toastId,
              action: {
                label: "Reopen",
                onClick: () => setActiveRecovery(operationId),
              },
            }
          );
        })
        .finally(() => {
          inFlightRef.current.delete(operationId);
        });
    });
  }, [
    attachToastId,
    clear,
    createExpense,
    markFailed,
    markRunning,
    queuedEntries,
    setActiveRecovery,
    updateExpense,
  ]);

  return null;
}
