"use client";

import { useCallback, useEffect, useMemo } from "react";

import { syncRepository } from "@/lib/sync/core/repository";
import type { SyncOperation } from "@/lib/sync/core/types";
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import type { ExpenseOutboxOperation } from "@/lib/sync/expenses/types";
import {
  QUICK_EXPENSE_RECOVERY_TTL_MS,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const RECOVERY_TOAST_DURATION_MS = 9000;
const FAILED_OUTBOX_POLL_INTERVAL_MS = 2000;

const isRecoverableFailedExpenseOperation = (
  operation: SyncOperation
): operation is ExpenseOutboxOperation => {
  const candidate = operation as Partial<ExpenseOutboxOperation>;
  return (
    candidate.entity === "expenses" &&
    (candidate.type === "create" ||
      candidate.type === "update" ||
      candidate.type === "delete") &&
    typeof candidate.lastError === "string" &&
    candidate.lastError.trim().length > 0
  );
};

export default function QuickExpenseMutationCoordinator() {
  const queryClient = useQueryClient();
  const entries = useQuickExpenseRecoveryStore((state) => state.entries);
  const unnotifiedEntries = useMemo(
    () => useQuickExpenseRecoveryStore.getState().getUnnotifiedFailedEntries(),
    [entries]
  );
  const clearRecovery = useQuickExpenseRecoveryStore((state) => state.clear);
  const syncFailedOutboxEntries = useQuickExpenseRecoveryStore(
    (state) => state.syncFailedOutboxEntries
  );
  const markNotified = useQuickExpenseRecoveryStore(
    (state) => state.markNotified
  );
  const pruneExpired = useQuickExpenseRecoveryStore(
    (state) => state.pruneExpired
  );
  const setActiveRecovery = useQuickExpenseRecoveryStore(
    (state) => state.setActiveRecovery
  );

  const refreshFailedOutboxEntries = useCallback(async () => {
    const operations = await syncRepository.outbox
      .list("expenses")
      .catch(() => null);
    if (!operations) {
      return;
    }

    const now = Date.now();

    syncFailedOutboxEntries(
      operations.filter(isRecoverableFailedExpenseOperation),
      now
    );
    pruneExpired(now);
  }, [pruneExpired, syncFailedOutboxEntries]);

  useEffect(() => {
    void refreshFailedOutboxEntries();

    const interval = window.setInterval(
      () => void refreshFailedOutboxEntries(),
      FAILED_OUTBOX_POLL_INTERVAL_MS
    );
    const handleFocus = () => void refreshFailedOutboxEntries();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshFailedOutboxEntries]);

  useEffect(() => {
    unnotifiedEntries.forEach((entry) => {
      if (Date.now() - entry.createdAt > QUICK_EXPENSE_RECOVERY_TTL_MS) {
        return;
      }

      const toastId = toast.error(entry.lastError, {
        duration: RECOVERY_TOAST_DURATION_MS,
        action:
          entry.mode === "delete"
            ? {
                label: "Retry delete",
                onClick: () => {
                  clearRecovery(entry.operationId);
                  void requestExpenseSync(queryClient);
                },
              }
            : {
                label: "Reopen",
                onClick: () => setActiveRecovery(entry.operationId),
              },
      });

      markNotified(entry.operationId, toastId);
    });
  }, [
    clearRecovery,
    markNotified,
    queryClient,
    setActiveRecovery,
    unnotifiedEntries,
  ]);

  return null;
}
