import React from "react";

import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AIQuickEntry from "./AIQuickEntry";

let mockPathname = "/";

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
    expect(screen.getByText("35.000")).toBeInTheDocument();
  });

  it("collapses multiple pending entries and expands them on stack tap", () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
      typeAndSend("third");
      typeAndSend("newest");
    });

    expect(screen.getByText("newest")).toBeInTheDocument();
    expect(screen.queryByText("first")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ai-pending-stack-card")).toHaveLength(3);
    expect(screen.queryByText("+3 parsing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Expand 4 pending expenses"));

    expect(screen.getByText("newest")).toBeInTheDocument();
    expect(screen.getByText("third")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
  });

  it("shows resolved rows for 3 seconds then moves them behind the status bar", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    await advanceParse();

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByText("35.000")).toBeInTheDocument();
    expect(screen.getByTestId("ai-quick-entry-drawer-header")).toContainElement(
      screen.getByLabelText(/AI quick entry status/)
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Cà phê 35k")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-quick-entry-list")).not.toHaveClass(
      "max-h-[50svh]"
    );

    fireEvent.click(screen.getByLabelText(/Show completed entries/));

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByTestId("ai-quick-entry-list")).toHaveClass(
      "max-h-[50svh]"
    );
  });

  it("does not duplicate active resolved rows when completed entries are opened", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    await advanceParse();

    fireEvent.click(screen.getByLabelText(/Show completed entries/));

    expect(screen.getAllByText("Cà phê 35k")).toHaveLength(1);
  });

  it("collapses the completed list when a new entry is submitted", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("Cà phê 35k");
    });
    await advanceParse();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.click(screen.getByLabelText(/Show completed entries/));

    expect(screen.getByText("Cà phê 35k")).toBeInTheDocument();
    expect(screen.getByTestId("ai-quick-entry-list")).toHaveClass(
      "max-h-[50svh]"
    );

    act(() => {
      typeAndSend("Bánh mì 25k");
    });

    expect(screen.getByTestId("ai-quick-entry-list")).not.toHaveClass(
      "max-h-[50svh]"
    );
    expect(screen.queryByText("Cà phê 35k")).not.toBeInTheDocument();
    expect(screen.getByText("Bánh mì 25k")).toBeInTheDocument();
  });

  it("keeps pending stack updated when one entry resolves", async () => {
    render(<AIQuickEntry />);
    openOverlay();

    act(() => {
      typeAndSend("first");
      typeAndSend("second");
    });

    await advanceParse();

    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.queryByText("+1 parsing")).not.toBeInTheDocument();
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
