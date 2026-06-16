import React from "react";

import { Category, PaidBy } from "@/enums";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BottomNav from "./BottomNav";

const { hapticsMock, pathnameState } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
  pathnameState: {
    value: "/",
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  default: ({
    onTriggerClick,
  }: {
    compact?: boolean;
    onTriggerClick?: () => void;
  }) => (
    <button type="button" onClick={onTriggerClick}>
      Add expense
    </button>
  ),
}));

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  pathnameState.value = "/";
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
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
    return;
  }
  (globalThis as unknown as Record<string, unknown>).React =
    originalGlobalReact;
});

describe("BottomNav", () => {
  it("renders collapsed primary tabs as links and shows the expand button", () => {
    render(<BottomNav />);

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(homeLink).toHaveAttribute("aria-current", "page");

    const budgetLink = screen.getByRole("link", { name: /^budget$/i });
    expect(budgetLink).toHaveAttribute("href", "/budgets");
    expect(budgetLink).not.toHaveAttribute("aria-current");

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");

    expect(
      screen.queryByRole("link", { name: /^report$/i })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /add expense/i })
    ).toBeInTheDocument();
  });

  it("renders the primary tabs as links with hrefs (enables route prefetch)", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "Budget" })).toHaveAttribute(
      "href",
      "/budgets"
    );
  });

  it("does not call useRouter (no router.push navigation)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source = require("node:fs").readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:path").join(process.cwd(), "src/components/BottomNav.tsx"),
      "utf8"
    );
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.push");
  });

  it("navigates via Link hrefs from collapsed nav and updates local active state", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    const budgetLink = screen.getByRole("link", { name: /^budget$/i });
    expect(budgetLink).toHaveAttribute("href", "/budgets");

    // Clicking the Link in jsdom does not navigate, but the onClick handler runs
    // (handleNavigate → setActiveItem). Simulate the route change via the mock.
    pathnameState.value = "/budgets";
    await user.click(budgetLink);

    expect(screen.getByRole("link", { name: /^budget$/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("expands into a vertical menu and shows expanded items as links with correct hrefs", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    const menuLinks = screen
      .getAllByRole("link")
      .filter((link) =>
        ["Home", "Budget", "Report", "Settings"].includes(
          link.getAttribute("aria-label") ?? ""
        )
      );

    expect(menuLinks.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Home",
      "Budget",
      "Report",
      "Settings",
    ]);

    // Each expanded item has the correct href
    expect(screen.getByRole("link", { name: /^report$/i })).toHaveAttribute(
      "href",
      "/report"
    );

    // Clicking an expanded link collapses the menu (onClick calls setExpanded(false))
    await user.click(screen.getByRole("link", { name: /^report$/i }));

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /^report$/i })
    ).not.toBeInTheDocument();
  });

  it("syncs local active state from the current route", async () => {
    const user = userEvent.setup();
    pathnameState.value = "/report/weekly";

    const { rerender } = render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    expect(screen.getByRole("link", { name: /^report$/i })).toHaveAttribute(
      "aria-current",
      "page"
    );

    pathnameState.value = "/reporting";
    rerender(<BottomNav />);

    expect(screen.getByRole("link", { name: /^report$/i })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("closes the expanded menu when clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Outside target</button>
        <BottomNav />
      </>
    );

    await user.click(
      screen.getByRole("button", { name: /expand navigation/i })
    );

    await user.click(screen.getByRole("button", { name: /outside target/i }));

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /^report$/i })
    ).not.toBeInTheDocument();
  });

  it("triggers medium impact haptics when the add expense button is clicked", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });

  it("opens AI quick entry when the AI button is tapped", async () => {
    const user = userEvent.setup();

    render(<BottomNav />);

    await user.click(
      screen.getByRole("button", { name: /open ai quick entry/i })
    );

    expect(useAIQuickEntryStore.getState().open).toBe(true);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });

  it("shows a pending indicator on the AI button when active work continues while closed", () => {
    const store = useAIQuickEntryStore.getState();

    store.enqueueEntry("cf 35k");
    store.setOpen(false);

    render(<BottomNav />);

    expect(
      screen.getByRole("button", {
        name: /open ai quick entry, background work in progress/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-quick-entry-pending-indicator")
    ).toBeInTheDocument();
  });

  it("hides the AI pending indicator while the drawer is open", () => {
    const store = useAIQuickEntryStore.getState();

    store.enqueueEntry("cf 35k");
    store.setOpen(true);

    render(<BottomNav />);

    expect(
      screen.getByRole("button", { name: /open ai quick entry$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-quick-entry-pending-indicator")
    ).not.toBeInTheDocument();
  });

  it("does not show the AI pending indicator for saved or review entries", () => {
    const reviewDraft = {
      date: "30/05/2026",
      amount: 35000,
      note: "Cà phê",
      category: Category.FOOD,
      paidBy: PaidBy.CUBI,
      budgetId: null,
      budgetName: null,
      budgetIcon: null,
      budgetColor: null,
    };
    const store = useAIQuickEntryStore.getState();
    const savedEntry = store.enqueueEntry("saved");
    const reviewEntry = store.enqueueEntry("review");

    store.markEntrySaved(savedEntry.id, {
      ...reviewDraft,
      id: 101,
      clientId: "client-1",
      syncStatus: "pending",
    });
    store.markEntryForReview(reviewEntry.id, reviewDraft, "no_budget_match");
    store.setOpen(false);

    render(<BottomNav />);

    expect(
      screen.getByRole("button", { name: /open ai quick entry$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-quick-entry-pending-indicator")
    ).not.toBeInTheDocument();
  });

  it("renders the AI button before the Add button", () => {
    render(<BottomNav />);

    const aiButton = screen.getByRole("button", {
      name: /open ai quick entry/i,
    });
    const addButton = screen.getByRole("button", { name: /add expense/i });

    expect(
      aiButton.compareDocumentPosition(addButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
