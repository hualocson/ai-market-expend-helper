import { formatVnd } from "@/lib/utils";
import type { TQuickExpenseDraft } from "@/stores/quick-expense-recovery-store";

import BudgetBadge from "./BudgetBadge";
import ExpenseItemIcon from "./ExpenseItemIcon";
import VndSymbol from "./VndSymbol";

export const QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS = {
  icon: null,
  classNames: {
    title:
      "!min-w-0 !w-auto !max-w-[min(78vw,340px)] !overflow-visible !whitespace-normal !text-clip",
  },
} as const;

export const QuickExpenseSuccessToast = ({
  draft,
}: {
  draft: TQuickExpenseDraft;
}) => {
  const note = draft.note?.trim() || "No note";
  const hasBudget = draft.budgetId !== null;

  return (
    <div className="flex w-[min(78vw,340px)] max-w-full items-center gap-2">
      {hasBudget ? (
        <BudgetBadge
          icon={draft.budgetIcon}
          color={draft.budgetColor}
          name={draft.budgetName}
          iconOnly
          className="size-6 shrink-0 justify-center gap-0 rounded-full px-0 py-0"
          iconClassName="size-auto text-sm"
        />
      ) : (
        <ExpenseItemIcon
          category={draft.category}
          size="sm"
          className="shrink-0"
        />
      )}
      <span className="text-foreground/90 min-w-0 flex-1 truncate">{note}</span>
      <span className="bg-destructive/15 text-destructive inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold tabular-nums">
        {formatVnd(draft.amount)}
        <VndSymbol className="ml-0.5" />
      </span>
    </div>
  );
};

export default QuickExpenseSuccessToast;
