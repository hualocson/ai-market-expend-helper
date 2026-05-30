import type { QuickAddSource } from "@/lib/quick-add-mode";

export const EXPENSE_PREFILL_EVENT = "expense-prefill";

export type ExpensePrefillPayload = {
  amount: number;
  note: string;
  category: string;
  source?: QuickAddSource;
};

export const dispatchExpensePrefill = (payload: ExpensePrefillPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ExpensePrefillPayload>(EXPENSE_PREFILL_EVENT, {
      detail: payload,
    })
  );
};
