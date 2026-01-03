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
};

const ExpenseEntry = ({
  formRef,
  showSubmitButton,
  onStateChange,
}: ExpenseEntryProps) => {
  return (
    <div className="p-2 pt-0">
      <ManualExpenseForm
        ref={formRef}
        showSubmitButton={showSubmitButton}
        onStateChange={onStateChange}
      />
    </div>
  );
};

export default ExpenseEntry;
