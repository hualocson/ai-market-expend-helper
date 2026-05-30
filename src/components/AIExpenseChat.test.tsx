import React from "react";

import { Category } from "@/enums";
import { queries } from "@/lib/queries";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIExpenseChat from "./AIExpenseChat";

const { createExpenseMock, dispatchExpensePrefillMock } = vi.hoisted(() => ({
  createExpenseMock: vi.fn(),
  dispatchExpensePrefillMock: vi.fn(),
}));

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({ mutateAsync: createExpenseMock }),
}));

vi.mock("@/lib/expense-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/expense-prefill")>();
  return { ...actual, dispatchExpensePrefill: dispatchExpensePrefillMock };
});

vi.mock("@/components/providers/StoreProvider", () => ({
  useSettingsStore: (selector: (store: { paidBy: string }) => unknown) =>
    selector({ paidBy: "Cubi" }),
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  }),
}));

// Mount-only stub for the review drawer so the chat test stays focused.
vi.mock("@/components/QuickExpenseDrawer", () => ({
  __esModule: true,
  default: () => <div data-testid="quick-expense-drawer" />,
}));

const TODAY = "2026-05-30";
const WEEK_START = "2026-05-24"; // Sunday-start week for Sat 2026-05-30

const budgetOption = {
  id: 2,
  name: "Cà phê",
  icon: "☕",
  color: "lime" as const,
  period: "week" as const,
  periodStartDate: "2026-05-24",
  periodEndDate: "2026-05-30",
  amount: 100000,
  spent: 0,
  remaining: 100000,
  category: Category.FOOD,
};

const renderChat = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    queries.budgetWeekly.options(WEEK_START, TODAY).queryKey,
    [budgetOption]
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <AIExpenseChat />
    </QueryClientProvider>
  );
};

const mockParseResponse = (data: unknown, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: vi.fn().mockResolvedValue({ success: true, data }),
    })
  );
};

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
  vi.setSystemTime(new Date(`${TODAY}T08:00:00.000Z`));
  createExpenseMock.mockReset().mockResolvedValue(undefined);
  dispatchExpensePrefillMock.mockReset();
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const submit = (text: string) => {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
};

describe("AIExpenseChat", () => {
  it("auto-adds a high-confidence draft with a resolved in-period budget", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf 35k",
      expense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê sữa đá",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      },
    });
    renderChat();

    await act(async () => {
      submit("cf 35k");
    });

    await waitFor(() =>
      expect(createExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-05-30",
          amount: 35000,
          note: "Cà phê sữa đá",
          category: Category.FOOD,
          budgetId: 2,
          budgetName: "Cà phê",
          budgetIcon: "☕",
          budgetColor: "lime",
        })
      )
    );
    expect(dispatchExpensePrefillMock).not.toHaveBeenCalled();
  });

  it("opens the drawer for a medium-confidence draft", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf 35k",
      expense: {
        date: "30/05/2026",
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
        confidence: "medium",
        reason: "Unsure.",
      },
    });
    renderChat();

    await act(async () => {
      submit("cf 35k");
    });

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
    expect(dispatchExpensePrefillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetId: 2,
        budgetName: "Cà phê",
        date: "30/05/2026",
      })
    );
  });

  it("opens the drawer when a high-confidence budget falls outside its period", async () => {
    mockParseResponse({
      status: "success",
      originalInput: "cf last week",
      expense: {
        date: "15/05/2026",
        amount: 35000,
        note: "Cà phê",
        budgetId: 2,
        confidence: "high",
        reason: "Matched coffee.",
      },
    });
    renderChat();

    await act(async () => {
      submit("cf last week");
    });

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
  });

  it("opens the drawer with safe prefill on a fallback", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "??? 35",
      prefill: { note: "??? 35" },
      reason: "schema_mismatch",
    });
    renderChat();

    await act(async () => {
      submit("??? 35");
    });

    await waitFor(() => expect(dispatchExpensePrefillMock).toHaveBeenCalled());
    expect(createExpenseMock).not.toHaveBeenCalled();
  });
});
