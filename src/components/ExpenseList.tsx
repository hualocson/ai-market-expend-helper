import dayjs from "@/configs/date";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { formatVnd } from "@/lib/utils";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import ExpenseListItem from "@/components/ExpenseListItem";
import ExpenseMonthTabs from "@/components/ExpenseMonthTabs";

type ExpenseListProps = {
  selectedMonth?: string;
};

const buildMonthOptions = (count = 12) => {
  return Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - 1 - index, "month")
      .startOf("month")
  );
};

const ExpenseList = async ({ selectedMonth }: ExpenseListProps) => {
  const parsedMonth = selectedMonth
    ? dayjs(selectedMonth, "YYYY-MM", true)
    : dayjs();
  const activeMonth = parsedMonth.isValid() ? parsedMonth : dayjs();
  const startOfMonth = activeMonth.startOf("month");
  const endOfMonth = activeMonth.add(1, "month").startOf("month");
  const monthOptions = buildMonthOptions();
  const monthItems = monthOptions.map((month) => {
    const value = month.format("YYYY-MM");
    const isCurrent = value === dayjs().format("YYYY-MM");
    return {
      value,
      label: month.format("MMM"),
      href: isCurrent ? "/" : `/?month=${value}`,
      isActive: value === startOfMonth.format("YYYY-MM"),
    };
  });

  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        gte(expenses.date, startOfMonth.format("YYYY-MM-DD")),
        lt(expenses.date, endOfMonth.format("YYYY-MM-DD"))
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

  return (
    <section className="flex w-full grow flex-col gap-4 overflow-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-foreground text-lg font-semibold sm:text-xl">
            All expenses
          </h2>
          <p className="text-muted-foreground text-sm">
            Latest entries from your sheet.
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {rows.length} items
        </span>
      </div>
      <div className="shrink-0">
        <ExpenseMonthTabs items={monthItems} />
      </div>

      <div className="bg-muted/30 scroll-fade-y no-scrollbar flex grow flex-col gap-4 overflow-y-auto rounded-3xl p-4 sm:p-6">
        {rows.length ? (
          groupedRows.map((group) => (
            <div key={group.key}>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide">
                  {group.label}
                </p>
                {/* total amount of day */}
                <div className="text-foreground text-right text-sm font-semibold">
                  -{formatVnd(group.totalAmount)} VND
                </div>
              </div>
              <div className="divide-border/60 divide-y">
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
            No expenses for this month yet. Add one above to see it here.
          </div>
        )}
      </div>
    </section>
  );
};

export default ExpenseList;
