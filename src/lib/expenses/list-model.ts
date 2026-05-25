import dayjs from "@/configs/date";

export type ExpenseListQueryParams = {
  month?: string;
  q?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  limit?: number;
  offset?: number;
};

export type ExpenseListItem = {
  id: number;
  date: string;
  amount: number;
  note: string;
  category: string;
  paidBy: string;
  budgetId: number | null;
  budgetName: string | null;
};

export type ExpenseListGroup = {
  key: string;
  label: string;
  items: ExpenseListItem[];
  totalAmount: number;
};

export type ExpenseListResult = {
  activeMonth: string;
  effectiveRecentDays: number;
  groupedRows: ExpenseListGroup[];
  isRecent: boolean;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset?: number;
  };
  rows: ExpenseListItem[];
  trimmedSearch?: string;
};

export const resolveExpenseListRange = ({
  month,
  mode = "full",
  recentDays = 7,
}: Pick<ExpenseListQueryParams, "month" | "mode" | "recentDays">) => {
  const isRecent = mode === "recent";
  const parsedMonth = month ? dayjs(month, "YYYY-MM", true) : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const effectiveRecentDays = Math.max(1, recentDays);
  const isCurrentMonth = activeMonth.isSame(dayjs(), "month");
  const recentRangeEnd = isCurrentMonth
    ? dayjs().add(1, "day").startOf("day")
    : endOfMonth;
  const recentRangeStart = recentRangeEnd.subtract(effectiveRecentDays, "day");
  const rangeStart = isRecent
    ? recentRangeStart.isAfter(startOfMonth)
      ? recentRangeStart
      : startOfMonth
    : startOfMonth;
  const rangeEnd = isRecent
    ? recentRangeEnd.isBefore(endOfMonth)
      ? recentRangeEnd
      : endOfMonth
    : endOfMonth;

  return {
    activeMonth,
    effectiveRecentDays,
    isRecent,
    rangeEnd,
    rangeStart,
    startOfMonth,
  };
};

export const groupExpenseRowsByDate = (
  rows: ExpenseListItem[]
): ExpenseListGroup[] => {
  return rows.reduce<ExpenseListGroup[]>((acc, expense) => {
    const parsedDate = dayjs(expense.date);
    const key = parsedDate.isValid()
      ? parsedDate.format("YYYY-MM-DD")
      : String(expense.date);
    const label = parsedDate.isValid()
      ? parsedDate.format("dddd, DD/MM/YYYY")
      : String(expense.date);
    const lastGroup = acc[acc.length - 1];

    if (!lastGroup || lastGroup.key !== key) {
      acc.push({ key, label, items: [expense], totalAmount: expense.amount });
    } else {
      lastGroup.items.push(expense);
      lastGroup.totalAmount += expense.amount;
    }

    return acc;
  }, []);
};
