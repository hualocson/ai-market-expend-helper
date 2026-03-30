import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsStoreProvider } from "@/components/providers/StoreProvider";
import { Category } from "@/enums";
import type { QuickAddMode } from "@/lib/quick-add-mode";

import ManualExpenseForm from "./ManualExpenseForm";

const originalGlobalReact = globalThis.React;

const ensureReactGlobal = () => {
  globalThis.React = React;
};

const restoreReactGlobal = () => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }

  globalThis.React = originalGlobalReact;
};

const createFetchResponse = () =>
  ({
    ok: true,
    json: vi.fn().mockResolvedValue({ budgets: [] }),
  }) as Response;

const renderManualExpenseFormTree = ({
  initialMode,
  showBudgetSelect = false,
  prefillExpense = null,
}: {
  initialMode?: QuickAddMode;
  showBudgetSelect?: boolean;
  prefillExpense?: Pick<TExpense, "amount" | "note" | "category"> | null;
}) => (
  <SettingsStoreProvider>
    <ManualExpenseForm
      {...(typeof initialMode !== "undefined" ? { initialMode } : {})}
      prefillExpense={prefillExpense}
      showBudgetSelect={showBudgetSelect}
    />
  </SettingsStoreProvider>
);

afterEach(() => {
  restoreReactGlobal();
  vi.restoreAllMocks();
});

const renderManualExpenseForm = async ({
  initialMode,
  showBudgetSelect = false,
  prefillExpense = null,
}: {
  initialMode?: QuickAddMode;
  showBudgetSelect?: boolean;
  prefillExpense?: Pick<TExpense, "amount" | "note" | "category"> | null;
} = {}) => {
  ensureReactGlobal();

  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(createFetchResponse());
  let renderResult!: ReturnType<typeof render>;

  await act(async () => {
    renderResult = render(
      renderManualExpenseFormTree({
        initialMode,
        showBudgetSelect,
        prefillExpense,
      })
    );
  });

  if (showBudgetSelect) {
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  }

  return renderResult;
};

describe("ManualExpenseForm quick mode", () => {
  it("hides advanced controls by default and shows More options", async () => {
    await renderManualExpenseForm({
      initialMode: "quick",
      showBudgetSelect: true,
    });

    expect(screen.getByText(/^amount$/i)).toBeVisible();
    expect(screen.getByText(/^category$/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /budget/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /paid by/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /date/i })
    ).not.toBeInTheDocument();
  });

  it("reveals advanced controls after clicking More options", async () => {
    const user = userEvent.setup();

    await renderManualExpenseForm({
      initialMode: "quick",
      showBudgetSelect: true,
    });

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.getByText(/^amount$/i)).toBeVisible();
    expect(screen.getByText(/^category$/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /budget/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /paid by/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /date/i })).toBeInTheDocument();
  });

  it("shows advanced controls by default when initialMode is omitted", async () => {
    await renderManualExpenseForm({ showBudgetSelect: true });

    expect(screen.getByText(/^amount$/i)).toBeVisible();
    expect(screen.getByText(/^category$/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /more options/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /budget/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /paid by/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /date/i })).toBeInTheDocument();
  });

  it("updates visible controls when initialMode changes", async () => {
    const { rerender } = await renderManualExpenseForm({
      initialMode: "quick",
      showBudgetSelect: true,
    });

    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();

    await act(async () => {
      rerender(
        renderManualExpenseFormTree({
          initialMode: "advanced",
          showBudgetSelect: true,
        })
      );
    });

    expect(
      screen.queryByRole("button", { name: /more options/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /budget/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /paid by/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /date/i })).toBeInTheDocument();
  });

  it("resets quick mode when prefillExpense changes on rerender", async () => {
    const user = userEvent.setup();
    const { rerender } = await renderManualExpenseForm({
      initialMode: "quick",
      showBudgetSelect: true,
      prefillExpense: {
        amount: 12000,
        note: "Coffee",
        category: Category.FOOD,
      },
    });

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.getByRole("button", { name: /budget/i })).toBeInTheDocument();

    await act(async () => {
      rerender(
        renderManualExpenseFormTree({
          initialMode: "quick",
          showBudgetSelect: true,
          prefillExpense: {
            amount: 45000,
            note: "Taxi",
            category: Category.TRANSPORT,
          },
        })
      );
    });

    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /budget/i })
    ).not.toBeInTheDocument();
  });

  it("resets quick mode when prefillExpense rerenders with the same values", async () => {
    const user = userEvent.setup();
    const repeatedPrefill = {
      amount: 12000,
      note: "Coffee",
      category: Category.FOOD,
    };
    const { rerender } = await renderManualExpenseForm({
      initialMode: "quick",
      showBudgetSelect: true,
      prefillExpense: repeatedPrefill,
    });

    await user.click(screen.getByRole("button", { name: /more options/i }));

    expect(screen.getByRole("button", { name: /budget/i })).toBeInTheDocument();

    await act(async () => {
      rerender(
        renderManualExpenseFormTree({
          initialMode: "quick",
          showBudgetSelect: true,
          prefillExpense: {
            amount: repeatedPrefill.amount,
            note: repeatedPrefill.note,
            category: repeatedPrefill.category,
          },
        })
      );
    });

    expect(
      screen.getByRole("button", { name: /more options/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /budget/i })
    ).not.toBeInTheDocument();
  });
});
