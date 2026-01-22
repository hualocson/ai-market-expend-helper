"use client";

import { type Ref } from "react";

import ManualExpenseForm, {
  type ManualExpenseFormHandle,
  type ManualExpenseFormState,
} from "./ManualExpenseForm";

type ExpenseEntryProps = {
  formRef?: Ref<ManualExpenseFormHandle>;
  showSubmitButton?: boolean;
  onStateChange?: (state: ManualExpenseFormState) => void;
  prefillExpense?: Pick<TExpense, "amount" | "note" | "category"> | null;
};

const ExpenseEntry = ({
  formRef,
  showSubmitButton,
  onStateChange,
  prefillExpense,
}: ExpenseEntryProps) => {
  return (
    <div className="p-2 pt-0">
      <ManualExpenseForm
        ref={formRef}
        showSubmitButton={showSubmitButton}
        onStateChange={onStateChange}
        prefillExpense={prefillExpense}
      />
    </div>
  );
};

export default ExpenseEntry;
