import dayjs from "@/configs/date";
import type { CreateExpenseInput } from "@/db/type";
import { Category, PaidBy } from "@/enums";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import type { TBudgetOption } from "@/lib/budget-options";
import {
  isDateWithinBudgetPeriod,
  isExpenseDateSuspicious,
} from "@/lib/budget-options";
import type { LocalExpense } from "@/lib/sync/expenses/types";

import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";

const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER] as const;

export type AIQuickEntryReviewReason =
  | "invalid_json"
  | "schema_mismatch"
  | "empty_response"
  | "request_failed"
  | "no_budget_match"
  | "low_confidence"
  | "missing_budget"
  | "invalid_date"
  | "suspicious_date"
  | "budget_out_of_period"
  | "parse_error"
  | "budget_load_error"
  | "create_error";

export type AIQuickEntryParseDecision =
  | {
      kind: "autoSave";
      payload: CreateExpenseInput;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    }
  | {
      kind: "review";
      reason: AIQuickEntryReviewReason;
      initialExpense: TQuickExpenseDrawerInitialExpense;
    };

export type SavedQuickEntryExpense = TQuickExpenseDrawerInitialExpense & {
  id: number;
  clientId?: string;
  syncStatus?: "pending" | "failed" | "synced";
};

export const resolveQuickEntryPaidBy = (value: string | undefined): PaidBy =>
  ALLOWED_PAID_BY.find((option) => option === value) ?? PaidBy.OTHER;

export const parseQuickEntryDisplayDate = (value: string): string | null => {
  const parsed = dayjs(value, "DD/MM/YYYY", true);

  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

const formatDisplayDate = (isoDate: string): string => {
  const parsed = dayjs(isoDate, "YYYY-MM-DD", true);

  return parsed.isValid()
    ? parsed.format("DD/MM/YYYY")
    : dayjs().format("DD/MM/YYYY");
};

const extractAmountFromInput = (input: string): number => {
  const match = input.match(/(\d+(?:\.\d+)?)(k|tr)?/i);

  if (!match) {
    return 0;
  }

  const numeric = Number(match[1]);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const suffix = match[2]?.toLowerCase();

  if (suffix === "k") {
    return numeric * 1000;
  }
  if (suffix === "tr") {
    return numeric * 1000000;
  }

  return numeric;
};

const emptyBudgetFields = {
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
} as const;

export const buildOriginalInputReviewDraft = ({
  input,
  paidBy,
  todayDisplay,
}: {
  input: string;
  paidBy: string | undefined;
  todayDisplay: string;
}): TQuickExpenseDrawerInitialExpense => ({
  date: todayDisplay,
  amount: extractAmountFromInput(input),
  note: input.trim(),
  category: Category.FOOD,
  paidBy: resolveQuickEntryPaidBy(paidBy),
  ...emptyBudgetFields,
});

const buildSuccessDraft = ({
  date,
  amount,
  note,
  paidBy,
  budget,
}: {
  date: string;
  amount: number;
  note: string;
  paidBy: PaidBy;
  budget: TBudgetOption | null;
}): TQuickExpenseDrawerInitialExpense => ({
  date,
  amount,
  note,
  category: budget?.category ?? Category.FOOD,
  paidBy,
  budgetId: budget?.id ?? null,
  budgetName: budget?.name ?? null,
  budgetIcon: budget?.icon ?? null,
  budgetColor: budget?.color ?? null,
});

const buildPayload = ({
  isoDate,
  amount,
  note,
  paidBy,
  budget,
}: {
  isoDate: string;
  amount: number;
  note: string;
  paidBy: PaidBy;
  budget: TBudgetOption;
}): CreateExpenseInput => ({
  date: isoDate,
  amount,
  note,
  category: budget.category,
  paidBy,
  budgetId: budget.id,
  budgetName: budget.name,
  budgetIcon: budget.icon,
  budgetColor: budget.color,
});

export const evaluateAIQuickEntryParse = ({
  input,
  parseResult,
  budgetOptions,
  paidBy,
  todayIso,
}: {
  input: string;
  parseResult: ParseExpenseResponse;
  budgetOptions: TBudgetOption[];
  paidBy: string | undefined;
  todayIso: string;
}): AIQuickEntryParseDecision => {
  const todayDisplay = formatDisplayDate(todayIso);
  const normalizedPaidBy = resolveQuickEntryPaidBy(paidBy);

  if (parseResult.status === "fallback") {
    return {
      kind: "review",
      reason: parseResult.reason,
      initialExpense: {
        ...buildOriginalInputReviewDraft({
          input: parseResult.prefill.note ?? parseResult.originalInput ?? input,
          paidBy,
          todayDisplay,
        }),
        amount:
          typeof parseResult.prefill.amount === "number"
            ? parseResult.prefill.amount
            : extractAmountFromInput(input),
        date: parseResult.prefill.date ?? todayDisplay,
        budgetId: parseResult.prefill.budgetId ?? null,
      },
    };
  }

  const { expense } = parseResult;
  const isoDate = parseQuickEntryDisplayDate(expense.date);
  const note = expense.note.trim();
  const budget =
    expense.budgetId === null
      ? null
      : (budgetOptions.find((option) => option.id === expense.budgetId) ??
        null);
  const safeDraft = buildSuccessDraft({
    date: isoDate ? expense.date : todayDisplay,
    amount: expense.amount,
    note,
    paidBy: normalizedPaidBy,
    budget,
  });
  const hasValidAmount = Number.isFinite(expense.amount) && expense.amount > 0;
  const hasSuspiciousDate = isoDate
    ? isExpenseDateSuspicious(isoDate, todayIso)
    : false;
  const reviewDraft = hasSuspiciousDate
    ? { ...safeDraft, date: todayDisplay }
    : safeDraft;

  if (!isoDate) {
    return {
      kind: "review",
      reason: "invalid_date",
      initialExpense: reviewDraft,
    };
  }

  if (!hasValidAmount || !note) {
    return {
      kind: "review",
      reason: "parse_error",
      initialExpense: reviewDraft,
    };
  }

  if (expense.confidence !== "high") {
    return {
      kind: "review",
      reason: "low_confidence",
      initialExpense: reviewDraft,
    };
  }

  if (hasSuspiciousDate) {
    return {
      kind: "review",
      reason: "suspicious_date",
      initialExpense: reviewDraft,
    };
  }

  if (!budget) {
    return {
      kind: "review",
      reason: "missing_budget",
      initialExpense: { ...safeDraft, ...emptyBudgetFields },
    };
  }

  if (!isDateWithinBudgetPeriod(budget, isoDate)) {
    return {
      kind: "review",
      reason: "budget_out_of_period",
      initialExpense: safeDraft,
    };
  }

  return {
    kind: "autoSave",
    payload: buildPayload({
      isoDate,
      amount: expense.amount,
      note,
      paidBy: normalizedPaidBy,
      budget,
    }),
    initialExpense: safeDraft,
  };
};

const localExpenseClientIdToListId = (clientId: string): number => {
  const hash = [...clientId].reduce(
    (acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

  return -Math.max(1, hash);
};

export const localExpenseToSavedExpense = (
  expense: LocalExpense
): SavedQuickEntryExpense => ({
  id: expense.serverId ?? localExpenseClientIdToListId(expense.clientId),
  clientId: expense.clientId,
  date: formatDisplayDate(expense.date),
  amount: expense.amount,
  note: expense.note,
  category: expense.category,
  paidBy: expense.paidBy,
  budgetId: expense.budgetId,
  budgetName: expense.budgetName,
  budgetIcon: expense.budgetIcon ?? null,
  budgetColor: expense.budgetColor ?? null,
  syncStatus: expense.syncStatus === "deleted" ? undefined : expense.syncStatus,
});
