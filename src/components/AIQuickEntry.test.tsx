import React from "react";

import { Category, PaidBy } from "@/enums";
import { queries } from "@/lib/queries";
import type { LocalExpense } from "@/lib/sync/expenses/types";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIQuickEntry from "./AIQuickEntry";
import {
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS,
  QuickExpenseSuccessToast,
} from "./QuickExpenseSuccessToast";

const { createExpenseMock, quickExpenseDrawerPropsMock, toastSuccessMock } =
  vi.hoisted(() => ({
    createExpenseMock: vi.fn(),
    quickExpenseDrawerPropsMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => ({
    impact: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    trigger: vi.fn(),
  }),
}));

vi.mock("@/hooks/useKeyboardOffset", () => ({
  useKeyboardOffset: () => 0,
}));

vi.mock("@/lib/mutations", () => ({
  useCreateExpenseMutation: () => ({ mutateAsync: createExpenseMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock("@/components/providers/StoreProvider", () => ({
  useSettingsStore: (selector: (store: { paidBy: PaidBy }) => unknown) =>
    selector({ paidBy: PaidBy.CUBI }),
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    quickExpenseDrawerPropsMock(props);

    return (
      <div
        data-testid="quick-expense-drawer"
        data-open={String(props.open)}
        data-mode={String(props.mode)}
      />
    );
  },
}));

const TODAY = "2026-05-30";
const WEEK_START = "2026-05-24";

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

const savedLocalExpense = (
  overrides: Partial<LocalExpense> = {}
): LocalExpense => {
  const baseExpense: LocalExpense = {
    clientId: "client-1",
    serverId: 101,
    entity: "expenses",
    syncStatus: "pending",
    lastError: null,
    updatedAt: "2026-05-30T08:00:00.000Z",
    serverUpdatedAt: null,
    date: TODAY,
    amount: 35000,
    note: "Cà phê sữa đá",
    category: Category.FOOD,
    paidBy: PaidBy.CUBI,
    budgetId: 2,
    budgetName: "Cà phê",
    budgetIcon: "☕",
    budgetColor: "lime",
  };

  return { ...baseExpense, ...overrides };
};

type MockQuickExpenseDrawerProps = Record<string, unknown> & {
  onSuccess?: (expense: LocalExpense) => void;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const getLastQuickExpenseDrawerProps = () =>
  quickExpenseDrawerPropsMock.mock.calls.at(-1)?.[0] as
    | MockQuickExpenseDrawerProps
    | undefined;

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const renderQuickEntry = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  queryClient.setQueryData(
    queries.budgetWeekly.options(WEEK_START, TODAY).queryKey,
    [budgetOption]
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <AIQuickEntry />
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

const mockUnresolvedParseResponse = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Keep the request unresolved so active rows remain visible.
        })
    )
  );
};

const mockDeferredParseResponse = () => {
  const deferred = createDeferred<{
    status: number;
    json: () => Promise<unknown>;
  }>();

  vi.stubGlobal("fetch", vi.fn().mockReturnValue(deferred.promise));

  return deferred;
};

const trustedParseResponse = {
  status: "success",
  originalInput: "cf 35k",
  expense: {
    date: "30/05/2026",
    amount: 35000,
    note: "Cà phê sữa đá",
    budgetId: 2,
    confidence: "high",
    reason: "Matched coffee budget.",
  },
};

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
  vi.setSystemTime(new Date(`${TODAY}T08:00:00.000Z`));
  createExpenseMock.mockReset().mockResolvedValue(savedLocalExpense());
  quickExpenseDrawerPropsMock.mockReset();
  toastSuccessMock.mockClear();
  useAIQuickEntryStore.getState().setOpen(false);
  useAIQuickEntryStore.getState().clearEntries();
});

afterEach(() => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(false);
    useAIQuickEntryStore.getState().clearEntries();
  });
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const openOverlay = () => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(true);
  });
};

const getComposer = () => screen.getByLabelText("Describe your expense");

const typeComposerText = (text: string) => {
  fireEvent.change(getComposer(), {
    target: { value: text },
  });
};

const typeAndSend = (text: string) => {
  typeComposerText(text);
  fireEvent.click(screen.getByLabelText("Send expense"));
};

describe("AIQuickEntry", () => {
  it("renders nothing when closed", () => {
    renderQuickEntry();
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("shows and focuses the composer when opened", () => {
    const focusSpy = vi
      .spyOn(HTMLTextAreaElement.prototype, "focus")
      .mockImplementation(() => {});

    renderQuickEntry();
    openOverlay();

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it("dismisses from the fullscreen drawer close button", () => {
    renderQuickEntry();
    openOverlay();

    fireEvent.click(screen.getByLabelText("Close AI quick entry"));

    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("renders the status bar inside the drawer header", () => {
    renderQuickEntry();
    openOverlay();

    expect(screen.getByTestId("ai-quick-entry-drawer-header")).toContainElement(
      screen.getByLabelText(/AI quick entry status/)
    );
    expect(screen.queryByTestId("ai-quick-entry-status-top")).toBeNull();
  });

  it("uses a glass background for the fullscreen drawer", () => {
    renderQuickEntry();
    openOverlay();

    expect(screen.getByRole("dialog")).toHaveClass(
      "!bg-transparent",
      "!rounded-none",
      "quick-expense-drawer-morph"
    );
  });

  it("disables send for empty input", () => {
    renderQuickEntry();
    openOverlay();

    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("disables send for blank multiline input", () => {
    renderQuickEntry();
    openOverlay();

    typeComposerText("  \n\n  ");

    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("keeps newline text in the composer when Enter is used", async () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    const composer = screen.getByLabelText("Describe your expense");

    await userEvent.type(composer, "Cà phê 35k{enter}Cơm trưa 60k");

    expect(composer).toHaveValue("Cà phê 35k\nCơm trưa 60k");
    expect(
      screen.queryByTestId("ai-quick-entry-pending-queue")
    ).not.toBeInTheDocument();
  });

  it("hides the composer expand button for single-line input", () => {
    renderQuickEntry();
    openOverlay();

    typeComposerText("Cà phê 35k");

    expect(screen.queryByLabelText("Expand composer")).not.toBeInTheDocument();
  });

  it("shows the composer expand button for multiline input", () => {
    renderQuickEntry();
    openOverlay();

    typeComposerText("Cà phê 35k\nCơm trưa 60k");

    expect(screen.getByLabelText("Expand composer")).toBeInTheDocument();
  });

  it("expands and collapses the multiline composer", () => {
    renderQuickEntry();
    openOverlay();

    typeComposerText("Cà phê 35k\nCơm trưa 60k");

    fireEvent.click(screen.getByLabelText("Expand composer"));

    expect(getComposer()).toHaveAttribute("data-expanded", "true");
    expect(getComposer().style.height).toContain("100svh");
    expect(getComposer().style.height).toContain("0px");
    expect(getComposer().style.height).toContain("env(safe-area-inset-top)");
    expect(getComposer().style.height).toContain("56px");
    expect(getComposer().style.height).toContain("24px");
    expect(screen.getByLabelText("Collapse composer")).toBeInTheDocument();
    expect(screen.getByLabelText("Send expense")).toHaveAttribute(
      "data-inside-composer",
      "true"
    );

    fireEvent.click(screen.getByLabelText("Collapse composer"));

    expect(getComposer()).toHaveAttribute("data-expanded", "false");
    expect(screen.getByLabelText("Expand composer")).toBeInTheDocument();
    expect(screen.getByLabelText("Send expense")).toHaveAttribute(
      "data-inside-composer",
      "false"
    );
  });

  it("auto-collapses when expanded composer becomes single-line", () => {
    renderQuickEntry();
    openOverlay();

    typeComposerText("Cà phê 35k\nCơm trưa 60k");
    fireEvent.click(screen.getByLabelText("Expand composer"));

    typeComposerText("Cà phê 35k");

    expect(getComposer()).toHaveAttribute("data-expanded", "false");
    expect(
      screen.queryByLabelText("Collapse composer")
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expand composer")).not.toBeInTheDocument();
  });

  it("sends multiline entries and collapses from expanded composer", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    typeComposerText("Cà phê 35k\nCơm trưa 60k");
    fireEvent.click(screen.getByLabelText("Expand composer"));
    fireEvent.click(screen.getByLabelText("Send expense"));

    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(getComposer()).toHaveValue("");
    expect(getComposer()).toHaveAttribute("data-expanded", "false");
  });

  it("renders one active row and clears the composer after submit", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Describe your expense")).toHaveValue("");
    expect(screen.queryByText(/\+1 more active/)).not.toBeInTheDocument();
  });

  it("submits each non-empty composer line as an active entry", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k\n\n  Cơm trưa 60k  \nGrab 42k");
    });

    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Grab 42k")).toBeInTheDocument();
    expect(screen.getByText("+1 more active")).toBeInTheDocument();
    expect(screen.getByLabelText("Describe your expense")).toHaveValue("");

    fireEvent.click(
      screen.getByRole("button", { name: "Preview 1 more active expense" })
    );

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("Cơm trưa 60k")).toBeInTheDocument();
    expect(screen.getByText("Grab 42k")).toBeInTheDocument();
  });

  it("renders a capped plain active queue above the composer", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
      typeAndSend("third");
      typeAndSend("newest");
    });

    expect(
      screen.getByTestId("ai-quick-entry-pending-queue")
    ).toBeInTheDocument();
    expect(screen.getByText("newest")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    expect(screen.queryByText("second")).not.toBeInTheDocument();
    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more active")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Expand 4 active expenses/)
    ).not.toBeInTheDocument();
  });

  it("opens preview mode from the active queue", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
      typeAndSend("third");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Preview 1 more active expense" })
    );

    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByLabelText(/AI quick entry status/)).toBeNull();
  });

  it("opens preview mode from the status bar", () => {
    mockUnresolvedParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Return to quick entry" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Close AI quick entry")).toBeNull();
    expect(screen.queryByLabelText(/AI quick entry status/)).toBeNull();
  });

  it("returns from preview mode to entry mode and refocuses the composer", () => {
    const focusSpy = vi
      .spyOn(HTMLTextAreaElement.prototype, "focus")
      .mockImplementation(() => {});
    mockUnresolvedParseResponse();

    renderQuickEntry();
    openOverlay();
    focusSpy.mockClear();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    fireEvent.click(screen.getByLabelText(/Open preview/));
    fireEvent.click(
      screen.getByRole("button", { name: "Return to quick entry" })
    );

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it("auto-saves a trusted parse, clears the composer, and shows the saved entry in preview", async () => {
    mockParseResponse(trustedParseResponse);
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    expect(screen.getByLabelText("Describe your expense")).toHaveValue("");
    expect(screen.getByText("cf 35k")).toBeInTheDocument();

    await waitFor(() =>
      expect(createExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: TODAY,
          amount: 35000,
          note: "Cà phê sữa đá",
          category: Category.FOOD,
          paidBy: PaidBy.CUBI,
          budgetId: 2,
          budgetName: "Cà phê",
        })
      )
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("ai-quick-entry-pending-queue")
      ).not.toBeInTheDocument()
    );

    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock.mock.calls[0]?.[1]).toStrictEqual(
      QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
    );
    const toastContent = toastSuccessMock.mock.calls[0]?.[0];
    expect(React.isValidElement(toastContent)).toBe(true);
    expect(toastContent).toMatchObject({
      type: QuickExpenseSuccessToast,
      props: {
        draft: expect.objectContaining({
          amount: 35000,
          note: "Cà phê sữa đá",
          paidBy: PaidBy.CUBI,
        }),
      },
    });

    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Edit saved expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();
  });

  it("clears saved preview entries without clearing review entries", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "maybe coffee",
      prefill: {
        note: "maybe coffee",
        amount: 35000,
        date: "30/05/2026",
        budgetId: null,
      },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });
    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "1"
      )
    );

    act(() => {
      const savedEntry = useAIQuickEntryStore
        .getState()
        .enqueueEntry("saved coffee");
      useAIQuickEntryStore.getState().markEntrySaved(
        savedEntry.id,
        savedLocalExpense({
          note: "saved coffee",
        })
      );
    });

    fireEvent.click(screen.getByLabelText(/Open preview/));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("saved coffee")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("maybe coffee")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear saved AI quick entries" })
    );

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("saved coffee")).not.toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("maybe coffee")).toBeInTheDocument();
  });

  it("keeps an active parse visible after the drawer closes and reopens", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    expect(screen.getByText("cf 35k")).toBeInTheDocument();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByText("cf 35k")).toBeInTheDocument();
    expect(createExpenseMock).not.toHaveBeenCalled();

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));
  });

  it("auto-saves a trusted parse while closed and shows it after reopen", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Edit saved expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();
  });

  it("moves a fallback parse to needs review while closed and shows it after reopen", async () => {
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            status: "fallback",
            originalInput: "maybe coffee",
            prefill: {
              note: "maybe coffee",
              amount: 35000,
              date: "30/05/2026",
              budgetId: null,
            },
            reason: "no_budget_match",
          },
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createExpenseMock).not.toHaveBeenCalled();

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("maybe coffee")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    );

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-mode",
      "create"
    );
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "create",
        transactionId: undefined,
        initialExpenseKey: expect.stringMatching(/^review:/),
        initialExpense: expect.objectContaining({
          note: "maybe coffee",
          amount: 35000,
        }),
      })
    );
  });

  it("moves a fallback parse to needs review without creating an expense", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "maybe coffee",
      prefill: {
        note: "maybe coffee",
        amount: 35000,
        date: "30/05/2026",
        budgetId: null,
      },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });

    await waitFor(() =>
      expect(screen.queryByText("Saving")).not.toBeInTheDocument()
    );

    expect(createExpenseMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("maybe coffee")).toBeInTheDocument();
    const reviewButton = screen.getByRole("button", {
      name: /Review expense maybe coffee.*35\.000/,
    });
    expect(reviewButton).toBeInTheDocument();

    fireEvent.click(reviewButton);

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-mode",
      "create"
    );
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "create",
        transactionId: undefined,
        initialExpenseKey: expect.stringMatching(/^review:/),
        initialExpense: expect.objectContaining({
          note: "maybe coffee",
          amount: 35000,
        }),
      })
    );

    act(() => {
      getLastQuickExpenseDrawerProps()?.onSuccess?.(
        savedLocalExpense({
          serverId: 102,
          note: "Reviewed coffee",
        })
      );
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Reviewed coffee")).toBeInTheDocument();
  });

  it("moves a create failure to needs review with the parsed draft", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    createExpenseMock.mockRejectedValue(new Error("create failed"));
    mockParseResponse(trustedParseResponse);
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("moves a create failure to needs review while closed", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    createExpenseMock.mockRejectedValue(new Error("create failed"));
    const parseResponse = mockDeferredParseResponse();
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      parseResponse.resolve({
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ success: true, data: trustedParseResponse }),
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));

    openOverlay();
    fireEvent.click(screen.getByLabelText(/Open preview/));

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Cà phê sữa đá")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Review expense Cà phê sữa đá.*35\.000/,
      })
    ).toBeInTheDocument();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("opens one drawer from a saved row in edit mode with saved local expense data", async () => {
    mockParseResponse(trustedParseResponse);
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("cf 35k");
    });

    await waitFor(() => expect(createExpenseMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText(/Open preview/));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Edit saved expense Cà phê sữa đá.*35\.000/,
      })
    );

    expect(screen.getAllByTestId("quick-expense-drawer")).toHaveLength(1);
    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-mode",
      "edit"
    );
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "edit",
        transactionId: 101,
        initialExpenseKey: expect.stringMatching(/^saved:/),
        initialExpense: expect.objectContaining({
          id: 101,
          clientId: "client-1",
          note: "Cà phê sữa đá",
          amount: 35000,
        }),
      })
    );
  });

  it("reuses one drawer for review rows and updates the selected initial expense", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { input?: string })
            : {};
        const input = body.input ?? "";
        const amount = input === "tea 20k" ? 20000 : 35000;
        const note = input === "tea 20k" ? "tea 20k" : "coffee 35k";

        return {
          status: 200,
          json: vi.fn().mockResolvedValue({
            success: true,
            data: {
              status: "fallback",
              originalInput: input,
              prefill: {
                note,
                amount,
                date: "30/05/2026",
                budgetId: null,
              },
              reason: "no_budget_match",
            },
          }),
        };
      })
    );
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("coffee 35k");
      typeAndSend("tea 20k");
    });

    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "2"
      )
    );

    fireEvent.click(screen.getByLabelText(/Open preview/));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Review expense coffee 35k.*35\.000/,
      })
    );

    expect(screen.getAllByTestId("quick-expense-drawer")).toHaveLength(1);
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "create",
        initialExpenseKey: expect.stringMatching(/^review:/),
        initialExpense: expect.objectContaining({
          note: "coffee 35k",
          amount: 35000,
        }),
      })
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Review expense tea 20k.*20\.000/ })
    );

    expect(screen.getAllByTestId("quick-expense-drawer")).toHaveLength(1);
    expect(quickExpenseDrawerPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        mode: "create",
        initialExpenseKey: expect.stringMatching(/^review:/),
        initialExpense: expect.objectContaining({
          note: "tea 20k",
          amount: 20000,
        }),
      })
    );
  });

  it("keeps entries when reopened but returns to entry mode", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "first",
      prefill: { note: "first", amount: 0, budgetId: null },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("first");
    });
    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "1"
      )
    );

    fireEvent.click(screen.getByLabelText(/Open preview/));
    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(screen.queryByText("AI Quick Entry")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByLabelText(/Open preview/));
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
  });

  it("clears nested drawer selection on close without clearing review entries", async () => {
    mockParseResponse({
      status: "fallback",
      originalInput: "maybe coffee",
      prefill: {
        note: "maybe coffee",
        amount: 35000,
        date: "30/05/2026",
        budgetId: null,
      },
      reason: "no_budget_match",
    });
    renderQuickEntry();
    openOverlay();

    act(() => {
      typeAndSend("maybe coffee");
    });

    await waitFor(() =>
      expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent(
        "1"
      )
    );
    fireEvent.click(screen.getByLabelText(/Open preview/));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Review expense maybe coffee.*35\.000/,
      })
    );

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-open",
      "true"
    );

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.getByTestId("quick-expense-drawer")).toHaveAttribute(
      "data-open",
      "false"
    );
    expect(screen.getByTestId("ai-status-failed-count")).toHaveTextContent("1");
  });
});
