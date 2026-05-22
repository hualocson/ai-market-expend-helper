import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createExpenseEntry } from "@/app/actions/expense-actions";
import { SettingsStoreProvider } from "@/components/providers/StoreProvider";
import QuickExpenseSheet from "./QuickExpenseSheet";

vi.mock("@/app/actions/expense-actions", () => ({
  createExpenseEntry: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/queries/budget-weekly", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queries/budget-weekly")>(
    "@/lib/queries/budget-weekly"
  );
  return {
    ...actual,
    fetchWeeklyBudgetOptions: vi.fn().mockResolvedValue([]),
  };
});

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>).React;

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    (globalThis as unknown as Record<string, unknown>).React = originalGlobalReact;
  }
  vi.restoreAllMocks();
});

const renderSheet = () => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsStoreProvider>
        <QuickExpenseSheet />
      </SettingsStoreProvider>
    </QueryClientProvider>
  );
};

describe("QuickExpenseSheet — open/close", () => {
  it("opens when the trigger is clicked and focuses the note input", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.queryByPlaceholderText(/what did you spend on/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    const note = await screen.findByPlaceholderText(/what did you spend on/i);
    await waitFor(() => expect(note).toHaveFocus());
  });
});

describe("QuickExpenseSheet — fields", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("renders the date / budget / paid-by trigger buttons", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /^date:/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^budget:/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^paid by:/i })).toBeInTheDocument();
  });

  it("shows suggestion chips when amount > 0", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("5");
    expect(screen.getByRole("button", { name: /50$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /500$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5[.,]?000$/ })).toBeInTheDocument();
  });

  it("applies a suggestion chip to the amount input", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0") as HTMLInputElement;
    await user.click(amount);
    await user.keyboard("5");
    await user.click(screen.getByRole("button", { name: /5[.,]?000$/ }));
    expect(amount.value).toMatch(/5[.,]?000/);
  });

  it("renders the category chip row and toggles active chip", async () => {
    const user = await openSheet();
    const foodChip = screen.getByRole("button", { name: /food/i, pressed: true });
    expect(foodChip).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /transport/i }));
    expect(screen.getByRole("button", { name: /transport/i, pressed: true })).toBeInTheDocument();
  });
});

describe("QuickExpenseSheet — submit", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("disables submit when amount is zero", async () => {
    await openSheet();
    expect(screen.getByRole("button", { name: /save expense/i })).toBeDisabled();
  });

  it("calls createExpenseEntry with the full draft on submit", async () => {
    const user = await openSheet();
    const amount = screen.getByPlaceholderText("0");
    await user.click(amount);
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() => {
      expect(createExpenseEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          note: "",
          category: "Food",
          paidBy: expect.any(String),
        })
      );
    });
  });

  it("closes the sheet after successful submit", async () => {
    const user = await openSheet();
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("5000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/what did you spend on/i)).not.toBeInTheDocument()
    );
  });
});
