import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

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
