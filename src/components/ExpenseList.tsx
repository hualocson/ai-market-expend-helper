import Link from "next/link";

import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { formatVnd } from "@/lib/utils";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import ExpenseListItem from "@/components/ExpenseListItem";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";

import JumpToTopButton from "./JumpToTopButton";

type ExpenseListProps = {
  selectedMonth?: string;
  mode?: "full" | "recent";
  recentDays?: number;
  showMonthTabs?: boolean;
  showViewFull?: boolean;
  monthTabBasePath?: string;
};

const buildMonthOptions = (count = 12) => {
  return Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - 1 - index, "month")
      .startOf("month")
  );
};

const ExpenseList = async ({
  selectedMonth,
  mode = "full",
  recentDays = 7,
  showMonthTabs,
  showViewFull = false,
  monthTabBasePath = "/",
}: ExpenseListProps) => {
  const isRecent = mode === "recent";
  const parsedMonth = selectedMonth
    ? dayjs(selectedMonth, "YYYY-MM", true)
    : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const showTabs = showMonthTabs ?? !isRecent;
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
  const monthOptions = buildMonthOptions();
  const monthItems = monthOptions.map((month) => {
    const value = month.format("YYYY-MM");
    const isCurrent = value === dayjs().format("YYYY-MM");
    return {
      value,
      label: month.format("MMM"),
      href: isCurrent ? monthTabBasePath : `${monthTabBasePath}?month=${value}`,
      isActive: value === startOfMonth.format("YYYY-MM"),
    };
  });

  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, rangeStart.format("YYYY-MM-DD")),
        lt(expenses.date, rangeEnd.format("YYYY-MM-DD"))
      )
    )
    .orderBy(desc(expenses.date), desc(expenses.id));

  type ExpenseRow = (typeof rows)[number];
  const groupedRows = rows.reduce(
    (acc, expense) => {
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
    },
    [] as Array<{
      key: string;
      label: string;
      items: ExpenseRow[];
      totalAmount: number;
    }>
  );

  const title = isRecent
    ? `Latest ${effectiveRecentDays} days`
    : "All expenses";
  const subtitle = isRecent
    ? "Recent entries from this month."
    : "Latest entries from your sheet.";

  return (
    <section className="flex w-full grow flex-col gap-4 overflow-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-foreground text-lg font-semibold sm:text-xl">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        <span className="text-muted-foreground text-xs">
          {rows.length} items
        </span>
      </div>
      {showTabs ? (
        <div className="shrink-0">
          <ExpenseMonthTabs items={monthItems} />
        </div>
      ) : null}

      <div
        id="expense-list"
        className="bg-muted/30 no-scrollbar relative flex grow flex-col gap-6 overflow-y-auto rounded-3xl px-4 py-4 sm:px-6"
      >
        {rows.length ? (
          groupedRows.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide">
                  {group.label}
                </p>
                {/* total amount of day */}
                <div className="text-foreground text-right text-sm font-semibold">
                  -{formatVnd(group.totalAmount)} VND
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {group.items.map((expense) => (
                  <ExpenseListItem
                    key={expense.id}
                    expense={{
                      id: expense.id,
                      date: String(expense.date),
                      amount: expense.amount,
                      note: expense.note,
                      category: expense.category,
                      paidBy: expense.paidBy,
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {isRecent
              ? `No expenses in the last ${effectiveRecentDays} days.`
              : "No expenses for this month yet. Add one above to see it here."}
          </div>
        )}
        {showViewFull ? (
          <Link href="/transactions" className="w-full">
            <Button
              variant="ghost"
              className="w-full rounded-full active:scale-[0.97]"
            >
              View full
              <ArrowRightIcon />
            </Button>
          </Link>
        ) : null}

        {mode === "full" && (
          <JumpToTopButton
            targetId="expense-list"
            className="right-6 bottom-[72px]"
          />
        )}
      </div>
    </section>
  );
};

export default ExpenseList;
