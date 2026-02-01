"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  createWeeklyBudgetEntry,
  deleteWeeklyBudgetEntry,
  updateWeeklyBudgetEntry,
} from "@/app/actions/budget-weekly-actions";
import dayjs from "@/configs/date";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { BudgetListItem, BudgetPeriod } from "@/types/budget-weekly";
import { Plus, SaveIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

type BudgetWeeklyBudgetsClientProps = {
  weekStartDate: string;
  budgets: BudgetListItem[];
};

type BudgetSectionSummary = {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  count: number;
};

type WeeklyGroup = {
  key: string;
  label: string;
  shortLabel: string;
  budgets: BudgetListItem[];
  summary: BudgetSectionSummary;
};

const PERIOD_OPTIONS: Array<{ value: BudgetPeriod; label: string }> = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const summarizeBudgets = (items: BudgetListItem[]): BudgetSectionSummary => {
  const totalBudget = items.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = items.reduce((sum, budget) => sum + budget.spent, 0);
  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    count: items.length,
  };
};

const monthKeyToDate = (monthKey: string) => dayjs(`${monthKey}-01`);

const getMonthKey = (dateValue: string) => {
  const parsed = dayjs(dateValue);
  return parsed.isValid() ? parsed.format("YYYY-MM") : null;
};

const formatMonthLabel = (monthKey: string, format = "MMM YYYY") => {
  const parsed = monthKeyToDate(monthKey);
  return parsed.isValid() ? parsed.format(format) : monthKey;
};

const getWeekKey = (dateValue: string) => {
  const parsed = dayjs(dateValue);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

const formatWeekLabel = (weekKey: string) => {
  const parsed = dayjs(weekKey, "YYYY-MM-DD", true);
  if (!parsed.isValid()) {
    return weekKey;
  }
  const { weekStartDate, weekEndDate } = getWeekRange(parsed);
  return `${weekStartDate.format("DD MMM")} - ${weekEndDate.format("DD MMM")}`;
};

const formatWeekPillLabel = (weekKey: string) => {
  const parsed = dayjs(weekKey, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed.format("DD MMM") : weekKey;
};

const formatPeriodLabel = (budget: BudgetListItem) => {
  const start = dayjs(budget.periodStartDate);
  const end = budget.periodEndDate ? dayjs(budget.periodEndDate) : null;
  if (budget.period === "month") {
    return start.isValid() ? start.format("MMM YYYY") : "Monthly";
  }
  if (budget.period === "custom") {
    if (start.isValid() && end?.isValid()) {
      return `${start.format("DD MMM")} - ${end.format("DD MMM")}`;
    }
    return "Custom range";
  }
  const { weekStartDate } = getWeekRange(start.isValid() ? start : dayjs());
  return `Week of ${weekStartDate.format("DD MMM")}`;
};

const resolvePeriodStart = (periodValue: BudgetPeriod, dateValue: string) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  const base = parsed.isValid() ? parsed : dayjs();
  if (periodValue === "month") {
    return base.startOf("month").format("YYYY-MM-DD");
  }
  if (periodValue === "week") {
    return getWeekRange(base).weekStartDate.format("YYYY-MM-DD");
  }
  return base.format("YYYY-MM-DD");
};

const BudgetWeeklyBudgetsClient = ({
  weekStartDate,
  budgets,
}: BudgetWeeklyBudgetsClientProps) => {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeBudget, setActiveBudget] = useState<BudgetListItem | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState<BudgetPeriod>("week");
  const [periodStartDate, setPeriodStartDate] = useState(weekStartDate);
  const [periodEndDate, setPeriodEndDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentMonthKey = dayjs().format("YYYY-MM");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey);
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(
    weekStartDate
  );

  const formTitle = activeBudget ? "Edit budget" : "New budget";
  const submitLabel = activeBudget ? "Save changes" : "Create budget";
  const parsedStart = dayjs(periodStartDate, "YYYY-MM-DD", true);
  const parsedEnd = periodEndDate
    ? dayjs(periodEndDate, "YYYY-MM-DD", true)
    : null;
  const hasValidPeriod =
    parsedStart.isValid() &&
    (period !== "custom" ||
      (parsedEnd?.isValid() && !parsedEnd.isBefore(parsedStart, "day")));
  const isValid = name.trim().length > 0 && amount > 0 && hasValidPeriod;
  const canSubmit = isValid && !isSaving;
  const periodRangeLabel = useMemo(() => {
    const start = dayjs(periodStartDate, "YYYY-MM-DD", true);
    const end = periodEndDate ? dayjs(periodEndDate, "YYYY-MM-DD", true) : null;
    if (!start.isValid()) {
      return "Select a valid start date.";
    }
    if (period === "month") {
      return `${start.startOf("month").format("DD MMM YYYY")} - ${start.endOf("month").format("DD MMM YYYY")}`;
    }
    if (period === "custom") {
      if (!end?.isValid()) {
        return "Select an end date.";
      }
      return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
    }
    const { weekStartDate, weekEndDate } = getWeekRange(start);
    return `${weekStartDate.format("DD MMM YYYY")} - ${weekEndDate.format("DD MMM YYYY")}`;
  }, [period, periodEndDate, periodStartDate]);

  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    budgets.forEach((budget) => {
      if (budget.period === "week" || budget.period === "month") {
        const key = getMonthKey(budget.periodStartDate);
        if (key) {
          keys.add(key);
        }
      }
    });
    keys.add(currentMonthKey);
    return Array.from(keys).sort(
      (a, b) => monthKeyToDate(b).valueOf() - monthKeyToDate(a).valueOf()
    );
  }, [budgets, currentMonthKey]);

  const monthOptions = useMemo(
    () => [
      { id: "all", label: "All months" },
      ...monthKeys.map((key) => ({
        id: key,
        label: key === currentMonthKey ? "This month" : formatMonthLabel(key),
      })),
    ],
    [monthKeys, currentMonthKey]
  );

  const activeMonthKey = monthFilter === "all" ? null : monthFilter;
  const activeMonthLabel =
    monthFilter === "all"
      ? "all months"
      : monthFilter === currentMonthKey
        ? "this month"
        : formatMonthLabel(monthFilter, "MMMM YYYY");

  const monthlyBudgets = useMemo(
    () => budgets.filter((budget) => budget.period === "month"),
    [budgets]
  );
  const weeklyBudgets = useMemo(
    () => budgets.filter((budget) => budget.period === "week"),
    [budgets]
  );
  const customBudgets = useMemo(
    () => budgets.filter((budget) => budget.period === "custom"),
    [budgets]
  );

  const filteredMonthlyBudgets = useMemo(() => {
    const sorted = [...monthlyBudgets].sort(
      (a, b) =>
        dayjs(b.periodStartDate).valueOf() - dayjs(a.periodStartDate).valueOf()
    );
    if (!activeMonthKey) {
      return sorted;
    }
    return sorted.filter(
      (budget) => getMonthKey(budget.periodStartDate) === activeMonthKey
    );
  }, [activeMonthKey, monthlyBudgets]);

  const monthSummaryBudgets = useMemo(() => {
    if (!activeMonthKey) {
      return budgets;
    }
    return budgets.filter(
      (budget) => getMonthKey(budget.periodStartDate) === activeMonthKey
    );
  }, [activeMonthKey, budgets]);

  const monthSummary = useMemo(
    () => summarizeBudgets(monthSummaryBudgets),
    [monthSummaryBudgets]
  );

  const weeklyBudgetsForMonth = useMemo(() => {
    if (!activeMonthKey) {
      return [];
    }
    return weeklyBudgets.filter(
      (budget) => getMonthKey(budget.periodStartDate) === activeMonthKey
    );
  }, [activeMonthKey, weeklyBudgets]);

  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const grouped = new Map<string, BudgetListItem[]>();
    weeklyBudgetsForMonth.forEach((budget) => {
      const key = getWeekKey(budget.periodStartDate);
      if (!key) {
        return;
      }
      const list = grouped.get(key) ?? [];
      list.push(budget);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => dayjs(b).valueOf() - dayjs(a).valueOf())
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
        return {
          key,
          label: formatWeekLabel(key),
          shortLabel: formatWeekPillLabel(key),
          budgets: sorted,
          summary: summarizeBudgets(sorted),
        };
      });
  }, [weeklyBudgetsForMonth]);

  const activeWeekGroup = useMemo(
    () => weeklyGroups.find((group) => group.key === activeWeekKey) ?? null,
    [activeWeekKey, weeklyGroups]
  );

  const sortedCustomBudgets = useMemo(
    () =>
      [...customBudgets].sort(
        (a, b) =>
          dayjs(b.periodStartDate).valueOf() -
          dayjs(a.periodStartDate).valueOf()
      ),
    [customBudgets]
  );

  const customSummary = useMemo(
    () => summarizeBudgets(sortedCustomBudgets),
    [sortedCustomBudgets]
  );

  useEffect(() => {
    if (!weeklyGroups.length) {
      setActiveWeekKey(null);
      return;
    }

    setActiveWeekKey((current) => {
      if (current && weeklyGroups.some((group) => group.key === current)) {
        return current;
      }
      const currentWeek = weeklyGroups.find(
        (group) => group.key === weekStartDate
      );
      return currentWeek?.key ?? weeklyGroups[0].key;
    });
  }, [weekStartDate, weeklyGroups]);

  const renderBudgetCard = (budget: BudgetListItem) => {
    const progress =
      budget.amount > 0 ? Math.min(budget.spent / budget.amount, 1) : 0;
    const percentSpent =
      budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0;
    const isOver = budget.amount > 0 && budget.spent > budget.amount;
    return (
      <button
        key={budget.id}
        type="button"
        onClick={() => openEdit(budget)}
        className={cn(
          "group relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 active:scale-[0.99]",
          "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
        )}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-foreground line-clamp-1 text-sm font-semibold">
              {budget.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatPeriodLabel(budget)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              isOver
                ? "bg-rose-500/20 text-rose-200"
                : "bg-emerald-500/20 text-emerald-200"
            )}
          >
            {isOver ? "Over" : "On track"}
          </span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Spent
            </p>
            <p className="text-foreground text-sm font-semibold">
              {formatVnd(budget.spent)} VND
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-right">
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Remaining
            </p>
            <p
              className={cn(
                "text-sm font-semibold",
                budget.remaining < 0 ? "text-rose-300" : "text-emerald-300"
              )}
            >
              {formatVndSigned(budget.remaining)} VND
            </p>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              isOver ? "bg-rose-500" : "bg-emerald-400"
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-muted-foreground flex w-full items-center justify-between text-[11px]">
          <span>{formatVnd(budget.amount)} VND budget</span>
          <span>{percentSpent}% used</span>
        </div>
      </button>
    );
  };

  const renderSectionSummary = (summary: BudgetSectionSummary) => (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
      <div>
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
          Budgeted
        </p>
        <p className="text-foreground text-sm font-semibold">
          {formatVnd(summary.totalBudget)} VND
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
          Spent
        </p>
        <p className="text-foreground text-sm font-semibold">
          {formatVnd(summary.totalSpent)} VND
        </p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
          Remaining
        </p>
        <p
          className={cn(
            "text-sm font-semibold",
            summary.totalRemaining < 0 ? "text-rose-300" : "text-emerald-300"
          )}
        >
          {formatVndSigned(summary.totalRemaining)} VND
        </p>
      </div>
    </div>
  );

  const handleOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setActiveBudget(null);
      setName("");
      setAmount(0);
      setPeriod("week");
      setPeriodStartDate(weekStartDate);
      setPeriodEndDate(null);
    }
  };

  const openCreate = () => {
    setActiveBudget(null);
    setName("");
    setAmount(0);
    setPeriod("week");
    setPeriodStartDate(weekStartDate);
    setPeriodEndDate(null);
    setSheetOpen(true);
  };

  const openEdit = (budget: BudgetListItem) => {
    setActiveBudget(budget);
    setName(budget.name);
    setAmount(budget.amount);
    setPeriod(budget.period);
    setPeriodStartDate(budget.periodStartDate);
    setPeriodEndDate(budget.periodEndDate ?? null);
    setSheetOpen(true);
  };

  const handlePeriodChange = (nextPeriod: BudgetPeriod) => {
    const nextStart = resolvePeriodStart(
      nextPeriod,
      periodStartDate || weekStartDate
    );
    setPeriod(nextPeriod);
    setPeriodStartDate(nextStart);
    if (nextPeriod === "custom") {
      setPeriodEndDate((current) => {
        if (!current) {
          return nextStart;
        }
        const parsedEnd = dayjs(current, "YYYY-MM-DD", true);
        if (!parsedEnd.isValid()) {
          return nextStart;
        }
        return parsedEnd.isBefore(dayjs(nextStart), "day")
          ? nextStart
          : current;
      });
    } else {
      setPeriodEndDate(null);
    }
  };

  const handleStartDateChange = (value: string) => {
    setPeriodStartDate(value);
    if (period === "custom" && periodEndDate) {
      const parsedEnd = dayjs(periodEndDate, "YYYY-MM-DD", true);
      const parsedStart = dayjs(value, "YYYY-MM-DD", true);
      if (parsedEnd.isValid() && parsedStart.isValid()) {
        if (parsedEnd.isBefore(parsedStart, "day")) {
          setPeriodEndDate(value);
        }
      }
    }
  };

  const handleEndDateChange = (value: string) => {
    setPeriodEndDate(value);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setIsSaving(true);
      if (activeBudget) {
        await updateWeeklyBudgetEntry(activeBudget.id, {
          name,
          amount,
          period,
          periodStartDate,
          periodEndDate: period === "custom" ? periodEndDate : null,
        });
        toast.success("Budget updated.");
      } else {
        await createWeeklyBudgetEntry({
          name,
          amount,
          period,
          periodStartDate,
          periodEndDate: period === "custom" ? periodEndDate : null,
        });
        toast.success("Budget created.");
      }
      setSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeBudget) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteWeeklyBudgetEntry(activeBudget.id);
      toast.success("Budget deleted.");
      setConfirmOpen(false);
      setSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete budget.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="relative space-y-4">
      <Button onClick={openCreate} className="hidden h-10 rounded-full sm:flex">
        <Plus className="h-4 w-4" />
        Add budget
      </Button>

      <div className="no-scrollbar scroll-fade-x flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto pb-1">
        {monthOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setMonthFilter(option.id)}
            className={cn(
              "h-8 snap-center rounded-full px-3 text-xs font-semibold",
              monthFilter === option.id
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "text-muted-foreground bg-white/5 hover:bg-white/10"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Month summary
            </h3>
            <p className="text-muted-foreground text-xs">
              {monthSummary.count} budgets ·{" "}
              {activeMonthKey
                ? formatMonthLabel(activeMonthKey, "MMMM YYYY")
                : "All months"}
            </p>
          </div>
        </div>
        {renderSectionSummary(monthSummary)}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Monthly budgets
            </h3>
            <p className="text-muted-foreground text-xs">
              {filteredMonthlyBudgets.length} budgets
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            {activeMonthKey ? formatMonthLabel(activeMonthKey) : "All months"}
          </p>
        </div>
        {filteredMonthlyBudgets.length ? (
          <div className="flex flex-col gap-3">
            {filteredMonthlyBudgets.map(renderBudgetCard)}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs">
            No monthly budgets for {activeMonthLabel} yet.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Weekly budgets
            </h3>
            <p className="text-muted-foreground text-xs">
              {activeMonthKey ? `${weeklyGroups.length} weeks` : "Pick a month"}
            </p>
          </div>
        </div>
        {!activeMonthKey ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs">
            Select a month to see weekly breakdown.
          </div>
        ) : weeklyGroups.length ? (
          <div className="space-y-3">
            <div className="no-scrollbar scroll-fade-x flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto pb-1">
              {weeklyGroups.map((group) => (
                <Button
                  key={group.key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveWeekKey(group.key)}
                  className={cn(
                    "h-8 snap-center rounded-full px-3 text-xs font-semibold",
                    activeWeekKey === group.key
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "text-muted-foreground bg-white/5 hover:bg-white/10"
                  )}
                >
                  {group.shortLabel}
                </Button>
              ))}
            </div>
            {activeWeekGroup ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground text-sm font-semibold">
                      {activeWeekGroup.label}
                    </h4>
                    <p className="text-muted-foreground text-xs">
                      {activeWeekGroup.budgets.length} budgets
                    </p>
                  </div>
                </div>
                {renderSectionSummary(activeWeekGroup.summary)}
                <div className="flex flex-col gap-3">
                  {activeWeekGroup.budgets.map(renderBudgetCard)}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs">
            No weekly budgets for {activeMonthLabel} yet.
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Custom budgets
            </h3>
            <p className="text-muted-foreground text-xs">
              {customSummary.count} budgets
            </p>
          </div>
          <p className="text-muted-foreground text-xs">All ranges</p>
        </div>
        {renderSectionSummary(customSummary)}
        {sortedCustomBudgets.length ? (
          <div className="flex flex-col gap-3">
            {sortedCustomBudgets.map(renderBudgetCard)}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-white/10 bg-white/10 px-4 py-3 text-xs">
            No custom budgets yet.
          </div>
        )}
      </div>

      <div className="bg-background/80 sticky bottom-0 left-0 z-20 -mx-4 mt-2 w-full border-t border-white/10 pt-3 pb-4 backdrop-blur sm:hidden">
        <Button onClick={openCreate} className="h-11 w-full rounded-full">
          <Plus className="h-4 w-4" />
          Add budget
        </Button>
      </div>

      <Drawer
        open={sheetOpen}
        onOpenChange={handleOpenChange}
        repositionInputs={false}
      >
        <DrawerContent className="rounded-t-3xl! border-t-0!">
          <DrawerHeader>
            <DrawerTitle>{formTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-medium">
                Budget name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Groceries"
                className="h-10"
                tabIndex={0}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-medium">
                Amount
              </label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={amount ? formatVnd(amount) : ""}
                  onChange={(event) =>
                    setAmount(parseVndInput(event.target.value))
                  }
                  placeholder="0"
                  className="h-10 pr-12 text-right text-lg font-semibold"
                />
                <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                  VND
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-medium">
                Period
              </label>
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePeriodChange(option.value)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-semibold",
                      period === option.value
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "text-muted-foreground bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-foreground text-sm font-medium">
                  Start date
                </label>
                <Input
                  type="date"
                  value={periodStartDate || ""}
                  onChange={(event) =>
                    handleStartDateChange(event.target.value)
                  }
                  className="h-10"
                />
              </div>
              {period === "custom" ? (
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-medium">
                    End date
                  </label>
                  <Input
                    type="date"
                    value={periodEndDate || ""}
                    onChange={(event) =>
                      handleEndDateChange(event.target.value)
                    }
                    className="h-10"
                  />
                </div>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">{periodRangeLabel}</p>
          </div>
          <DrawerFooter className="gap-2 border-t border-white/10">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-xl"
            >
              <SaveIcon />
              {submitLabel}
            </Button>
            {activeBudget ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmOpen(true)}
                disabled={isSaving}
                className="text-destructive bg-destructive/10 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this budget?</DialogTitle>
            <DialogDescription>
              Transactions will be unassigned if you delete this budget.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default BudgetWeeklyBudgetsClient;
