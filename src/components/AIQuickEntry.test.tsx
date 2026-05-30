import React from "react";

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

vi.mock("@/components/providers/StoreProvider", () => ({
  useSettingsStore: () => "Cubi",
}));

vi.mock("@/components/ExpenseListItem", () => ({
  default: ({ expense }: { expense: { note: string } }) => (
    <div data-testid="expense-row">{expense.note}</div>
  ),
}));

vi.mock("@/components/AIEntrySkeleton", () => ({
  default: ({ input }: { input: string }) => (
    <div data-ai-entry-skeleton>{input}</div>
  ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockPathname = "/";
  useAIQuickEntryStore.getState().setOpen(false);
});

afterEach(() => {
  act(() => {
    useAIQuickEntryStore.getState().setOpen(false);
  });
  vi.useRealTimers();
});

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("Describe your expense"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("Send expense"));
};

describe("AIQuickEntry", () => {
  it("renders nothing when closed", () => {
    render(<AIQuickEntry />);
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });

  it("shows the composer when opened", () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
  });

  it("focuses the composer without scrolling when opened", () => {
    const focusSpy = vi
      .spyOn(HTMLInputElement.prototype, "focus")
      .mockImplementation(() => {});

    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });

    expect(screen.getByLabelText("Describe your expense")).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it("disables send for empty input", () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(screen.getByLabelText("Send expense")).toBeDisabled();
  });

  it("appends a pending entry then resolves to an expense row", async () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });

    act(() => {
      typeAndSend("Cà phê 35k");
    });

    expect(
      document.querySelector("[data-ai-entry-skeleton]")
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-ai-entry-skeleton]")
    ).toHaveTextContent("Cà phê 35k");
    expect(screen.getAllByText("Cà phê 35k")).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.getByTestId("expense-row")).toHaveTextContent("Cà phê 35k");
    });
  });

  it("clears entries when reopened", async () => {
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    act(() => {
      typeAndSend("first");
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    act(() => {
      useAIQuickEntryStore.getState().setOpen(false);
    });
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });

    expect(screen.queryByTestId("expense-row")).not.toBeInTheDocument();
  });

  it("renders nothing on the /ai route", () => {
    mockPathname = "/ai";
    render(<AIQuickEntry />);
    act(() => {
      useAIQuickEntryStore.getState().setOpen(true);
    });
    expect(
      screen.queryByLabelText("Describe your expense")
    ).not.toBeInTheDocument();
  });
});
