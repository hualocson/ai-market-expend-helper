import { Category, PaidBy } from "@/enums";
import {
  PARSE_EXPENSE_MIN_AMOUNT,
  type ParseExpenseResponse,
} from "@/lib/ai/parse-expense-contract";
import type { TBudgetOption } from "@/lib/budget-options";
import { describe, expect, it } from "vitest";

import {
  buildOriginalInputReviewDraft,
  evaluateAIQuickEntryParse,
  localExpenseToSavedExpense,
} from "./real-parse";

const budgetOption = (
  overrides: Partial<TBudgetOption> = {}
): TBudgetOption => ({
  id: 2,
  name: "Cà phê",
  icon: "☕",
  color: "lime",
  period: "week",
  periodStartDate: "2026-05-24",
  periodEndDate: "2026-05-30",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
  ...overrides,
});

const successResponse = (
  overrides: Partial<
    Extract<ParseExpenseResponse, { status: "success" }>["expense"]
  > = {}
): ParseExpenseResponse => ({
  status: "success",
  originalInput: "cf 35k",
  expense: {
    date: "30/05/2026",
    amount: 35000,
    note: "Cà phê sữa đá",
    budgetId: 2,
    confidence: "high",
    reason: "Matched coffee budget.",
    ...overrides,
  },
});

describe("evaluateAIQuickEntryParse", () => {
  it("returns an auto-save payload for a trusted high-confidence parse", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse(),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toStrictEqual({
      kind: "autoSave",
      payload: {
        date: "2026-05-30",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        category: Category.FOOD,
        paidBy: PaidBy.CUBI,
        budgetId: 2,
        budgetName: "Cà phê",
        budgetIcon: "☕",
        budgetColor: "lime",
      },
    });
  });

  it("returns review for a low-confidence parse", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ confidence: "medium" }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "low_confidence",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
      },
    });
  });

  it("returns review with today's date for a low-confidence parse with a suspicious date", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({
        confidence: "medium",
        date: "01/01/2025",
      }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "low_confidence",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for a nonpositive amount", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 0",
      parseResult: successResponse({ amount: 0 }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "parse_error",
      initialExpense: {
        date: "30/05/2026",
        amount: 0,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for an amount below the parser minimum", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 999",
      parseResult: successResponse({ amount: PARSE_EXPENSE_MIN_AMOUNT - 1 }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "parse_error",
      initialExpense: {
        date: "30/05/2026",
        amount: PARSE_EXPENSE_MIN_AMOUNT - 1,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for a fractional VND amount", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35000.5",
      parseResult: successResponse({ amount: 35000.5 }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "parse_error",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000.5,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for a blank note", () => {
    const result = evaluateAIQuickEntryParse({
      input: "35k",
      parseResult: successResponse({ note: "   " }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "parse_error",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "",
      },
    });
  });

  it("returns review and clears the budget when the budget id is missing", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ budgetId: null }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "missing_budget",
      initialExpense: {
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    });
  });

  it("returns review with today's date when the parsed date is suspicious", () => {
    const result = evaluateAIQuickEntryParse({
      input: "cf 35k",
      parseResult: successResponse({ date: "01/01/2025" }),
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.CUBI,
      todayIso: "2026-05-30",
    });

    expect(result).toMatchObject({
      kind: "review",
      reason: "suspicious_date",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
      },
    });
  });

  it("returns review for a parser fallback and preserves safe prefill", () => {
    const result = evaluateAIQuickEntryParse({
      input: "??? 35k",
      parseResult: {
        status: "fallback",
        originalInput: "??? 35k",
        reason: "schema_mismatch",
        prefill: {
          note: "??? 35k",
          amount: 35000,
        },
      },
      budgetOptions: [budgetOption()],
      paidBy: PaidBy.EMBE,
      todayIso: "2026-05-30",
    });

    expect(result).toStrictEqual({
      kind: "review",
      reason: "schema_mismatch",
      initialExpense: {
        date: "30/05/2026",
        amount: 35000,
        note: "??? 35k",
        category: Category.FOOD,
        paidBy: PaidBy.EMBE,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      },
    });
  });
});

describe("buildOriginalInputReviewDraft", () => {
  it("extracts a VND shorthand amount from the original input", () => {
    expect(
      buildOriginalInputReviewDraft({
        input: "banh mi 25k",
        paidBy: "Unexpected",
        todayDisplay: "30/05/2026",
      })
    ).toStrictEqual({
      date: "30/05/2026",
      amount: 25000,
      note: "banh mi 25k",
      category: Category.FOOD,
      paidBy: PaidBy.OTHER,
      budgetId: null,
      budgetName: null,
      budgetIcon: null,
      budgetColor: null,
    });
  });
});

describe("localExpenseToSavedExpense", () => {
  it("shapes a local unsynced expense for saved-row editing", () => {
    const saved = localExpenseToSavedExpense({
      entity: "expenses",
      clientId: "client-abc",
      serverId: null,
      date: "2026-05-30",
      amount: 35000,
      note: "Cà phê",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
      budgetId: 2,
      budgetName: "Cà phê",
      budgetIcon: "☕",
      budgetColor: "lime",
      syncStatus: "pending",
      lastError: null,
      updatedAt: "2026-05-30T00:00:00.000Z",
      serverUpdatedAt: null,
    });

    expect(saved).toMatchObject({
      id: expect.any(Number),
      clientId: "client-abc",
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê",
      syncStatus: "pending",
    });
    expect(saved.id).toBeLessThan(0);
  });
});
