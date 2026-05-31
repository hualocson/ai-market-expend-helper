import React from "react";

import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIQuickEntry from "./AIQuickEntry";
import {
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS,
  QuickExpenseSuccessToast,
} from "./QuickExpenseSuccessToast";

let mockPathname = "/";

const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => ({
    impact: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/hooks/useKeyboardOffset", () => ({
  useKeyboardOffset: () => 0,
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock("@/lib/ai/mock-parse-expense", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/mock-parse-expense")>();

  return {
    ...actual,
    mockParseExpense: vi.fn(actual.mockParseExpense),
  };
});

vi.mock("@/components/providers/StoreProvider", () => ({
  useSettingsStore: () => "Cubi",
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockPathname = "/";
  toastSuccessMock.mockClear();
  vi.mocked(mockParseExpense).mockClear();
  useAIQuickEntryStore.getState().setOpen(false);
});

afterEach(() => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(false);
  });
  vi.useRealTimers();
});

const openOverlay = () => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(true);
  });
};

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("Describe your expense"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("Send expense"));
};

const advanceParse = async () => {
  await act(async () => {
    vi.advanceTimersByTime(2600);
  });
};

describe("AIQuickEntry", () => {
  it("renders nothing when closed", () => {
    render(<AIQuickEntry />);
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("shows and focuses the composer when opened", () => {
    const focusSpy = vi
      .spyOn(HTMLInputElement.prototype, "focus")
      .mockImplementation(() => {});

    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it("dismisses from the fullscreen drawer close button", () => {
    render(<AIQuickEntry />);
    openOverlay();

    fireEvent.click(screen.getByLabelText("Close AI quick entry"));

    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("renders the status bar inside the drawer header", () => {
    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByTestId("ai-quick-entry-drawer-header")).toContainElement(
      screen.getByLabelText(/AI quick entry status/)
    );
    expect(screen.queryByTestId("ai-quick-entry-status-top")).toBeNull();
  });

  it("uses a glass background for the fullscreen drawer", () => {
    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByRole("dialog")).toHaveClass(
      "!bg-transparent",
      "!rounded-none",
      "quick-expense-drawer-morph"
    );
  });

  it("disables send for empty input", () => {
    render(<AIQuickEntry />);
    openOverlay();

    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("renders one pending row and clears the composer after submit", () => {
    render(<AIQuickEntry />);
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
    expect(screen.queryByText(/\+1 parsing/)).not.toBeInTheDocument();
  });

  it("keeps mock entries pending for longer before resolving", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    expect(mockParseExpense).not.toHaveBeenCalled();
    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-amount-skeleton")
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(mockParseExpense).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId("ai-quick-entry-pending-queue")
    ).not.toBeInTheDocument();
  });

  it("renders a capped plain pending queue above the composer", () => {
    render(<AIQuickEntry />);
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
    expect(screen.getByText("+2 more parsing")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Expand 4 pending expenses/)
    ).not.toBeInTheDocument();
  });

  it("opens preview mode from the pending queue", () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
      typeAndSend("third");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Preview 1 more parsing expense" })
    );

    expect(screen.getByText("AI Quick Entry")).toBeInTheDocument();
    expect(screen.getByText("Parsing")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.queryByLabelText(/AI quick entry status/)).toBeNull();
  });

  it("opens preview mode from the status bar", () => {
    render(<AIQuickEntry />);
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
      .spyOn(HTMLInputElement.prototype, "focus")
      .mockImplementation(() => {});

    render(<AIQuickEntry />);
    openOverlay();
    focusSpy.mockClear();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    fireEvent.click(screen.getByLabelText(/Open preview/));
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 16)
      );

    fireEvent.click(
      screen.getByRole("button", { name: "Return to quick entry" })
    );

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    requestAnimationFrameSpy.mockRestore();
    focusSpy.mockRestore();
  });

  it("removes resolved entries from the pending queue and shows a success toast", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();

    await advanceParse();

    expect(
      screen.queryByTestId("ai-quick-entry-pending-queue")
    ).not.toBeInTheDocument();
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
          note: "Cà phê 35k",
          paidBy: "Cubi",
        }),
      },
    });
  });

  it("cancels pending parse timers when dismissed", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
      useAIQuickEntryStore.getState().setOpen(false);
    });

    await act(async () => {
      vi.advanceTimersByTime(2600);
    });

    expect(mockParseExpense).not.toHaveBeenCalled();
  });

  it("clears entries when reopened", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
    });
    await advanceParse();

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    openOverlay();

    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/AI quick entry status/)).toBeInTheDocument();
    expect(screen.getByLabelText(/AI quick entry status/)).toHaveClass(
      "bg-black/85"
    );
  });

  it("renders nothing on the /ai route", () => {
    mockPathname = "/ai";
    render(<AIQuickEntry />);
    openOverlay();

    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });
});
