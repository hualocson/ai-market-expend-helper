"use client";

import { useQuickExpenseRecoveryStore } from "@/stores/quick-expense-recovery-store";

import QuickExpenseDrawer from "./QuickExpenseDrawer";

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

  if (
    !entry ||
    entry.status !== "failed" ||
    (entry.mode !== "create" && entry.mode !== "edit")
  ) {
    return null;
  }

  return (
    <QuickExpenseDrawer
      mode={entry.mode}
      open
      onOpenChange={(next) => {
        if (!next) {
          setActiveRecovery(null);
        }
      }}
      showTrigger={false}
      transactionId={entry.transactionId}
      recoveryOperationId={entry.operationId}
      recoveryDraft={entry.draft}
    />
  );
};

export default QuickExpenseRecoverySheetHost;
