"use client";

import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";

import QuickExpenseSheet from "./QuickExpenseSheet";

const QuickExpenseRecoverySheetHost = () => {
  const activeRecoveryOperationId = useQuickExpenseRecoveryStore(
    (state) => state.activeRecoveryOperationId
  );
  const entries = useQuickExpenseRecoveryStore((state) => state.entries);
  const setActiveRecovery = useQuickExpenseRecoveryStore(
    (state) => state.setActiveRecovery
  );
  const entry = activeRecoveryOperationId
    ? entries[activeRecoveryOperationId]
    : undefined;

  if (!entry || entry.status !== "failed") {
    return null;
  }

  return (
    <QuickExpenseSheet
      mode={entry.mode}
      open
      onOpenChange={(next) => {
        if (!next) {
          setActiveRecovery(null);
        }
      }}
      showTrigger={false}
      transactionId={entry.transactionId}
      recoveryDraft={entry.draft}
    />
  );
};

export default QuickExpenseRecoverySheetHost;
