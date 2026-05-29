import type { BudgetListItem } from "@/types/budget-weekly";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBudgetForm } from "./useBudgetForm";

const mutationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateBudgetMutation: () => ({ mutateAsync: mutationMocks.create }),
  useUpdateBudgetMutation: () => ({ mutateAsync: mutationMocks.update }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const groceryBudget = (): BudgetListItem => ({
  id: 7,
  name: "Groceries",
  icon: "🛒",
  color: "emerald",
  amount: 500_000,
  spent: 120_000,
  remaining: 380_000,
  period: "custom",
  periodStartDate: "2026-05-04",
  periodEndDate: "2026-05-10",
});

beforeEach(() => {
  mutationMocks.create.mockReset().mockResolvedValue(undefined);
  mutationMocks.update.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("useBudgetForm", () => {
  it("resets to create defaults when opened with no budget", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    expect(result.current.name).toBe("");
    expect(result.current.amount).toBe(0);
    expect(result.current.period).toBe("week");
    expect(result.current.periodStartDate).toBe("2026-05-11");
    expect(result.current.icon).toBe("💰");
    expect(result.current.color).toBe("lime");
    expect(result.current.isEdit).toBe(false);
    expect(result.current.canSubmit).toBe(false);
  });

  it("prefills from the budget when opened in edit mode", () => {
    const { result } = renderHook(() =>
      useBudgetForm({
        budget: groceryBudget(),
        weekStartDate: "2026-05-11",
        open: true,
      })
    );

    expect(result.current.name).toBe("Groceries");
    expect(result.current.amount).toBe(500_000);
    expect(result.current.period).toBe("custom");
    expect(result.current.periodStartDate).toBe("2026-05-04");
    expect(result.current.periodEndDate).toBe("2026-05-10");
    expect(result.current.icon).toBe("🛒");
    expect(result.current.color).toBe("emerald");
    expect(result.current.isEdit).toBe(true);
    expect(result.current.canSubmit).toBe(true);
  });

  it("requires a name, positive amount, and valid period", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.setName("Food"));
    expect(result.current.isValid).toBe(false);

    act(() => result.current.setAmount(100_000));
    expect(result.current.isValid).toBe(true);
  });

  it("seeds an end date when switching to custom and clears it otherwise", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.handlePeriodChange("custom"));
    expect(result.current.period).toBe("custom");
    expect(result.current.periodEndDate).toBe(result.current.periodStartDate);

    act(() => result.current.handlePeriodChange("week"));
    expect(result.current.periodEndDate).toBeNull();
  });

  it("pushes the end date forward when the start moves past it", () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => result.current.handlePeriodChange("custom"));
    act(() => result.current.handleEndDateChange("2026-05-12"));
    act(() => result.current.handleStartDateChange("2026-05-20"));

    expect(result.current.periodEndDate).toBe("2026-05-20");
  });

  it("submits the create payload and resolves true", async () => {
    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );

    act(() => {
      result.current.setName("Coffee");
      result.current.setAmount(200_000);
    });

    let outcome = false;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBe(true);
    expect(mutationMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Coffee",
        amount: 200_000,
        period: "week",
        periodStartDate: "2026-05-11",
        periodEndDate: null,
        icon: "💰",
        color: "lime",
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Budget created.");
  });

  it("submits the update payload with the budget id in edit mode", async () => {
    const { result } = renderHook(() =>
      useBudgetForm({
        budget: groceryBudget(),
        weekStartDate: "2026-05-11",
        open: true,
      })
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mutationMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        input: expect.objectContaining({
          name: "Groceries",
          period: "custom",
          periodEndDate: "2026-05-10",
        }),
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Budget updated.");
  });

  it("returns false and toasts on mutation failure", async () => {
    mutationMocks.create.mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useBudgetForm({ budget: null, weekStartDate: "2026-05-11", open: true })
    );
    act(() => {
      result.current.setName("Coffee");
      result.current.setAmount(200_000);
    });

    let outcome = true;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Failed to save budget.");
    await waitFor(() => expect(result.current.isSaving).toBe(false));
    errorSpy.mockRestore();
  });
});
