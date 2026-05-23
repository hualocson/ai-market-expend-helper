import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetTransferDrawer from "./BudgetTransferDrawer";
import type { BudgetListItem } from "@/types/budget-weekly";

const transferMock = vi.fn();
const getCandidatesMock = vi.fn();

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  transferBudgetAmount: (...args: unknown[]) => transferMock(...args),
  getTransferCandidates: (...args: unknown[]) => getCandidatesMock(...args),
}));

const invalidateQueriesMock = vi.fn();
const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => invalidateQueriesMock(...args),
  }),
  useQuery: (opts: { queryFn: () => Promise<unknown>; enabled?: boolean }) =>
    useQueryMock(opts),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const makeBudget = (overrides: Partial<BudgetListItem>): BudgetListItem => ({
  id: 1,
  name: "Groceries",
  amount: 500_000,
  spent: 100_000,
  remaining: 400_000,
  period: "week",
  periodStartDate: "2026-05-10",
  periodEndDate: "2026-05-16",
  ...overrides,
});

const useQueryReturn = (overrides: {
  data?: BudgetListItem[];
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
}) => ({
  data: overrides.data,
  isLoading: overrides.isLoading ?? false,
  isError: overrides.isError ?? false,
  refetch: overrides.refetch ?? vi.fn(),
});

beforeEach(() => {
  transferMock.mockReset();
  getCandidatesMock.mockReset();
  invalidateQueriesMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  useQueryMock.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 4, 16, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BudgetTransferDrawer", () => {
  it("renders skeleton while candidates are loading", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ isLoading: true }));
    const destination = makeBudget({ id: 1, name: "Groceries" });

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(
      screen.getByTestId("budget-transfer-candidates-skeleton")
    ).toBeInTheDocument();
  });

  it("disables submit until a source is picked and amount is valid", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries", amount: 100_000 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000, remaining: 150_000 });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    expect(screen.getByRole("button", { name: /move funds/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).toBeDisabled();

    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(screen.getByRole("button", { name: /move funds/i, hidden: true })).not.toBeDisabled();
  });

  it("renders candidates inside period-instance groups in fixed order", () => {
    const thisWeek = makeBudget({
      id: 10,
      name: "Coffee this week",
      periodStartDate: "2026-05-10",
      periodEndDate: "2026-05-16",
    });
    const lastWeek = makeBudget({
      id: 20,
      name: "Coffee last week",
      periodStartDate: "2026-05-03",
      periodEndDate: "2026-05-09",
    });
    const thisMonth = makeBudget({
      id: 30,
      name: "Utilities",
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [thisMonth, lastWeek, thisWeek] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));

    const headings = screen
      .getAllByTestId("budget-transfer-group-label")
      .map((el) => el.textContent ?? "");
    expect(headings.length).toBe(3);
    expect(headings[0]).toMatch(/this week/i);
    expect(headings[1]).toMatch(/last week/i);
    expect(headings[2]).toMatch(/this month/i);
  });

  it("renders a disabled row for remaining <= 0 candidates", () => {
    const overspent = makeBudget({
      id: 99,
      name: "Travel",
      amount: 100_000,
      spent: 100_000,
      remaining: 0,
    });
    const healthy = makeBudget({
      id: 100,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [overspent, healthy] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByRole("button", { name: /Travel/i })).toBeDisabled();
    expect(screen.getByText(/no cap to pull/i)).toBeInTheDocument();
  });

  it("shows the 'no cap to spare' card when every candidate has remaining <= 0", () => {
    const drained = makeBudget({ id: 99, name: "Travel", amount: 100_000, spent: 100_000, remaining: 0 });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [drained] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByText(/no budget has cap to spare/i)).toBeInTheDocument();
  });

  it("shows empty card when candidates payload is empty", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ data: [] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    expect(screen.getByText(/no other budgets to pull from/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move funds/i })).toBeNull();
  });

  it("shows an error state with a retry button when the candidate fetch errors", async () => {
    const refetch = vi.fn();
    useQueryMock.mockReturnValue(useQueryReturn({ isError: true, refetch }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    expect(
      screen.getByRole("button", { name: /select source budget/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows warning banner and flips submit label when source goes below spent", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Travel",
      amount: 100_000,
      spent: 80_000,
      remaining: 20_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Travel/i }));
    await user.type(screen.getByLabelText(/amount/i), "50000");

    expect(screen.getByText(/will go .* over budget/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /move funds anyway/i, hidden: true })
    ).toBeInTheDocument();
  });

  it("disables submit when amount exceeds source.amount", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Snacks",
      amount: 20_000,
      spent: 0,
      remaining: 20_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={() => {}} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Snacks/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(
      screen.getByRole("button", { name: /move funds/i, hidden: true })
    ).toBeDisabled();
    expect(screen.getByText(/cannot move more than/i)).toBeInTheDocument();
  });

  it("on success: invalidates overview + transactions + transfer-candidates, toasts, closes drawer", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(transferMock).toHaveBeenCalledWith({
      fromBudgetId: 2,
      toBudgetId: 1,
      amount: 30_000,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Funds moved.");
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(4);
    const invalidatedKeys = invalidateQueriesMock.mock.calls.map(
      (call) => (call[0] as { queryKey: unknown }).queryKey
    );
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ["budgets", "overview"],
        ["budgets", "transactions", 1],
        ["budgets", "transactions", 2],
        ["budgets", "transferCandidates"],
      ])
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("on INSUFFICIENT_CAP: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "INSUFFICIENT_CAP" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith(
      "That budget no longer has enough to move. Try a smaller amount."
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("on NOT_FOUND: shows specific toast and keeps drawer open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    transferMock.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const onOpenChange = vi.fn();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({
      id: 2,
      name: "Dining",
      amount: 200_000,
      spent: 0,
      remaining: 200_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [source] }));

    render(
      <BudgetTransferDrawer open onOpenChange={onOpenChange} destination={destination} />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    fireEvent.click(screen.getByRole("button", { name: /Dining/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");
    await user.click(screen.getByRole("button", { name: /^move funds$/i, hidden: true }));

    expect(toastError).toHaveBeenCalledWith("Source budget no longer exists.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("renders sticky destination header inside the nested drawer", () => {
    useQueryMock.mockReturnValue(useQueryReturn({ data: [makeBudget({ id: 2, name: "Coffee" })] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries", amount: 540_000 })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    const header = screen.getByTestId("budget-transfer-nested-destination");
    expect(within(header).getByText("Groceries")).toBeInTheDocument();
    expect(within(header).getByText(/filling/i)).toBeInTheDocument();
  });

  it("hides the secondary amount line when a candidate has zero spent", () => {
    const pristine = makeBudget({
      id: 7,
      name: "Coffee",
      amount: 500_000,
      spent: 0,
      remaining: 500_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [pristine] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    const row = screen.getByRole("button", { name: /Coffee/i });
    // Single cap reading only: amount appears once, the redundant "of …" line is absent.
    expect(within(row).getAllByText(/500\.000/)).toHaveLength(1);
    expect(within(row).queryByText(/^of /)).toBeNull();
  });

  it("shows both remaining and amount when a candidate has been partially spent", () => {
    const spent = makeBudget({
      id: 8,
      name: "Travel",
      amount: 400_000,
      spent: 100_000,
      remaining: 300_000,
    });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [spent] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    const row = screen.getByRole("button", { name: /Travel/i });
    expect(within(row).getByText("300.000")).toBeInTheDocument();
    expect(within(row).getByText(/of 400\.000/)).toBeInTheDocument();
  });

  it("filters candidates as the user types in the search box", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const coffee = makeBudget({ id: 10, name: "Coffee" });
    const lunch = makeBudget({ id: 11, name: "Lunch" });
    const dinner = makeBudget({ id: 12, name: "Dinner" });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [coffee, lunch, dinner] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    await user.type(screen.getByLabelText(/search source budgets/i), "lun");

    expect(screen.getByRole("button", { name: /Lunch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Coffee/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Dinner/i })).toBeNull();
  });

  it("matches Vietnamese names whether the query or the data is accented", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const accented = makeBudget({ id: 20, name: "Ăn tối" });
    const plain = makeBudget({ id: 21, name: "Coffee" });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [accented, plain] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    // Plain ASCII query should still match the accented budget name.
    await user.type(screen.getByLabelText(/search source budgets/i), "an toi");
    expect(screen.getByRole("button", { name: /Ăn tối/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Coffee/i })).toBeNull();
  });

  it("matches Vietnamese đ as plain d in either direction", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const dau = makeBudget({ id: 30, name: "Đậu phụng" });
    const other = makeBudget({ id: 31, name: "Coffee" });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [dau, other] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    // "dau" should hit "Đậu" — both Đ→d and the diacritics on âu must normalize away.
    await user.type(screen.getByLabelText(/search source budgets/i), "dau");
    expect(screen.getByRole("button", { name: /Đậu phụng/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Coffee/i })).toBeNull();
  });

  it("shows a no-match card with a clear button when nothing matches", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const coffee = makeBudget({ id: 40, name: "Coffee" });
    useQueryMock.mockReturnValue(useQueryReturn({ data: [coffee] }));

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));
    await user.type(screen.getByLabelText(/search source budgets/i), "xyz");

    expect(screen.getByText(/no budgets match "xyz"/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Coffee/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(screen.getByRole("button", { name: /^Coffee/i })).toBeInTheDocument();
  });

  it("appends a period range to row labels in the EARLIER group", () => {
    const oldWeekly = makeBudget({
      id: 21,
      name: "an toi",
      period: "week",
      periodStartDate: "2026-04-12",
      periodEndDate: "2026-04-18",
    });
    const oldMonthly = makeBudget({
      id: 22,
      name: "an toi",
      period: "month",
      periodStartDate: "2026-01-01",
      periodEndDate: "2026-01-31",
    });
    useQueryMock.mockReturnValue(
      useQueryReturn({ data: [oldWeekly, oldMonthly] })
    );

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={makeBudget({ id: 1, name: "Groceries" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select source budget/i }));

    // Both budgets share the name "an toi" — their period range disambiguates them.
    expect(screen.getByText(/Apr 12 – Apr 18/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2026/i)).toBeInTheDocument();
  });
});
