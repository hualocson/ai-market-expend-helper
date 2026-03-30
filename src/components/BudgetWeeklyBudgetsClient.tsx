"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import {
  createWeeklyBudgetEntry,
  deleteWeeklyBudgetEntry,
  updateWeeklyBudgetEntry,
} from "@/app/actions/budget-weekly-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import {
  budgetOverviewQueryKey,
  budgetTransactionsQueryKey,
  fetchBudgetOverview,
  fetchBudgetTransactions,
} from "@/lib/queries/budgets";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import {
  BudgetAssignedTransaction,
  BudgetListItem,
  BudgetPeriod,
} from "@/types/budget-weekly";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftIcon,
  Loader2,
  Plus,
  SaveIcon,
  Trash2,
} from "lucide-react";
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
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import PaidByIcon, { getPaidByPalette } from "@/components/PaidByIcon";

type BudgetWeeklyBudgetsClientProps = {
  weekStartDate: string;
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

type DashboardTab = "month" | "week" | "custom";

type BudgetStatus = {
  progress: number;
  percentSpent: number;
  statusLabel: "On track" | "Near limit" | "Over budget";
  isOver: boolean;
  isNearLimit: boolean;
};

const PERIOD_OPTIONS: Array<{
  value: BudgetPeriod;
  label: string;
  hint: string;
}> = [
  { value: "week", label: "Weekly", hint: "Resets every week" },
  { value: "month", label: "Monthly", hint: "Best for fixed bills" },
  { value: "custom", label: "Custom", hint: "Flexible date range" },
];

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "custom", label: "Custom" },
];

const DETAIL_PAGE_SIZE = 20;
const WEEKLY_FILTER_LIMIT = 5;
const CATEGORY_VALUES = new Set(Object.values(Category));

const resolveCategory = (category: string) =>
  CATEGORY_VALUES.has(category as Category)
    ? (category as Category)
    : Category.OTHER;

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

const formatBudgetPeriodRange = (budget: BudgetListItem) => {
  const start = dayjs(budget.periodStartDate, "YYYY-MM-DD", true);
  const end = budget.periodEndDate
    ? dayjs(budget.periodEndDate, "YYYY-MM-DD", true)
    : null;

  if (!start.isValid()) {
    return "Invalid period";
  }

  if (budget.period === "month") {
    return `${start.startOf("month").format("DD MMM YYYY")} - ${start.endOf("month").format("DD MMM YYYY")}`;
  }

  if (budget.period === "custom") {
    if (!end?.isValid()) {
      return "Custom range";
    }
    return `${start.format("DD MMM YYYY")} - ${end.format("DD MMM YYYY")}`;
  }

  const { weekStartDate, weekEndDate } = getWeekRange(start);
  return `${weekStartDate.format("DD MMM YYYY")} - ${weekEndDate.format("DD MMM YYYY")}`;
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

const getBudgetStatus = (budget: BudgetListItem): BudgetStatus => {
  const spentRate = budget.amount > 0 ? budget.spent / budget.amount : 0;
  const percentSpent = Math.max(Math.round(spentRate * 100), 0);
  const progress = Math.min(Math.max(spentRate, 0), 1);
  const isOver = budget.amount > 0 && budget.spent > budget.amount;
  const isNearLimit = !isOver && percentSpent >= 80;

  return {
    progress,
    percentSpent,
    statusLabel: isOver
      ? "Over budget"
      : isNearLimit
        ? "Near limit"
        : "On track",
    isOver,
    isNearLimit,
  };
};

const useHorizontalFadeMask = (deps: unknown[] = []) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftFade(scrollLeft > 10);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, deps);

  const maskImage =
    showLeftFade && showRightFade
      ? "linear-gradient(to right, transparent, black 1.5rem, black calc(100% - 1.5rem), transparent)"
      : showLeftFade && !showRightFade
        ? "linear-gradient(to right, transparent, black 1.5rem, black 100%)"
        : !showLeftFade && showRightFade
          ? "linear-gradient(to right, black 0%, black calc(100% - 1.5rem), transparent)"
          : "none";

  return { scrollContainerRef, maskImage };
};

const BudgetWeeklyBudgetsClient = ({
  weekStartDate,
}: BudgetWeeklyBudgetsClientProps) => {
  const queryClient = useQueryClient();
  const {
    data: overview,
    error,
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: budgetOverviewQueryKey,
    queryFn: fetchBudgetOverview,
  });

  const budgets = overview?.budgets ?? [];
  const [activeTab, setActiveTab] = useState<DashboardTab>("week");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [activeBudget, setActiveBudget] = useState<BudgetListItem | null>(null);
  const [detailBudget, setDetailBudget] = useState<BudgetListItem | null>(null);

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
  const formDescription = activeBudget
    ? "Adjust the limit and schedule for this budget."
    : "Set a spending cap and period to track this category.";
  const trimmedName = name.trim();
  const parsedStart = dayjs(periodStartDate, "YYYY-MM-DD", true);
  const parsedEnd = periodEndDate
    ? dayjs(periodEndDate, "YYYY-MM-DD", true)
    : null;
  const hasValidPeriod =
    parsedStart.isValid() &&
    (period !== "custom" ||
      (parsedEnd?.isValid() && !parsedEnd.isBefore(parsedStart, "day")));
  const isValid = trimmedName.length > 0 && amount > 0 && hasValidPeriod;
  const canSubmit = isValid && !isSaving;

  const {
    data: transactionPages,
    isPending: transactionsPending,
    isFetching: transactionsFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: transactionError,
  } = useInfiniteQuery({
    queryKey: budgetTransactionsQueryKey(detailBudget?.id ?? 0),
    queryFn: ({ pageParam }) => {
      if (!detailBudget) {
        throw new Error("Budget not found");
      }
      return fetchBudgetTransactions(detailBudget.id, {
        limit: DETAIL_PAGE_SIZE,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    enabled: detailOpen && Boolean(detailBudget),
    staleTime: 30_000,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });

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
    const { weekStartDate: startDate, weekEndDate } = getWeekRange(start);
    return `${startDate.format("DD MMM YYYY")} - ${weekEndDate.format("DD MMM YYYY")}`;
  }, [period, periodEndDate, periodStartDate]);

  const validationMessage = useMemo(() => {
    if (!trimmedName.length) {
      return "Budget name is required.";
    }
    if (amount <= 0) {
      return "Amount must be greater than 0 VND.";
    }
    if (!hasValidPeriod) {
      return "End date must be on or after start date for custom budgets.";
    }
    return null;
  }, [amount, hasValidPeriod, trimmedName]);

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

  useEffect(() => {
    if (!monthKeys.length) {
      return;
    }

    if (!monthKeys.includes(monthFilter) && monthFilter !== "all") {
      setMonthFilter(monthKeys[0]);
    }
  }, [monthFilter, monthKeys]);

  const monthFade = useHorizontalFadeMask([monthOptions.length, monthFilter]);

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

  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const grouped = new Map<string, BudgetListItem[]>();
    weeklyBudgets.forEach((budget) => {
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
      .slice(0, WEEKLY_FILTER_LIMIT)
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
  }, [weeklyBudgets]);

  const weekFade = useHorizontalFadeMask([weeklyGroups.length, activeWeekKey]);

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

  const transactionItems = useMemo<BudgetAssignedTransaction[]>(
    () => transactionPages?.pages.flatMap((page) => page.items) ?? [],
    [transactionPages]
  );

  const transactionSummary = transactionPages?.pages[0]?.summary ?? {
    count: 0,
    totalSpent: 0,
  };

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

  const renderBudgetItem = (budget: BudgetListItem) => {
    const status = getBudgetStatus(budget);

    return (
      <button
        key={budget.id}
        type="button"
        onClick={() => {
          setDetailBudget(budget);
          setDetailOpen(true);
        }}
        className={cn(
          "group bg-card/80 relative flex flex-col gap-2 rounded-3xl px-4 py-4 text-left shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_42%,transparent)] transition-[transform,box-shadow,background-color] active:scale-[0.99]",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          status.isOver
            ? "bg-destructive/5 hover:bg-destructive/10 shadow-[0_14px_30px_color-mix(in_srgb,var(--destructive)_16%,transparent)]"
            : "hover:bg-card"
        )}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-foreground line-clamp-1 text-sm font-semibold sm:text-base">
            {budget.name}
          </p>
          <p
            className={cn(
              "text-sm font-semibold",
              budget.remaining < 0 ? "text-destructive" : "text-success"
            )}
          >
            {formatVndSigned(budget.remaining)}
          </p>
        </div>
        <div className="flex w-full items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{status.statusLabel}</span>
          <span className="text-muted-foreground">
            {status.percentSpent}% used
          </span>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              status.isOver
                ? "bg-destructive"
                : status.isNearLimit
                  ? "bg-warning"
                  : "bg-success"
            )}
            style={{ width: `${status.progress * 100}%` }}
          />
        </div>
      </button>
    );
  };

  const renderSectionSummary = (
    summary: BudgetSectionSummary,
    title: string,
    subtitle: string
  ) => (
    <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground text-[11px]">{subtitle}</p>
        </div>
        <span className="text-muted-foreground border-border/45 rounded-full border px-2 py-0.5 text-[11px]">
          {summary.count} budgets
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Budgeted
          </p>
          <p className="text-foreground mt-0.5 text-sm font-semibold">
            {formatVnd(summary.totalBudget)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Spent
          </p>
          <p className="text-foreground mt-0.5 text-sm font-semibold">
            {formatVnd(summary.totalSpent)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Remaining
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold",
              summary.totalRemaining < 0 ? "text-destructive" : "text-success"
            )}
          >
            {formatVndSigned(summary.totalRemaining)}
          </p>
        </div>
      </div>
    </div>
  );

  const renderEmptyState = (title: string, description: string) => (
    <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      <Button
        type="button"
        size="sm"
        onClick={openCreate}
        className="mt-3 h-11 rounded-xl"
      >
        <Plus className="h-4 w-4" />
        Add budget
      </Button>
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
        const parsedCurrent = dayjs(current, "YYYY-MM-DD", true);
        if (!parsedCurrent.isValid()) {
          return nextStart;
        }
        return parsedCurrent.isBefore(dayjs(nextStart), "day")
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
      const parsedCurrentEnd = dayjs(periodEndDate, "YYYY-MM-DD", true);
      const parsedCurrentStart = dayjs(value, "YYYY-MM-DD", true);
      if (
        parsedCurrentEnd.isValid() &&
        parsedCurrentStart.isValid() &&
        parsedCurrentEnd.isBefore(parsedCurrentStart, "day")
      ) {
        setPeriodEndDate(value);
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

      await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
      if (activeBudget) {
        await queryClient.invalidateQueries({
          queryKey: budgetTransactionsQueryKey(activeBudget.id),
        });
      }

      setSheetOpen(false);
    } catch (submitError) {
      console.error(submitError);
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

      await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
      await queryClient.removeQueries({
        queryKey: budgetTransactionsQueryKey(activeBudget.id),
      });

      setConfirmOpen(false);
      setSheetOpen(false);
      setDetailOpen(false);
      setDetailBudget(null);
      setActiveBudget(null);
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Failed to delete budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const errorMessage =
    error instanceof Error ? error.message : "Failed to load budgets.";
  const showErrorFallback = isError && !overview;

  return (
    <section className="relative flex flex-col pb-6">
      <div className="sticky top-0 z-20 -mx-4 bg-transparent px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Back to home">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl active:scale-[0.97]"
              >
                <ArrowLeftIcon />
              </Button>
            </Link>
            <div>
              <h1 className="text-foreground text-lg leading-none font-semibold sm:text-xl">
                Budgets
              </h1>
              <p className="text-muted-foreground mt-1 text-xs">
                Compact view with detail drawer for each budget
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            size="sm"
            className="hidden h-11 rounded-xl px-3 sm:flex"
          >
            <Plus className="h-4 w-4" />
            Add budget
          </Button>
        </div>

        <div className="border-border/45 bg-muted/30 mt-3 rounded-xl border p-1">
          <div className="grid grid-cols-3 gap-1">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-11 rounded-lg text-xs font-medium transition",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+40px)]">
        {showErrorFallback ? (
          <div className="border-destructive/35 bg-destructive/10 rounded-2xl border px-4 py-4">
            <p className="text-destructive-foreground text-sm font-semibold">
              Failed to load budgets
            </p>
            <p className="text-destructive-foreground/85 mt-1 text-xs">
              {errorMessage}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => refetch()}
              className="mt-3 h-11 rounded-xl px-4 text-xs font-semibold"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {isPending && !overview ? (
          <div className="space-y-3">
            <div className="bg-card/80 h-20 animate-pulse rounded-2xl" />
            <div className="bg-card/80 h-24 animate-pulse rounded-2xl" />
            <div className="bg-card/80 h-24 animate-pulse rounded-2xl" />
            <div className="bg-card/80 h-24 animate-pulse rounded-2xl" />
          </div>
        ) : null}

        {!showErrorFallback && (!isPending || overview) ? (
          <>
            {activeTab === "month" ? (
              <div className="space-y-2.5">
                <div
                  ref={monthFade.scrollContainerRef}
                  className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-1"
                  style={{
                    maskImage: monthFade.maskImage,
                    WebkitMaskImage: monthFade.maskImage,
                  }}
                >
                  {monthOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setMonthFilter(option.id)}
                      className={cn(
                        "h-11 snap-center rounded-xl px-3.5 text-xs font-medium",
                        monthFilter === option.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground bg-muted/40 hover:bg-muted/60"
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                {renderSectionSummary(
                  monthSummary,
                  "Month summary",
                  activeMonthKey
                    ? formatMonthLabel(activeMonthKey, "MMMM YYYY")
                    : "All months"
                )}

                {filteredMonthlyBudgets.length ? (
                  <div className="flex flex-col gap-2.5">
                    {filteredMonthlyBudgets.map(renderBudgetItem)}
                  </div>
                ) : (
                  renderEmptyState(
                    "No monthly budgets yet",
                    `Create a monthly budget for ${activeMonthLabel}.`
                  )
                )}
              </div>
            ) : null}

            {activeTab === "week" ? (
              <div className="space-y-2.5">
                {weeklyGroups.length ? (
                  <>
                    <div
                      ref={weekFade.scrollContainerRef}
                      className="no-scrollbar flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto pb-1"
                      style={{
                        maskImage: weekFade.maskImage,
                        WebkitMaskImage: weekFade.maskImage,
                      }}
                    >
                      {weeklyGroups.map((group) => (
                        <Button
                          key={group.key}
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setActiveWeekKey(group.key)}
                          className={cn(
                            "h-11 snap-center rounded-xl px-3.5 text-xs font-medium",
                            activeWeekKey === group.key
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground bg-muted/40 hover:bg-muted/60"
                          )}
                        >
                          {group.shortLabel}
                        </Button>
                      ))}
                    </div>

                    {activeWeekGroup
                      ? renderSectionSummary(
                          activeWeekGroup.summary,
                          "Weekly summary",
                          activeWeekGroup.label
                        )
                      : null}

                    {activeWeekGroup?.budgets.length ? (
                      <div className="flex flex-col gap-2.5">
                        {activeWeekGroup.budgets.map(renderBudgetItem)}
                      </div>
                    ) : (
                      renderEmptyState(
                        "No weekly budgets in this week",
                        "Switch week or add a new weekly budget."
                      )
                    )}
                  </>
                ) : (
                  renderEmptyState(
                    "No weekly budgets yet",
                    "Add a weekly budget to start tracking by week."
                  )
                )}
              </div>
            ) : null}

            {activeTab === "custom" ? (
              <div className="space-y-2.5">
                {renderSectionSummary(
                  customSummary,
                  "Custom budget ranges",
                  "All date ranges"
                )}
                {sortedCustomBudgets.length ? (
                  <div className="flex flex-col gap-2.5">
                    {sortedCustomBudgets.map(renderBudgetItem)}
                  </div>
                ) : (
                  renderEmptyState(
                    "No custom budgets yet",
                    "Create a custom range budget for travel, events, or goals."
                  )
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+102px)] z-40 flex justify-center px-4 sm:hidden">
        <div className="w-full max-w-lg">
          <Button
            onClick={openCreate}
            className="pointer-events-auto h-11 w-full rounded-xl text-sm font-semibold shadow-md shadow-black/20"
          >
            <Plus className="h-4 w-4" />
            Add budget
          </Button>
        </div>
      </div>

      <Drawer
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailBudget(null);
          }
        }}
      >
        <DrawerContent className="rounded-t-3xl! border-t-0!">
          <DrawerHeader>
            <DrawerTitle>{detailBudget?.name ?? "Budget detail"}</DrawerTitle>
            <DrawerDescription>
              {detailBudget
                ? formatBudgetPeriodRange(detailBudget)
                : "View budget and assigned transactions."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="no-scrollbar max-h-[62svh] space-y-4 overflow-y-auto px-4 pb-4">
            {detailBudget ? (
              <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                <div className="mb-3 flex w-full items-center justify-between">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      getBudgetStatus(detailBudget).isOver
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : getBudgetStatus(detailBudget).isNearLimit
                          ? "border-warning/40 bg-warning/15 text-warning"
                          : "border-success/35 bg-success/10 text-success"
                    )}
                  >
                    {getBudgetStatus(detailBudget).statusLabel}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {getBudgetStatus(detailBudget).percentSpent}% used
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Budgeted
                    </p>
                    <p className="text-foreground mt-1 font-semibold">
                      {formatVnd(detailBudget.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Spent
                    </p>
                    <p className="text-foreground mt-1 font-semibold">
                      {formatVnd(detailBudget.spent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Remaining
                    </p>
                    <p
                      className={cn(
                        "mt-1 font-semibold",
                        detailBudget.remaining < 0
                          ? "text-destructive"
                          : "text-success"
                      )}
                    >
                      {formatVndSigned(detailBudget.remaining)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground text-sm font-semibold">
                  Assigned transactions
                </h3>
                <span className="text-muted-foreground text-xs">
                  {transactionSummary.count} items
                </span>
              </div>

              {transactionsPending ? (
                <div className="space-y-2">
                  <div className="bg-card/80 h-14 animate-pulse rounded-xl" />
                  <div className="bg-card/80 h-14 animate-pulse rounded-xl" />
                  <div className="bg-card/80 h-14 animate-pulse rounded-xl" />
                </div>
              ) : transactionError ? (
                <div className="border-destructive/35 bg-destructive/10 text-destructive-foreground rounded-xl border px-3 py-3 text-xs">
                  Failed to load assigned transactions.
                </div>
              ) : transactionItems.length ? (
                <div className="space-y-2">
                  {transactionItems.map((transaction) => {
                    const resolvedCategory = resolveCategory(
                      transaction.category
                    );
                    const paidByPalette = getPaidByPalette(transaction.paidBy);
                    return (
                      <div
                        key={transaction.id}
                        className="border-border/45 bg-card/60 rounded-xl border px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-foreground line-clamp-1 text-sm font-medium">
                              {transaction.note?.trim() || "No note"}
                            </p>
                            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span>
                                {dayjs(transaction.date).format("DD/MM/YYYY")}
                              </span>
                              <span aria-hidden>·</span>
                              <ExpenseItemIcon
                                category={resolvedCategory}
                                size="sm"
                                className="size-4 bg-transparent"
                              />
                              <span className="sr-only">
                                {transaction.category} category
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium",
                                  paidByPalette.badge
                                )}
                                aria-label={`Paid by ${transaction.paidBy}`}
                              >
                                <PaidByIcon paidBy={transaction.paidBy} size="sm" />
                                <span className="pr-1">{transaction.paidBy}</span>
                              </span>
                            </div>
                          </div>
                          <p className="text-foreground shrink-0 text-sm font-semibold">
                            -{formatVnd(transaction.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {hasNextPage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="h-11 w-full rounded-xl"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Show more"
                      )}
                    </Button>
                  ) : null}

                  {transactionsFetching && !isFetchingNextPage ? (
                    <p className="text-muted-foreground text-center text-[11px]">
                      Updating...
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="border-border/55 bg-card/40 rounded-xl border border-dashed px-3 py-4 text-center">
                  <p className="text-foreground text-sm font-medium">
                    No assigned transactions in this budget period.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={() => {
                if (!detailBudget) {
                  return;
                }
                setDetailOpen(false);
                openEdit(detailBudget);
              }}
              className="h-11 rounded-2xl"
            >
              <SaveIcon />
              Edit budget
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive bg-destructive/12 h-11 rounded-2xl"
              onClick={() => {
                if (!detailBudget) {
                  return;
                }
                setActiveBudget(detailBudget);
                setConfirmOpen(true);
              }}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
              Delete budget
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={sheetOpen}
        onOpenChange={handleOpenChange}
        repositionInputs={false}
      >
        <DrawerContent className="rounded-t-3xl! border-t-0!">
          <DrawerHeader className="gap-1 pb-2">
            <DrawerTitle>{formTitle}</DrawerTitle>
            <DrawerDescription>{formDescription}</DrawerDescription>
          </DrawerHeader>
          <div className="no-scrollbar flex max-h-[65svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="budget-name-input"
                  className="text-foreground text-sm font-medium"
                >
                  Budget name
                </label>
                <span className="text-muted-foreground text-[11px]">
                  {trimmedName.length}/36
                </span>
              </div>
              <Input
                id="budget-name-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Groceries"
                maxLength={36}
                aria-invalid={trimmedName.length === 0}
                className="h-11"
                tabIndex={0}
              />
              <p className="text-muted-foreground mt-2 text-[11px]">
                Keep it short so it stays readable in budget cards.
              </p>
            </div>

            <div>
              <label
                htmlFor="budget-amount-input"
                className="text-foreground text-sm font-medium"
              >
                Amount
              </label>
              <div className="relative mt-2">
                <Input
                  id="budget-amount-input"
                  type="text"
                  inputMode="numeric"
                  value={amount ? formatVnd(amount) : ""}
                  onChange={(event) =>
                    setAmount(parseVndInput(event.target.value))
                  }
                  placeholder="0"
                  className="h-11 pr-14 text-right text-lg font-semibold"
                />
                <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                  VND
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">
                Use the total amount you plan to spend in this period.
              </p>
            </div>

            <div>
              <label className="text-foreground text-sm font-medium">
                Period
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePeriodChange(option.value)}
                    aria-pressed={period === option.value}
                    className={cn(
                      "h-auto min-h-13 w-full rounded-xl px-2.5 py-2 text-left text-xs font-medium",
                      option.value === "custom"
                        ? "col-span-2 sm:col-span-1"
                        : "",
                      period === option.value
                        ? "bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
                        : "text-muted-foreground bg-muted/35 hover:bg-muted/55"
                    )}
                  >
                    <span className="block leading-none">{option.label}</span>
                    <span
                      className={cn(
                        "mt-1 hidden text-[10px] leading-tight sm:block",
                        period === option.value
                          ? "text-primary-foreground/85"
                          : "text-muted-foreground"
                      )}
                    >
                      {option.hint}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <div className="flex w-full flex-col gap-2">
                  <label
                    htmlFor="budget-start-date-input"
                    className="text-foreground text-sm font-medium"
                  >
                    Start date
                  </label>
                  <Input
                    id="budget-start-date-input"
                    type="date"
                    value={periodStartDate || ""}
                    onChange={(event) =>
                      handleStartDateChange(event.target.value)
                    }
                    className="max-w-auto h-11 w-auto"
                  />
                </div>
                {period === "custom" ? (
                  <div className="flex min-w-0 flex-col gap-2">
                    <label
                      htmlFor="budget-end-date-input"
                      className="text-foreground text-sm font-medium"
                    >
                      End date
                    </label>
                    <Input
                      id="budget-end-date-input"
                      type="date"
                      value={periodEndDate || ""}
                      onChange={(event) =>
                        handleEndDateChange(event.target.value)
                      }
                      className="h-11 w-full max-w-full min-w-0"
                    />
                  </div>
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-3 text-xs",
                  hasValidPeriod ? "text-muted-foreground" : "text-destructive"
                )}
              >
                {periodRangeLabel}
              </p>
            </div>

            {validationMessage ? (
              <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{validationMessage}</p>
              </div>
            ) : null}
          </div>
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-2xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SaveIcon />
              )}
              {isSaving ? "Saving..." : submitLabel}
            </Button>
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
