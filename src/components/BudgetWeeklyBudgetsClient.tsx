"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { Category } from "@/enums";
import {
  useCloneBudgetsToNextPeriodMutation,
  useDeleteBudgetMutation,
} from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import {
  type BudgetAssignedTransaction,
  type BudgetCloneNextPeriodResult,
  type BudgetListItem,
  type BudgetTransactionsResponse,
} from "@/types/budget-weekly";
import {
  type InfiniteData,
  type QueryFunction,
  useInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowDown,
  CopyPlus,
  Loader2,
  Plus,
  SaveIcon,
  Trash2,
  Wallet,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import BudgetBadge from "@/components/BudgetBadge";
import BudgetRemainingChart from "@/components/BudgetRemainingChart";
import BudgetTransferDrawer from "@/components/BudgetTransferDrawer";
import ExpenseItemIcon from "@/components/ExpenseItemIcon";
import PaidByIcon, { getPaidByPalette } from "@/components/PaidByIcon";
import BudgetFormDrawer from "@/components/budget-form/BudgetFormDrawer";

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

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "custom", label: "Custom" },
];

const VIEW_SELECT_TRIGGER_CLASS =
  "bg-secondary hover:bg-surface-3 h-10 w-fit gap-1.5 rounded-full border-0 px-4 text-sm font-semibold shadow-none transition active:scale-[0.97]";

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

const getNextWeekKey = (weekKey: string) =>
  dayjs(weekKey, "YYYY-MM-DD", true).add(7, "day").format("YYYY-MM-DD");

const getNextMonthKey = (monthKey: string) =>
  monthKeyToDate(monthKey).add(1, "month").format("YYYY-MM");

const formatCloneToast = (
  result: BudgetCloneNextPeriodResult,
  targetLabel: "next week" | "next month"
) => {
  if (result.sourceCount === 0) {
    return `No budgets to clone from this ${result.period}.`;
  }

  if (result.createdCount === 0) {
    return `All ${result.sourceCount} budgets already existed ${targetLabel}.`;
  }

  const clonedLabel =
    result.createdCount === 1
      ? "1 budget cloned"
      : `${result.createdCount} budgets cloned`;
  const skippedLabel =
    result.skippedCount > 0 ? ` ${result.skippedCount} already existed.` : "";

  return `${clonedLabel} to ${targetLabel}.${skippedLabel}`;
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

const BudgetWeeklyBudgetsClient = ({
  weekStartDate,
}: BudgetWeeklyBudgetsClientProps) => {
  const {
    data: overview,
    error,
    isError,
    refetch,
  } = useSuspenseQuery({
    ...queries.budgets.overview,
  });

  const budgets = overview.budgets;
  const [activeTab, setActiveTab] = useState<DashboardTab>("week");

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDestination, setTransferDestination] =
    useState<BudgetListItem | null>(null);

  const openTransfer = (budget: BudgetListItem) => {
    setTransferDestination(budget);
    setTransferOpen(true);
  };

  // Target for the form drawer (edit) and the delete-confirm dialog.
  const [editingBudget, setEditingBudget] = useState<BudgetListItem | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [detailBudget, setDetailBudget] = useState<BudgetListItem | null>(null);

  const openBudgetDetail = (budget: BudgetListItem) => {
    setDetailBudget(budget);
    setDetailOpen(true);
  };

  const deleteBudgetMutation = useDeleteBudgetMutation();
  const cloneBudgetMutation = useCloneBudgetsToNextPeriodMutation();

  const currentMonthKey = dayjs().format("YYYY-MM");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey);
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(
    weekStartDate
  );
  const [pendingMonthKeys, setPendingMonthKeys] = useState<string[]>([]);
  const [pendingWeekKeys, setPendingWeekKeys] = useState<string[]>([]);

  const budgetTransactionsQuery = queries.budgets.transactions(
    detailBudget?.id ?? 0,
    {
      limit: DETAIL_PAGE_SIZE,
    }
  );

  const {
    data: transactionPages,
    isPending: transactionsPending,
    isFetching: transactionsFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: transactionError,
  } = useInfiniteQuery<
    BudgetTransactionsResponse,
    Error,
    InfiniteData<BudgetTransactionsResponse>,
    ReturnType<typeof queries.budgets.transactions>["queryKey"],
    number
  >({
    queryKey: budgetTransactionsQuery.queryKey,
    queryFn: budgetTransactionsQuery.queryFn as QueryFunction<
      BudgetTransactionsResponse,
      typeof budgetTransactionsQuery.queryKey,
      number
    >,
    initialPageParam: 0,
    enabled: detailOpen && Boolean(detailBudget),
    staleTime: 30_000,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });

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
    pendingMonthKeys.forEach((key) => keys.add(key));
    keys.add(currentMonthKey);
    return Array.from(keys).sort(
      (a, b) => monthKeyToDate(b).valueOf() - monthKeyToDate(a).valueOf()
    );
  }, [budgets, currentMonthKey, pendingMonthKeys]);

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

    pendingWeekKeys.forEach((key) => {
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
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
  }, [pendingWeekKeys, weeklyBudgets]);

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

  const openCreate = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const openEdit = (budget: BudgetListItem) => {
    setEditingBudget(budget);
    setFormOpen(true);
  };

  const handleCloneWeekly = async () => {
    if (!activeWeekGroup || cloneBudgetMutation.isPending) {
      return;
    }

    const targetWeekKey = getNextWeekKey(activeWeekGroup.key);

    try {
      const result = await cloneBudgetMutation.mutateAsync({
        period: "week",
        sourceStartDate: activeWeekGroup.key,
      });
      setPendingWeekKeys((keys) =>
        keys.includes(targetWeekKey) ? keys : [...keys, targetWeekKey]
      );
      setActiveTab("week");
      setActiveWeekKey(targetWeekKey);
      toast.success(formatCloneToast(result, "next week"));
    } catch (cloneError) {
      console.error(cloneError);
      toast.error("Failed to clone budgets.");
    }
  };

  const handleCloneMonthly = async () => {
    if (!activeMonthKey || cloneBudgetMutation.isPending) {
      return;
    }

    const targetMonthKey = getNextMonthKey(activeMonthKey);

    try {
      const result = await cloneBudgetMutation.mutateAsync({
        period: "month",
        sourceStartDate: monthKeyToDate(activeMonthKey).format("YYYY-MM-DD"),
      });
      setPendingMonthKeys((keys) =>
        keys.includes(targetMonthKey) ? keys : [...keys, targetMonthKey]
      );
      setActiveTab("month");
      setMonthFilter(targetMonthKey);
      toast.success(formatCloneToast(result, "next month"));
    } catch (cloneError) {
      console.error(cloneError);
      toast.error("Failed to clone budgets.");
    }
  };

  const handleDelete = async () => {
    if (!editingBudget) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteBudgetMutation.mutateAsync(editingBudget.id);
      toast.success("Budget deleted.");

      setConfirmOpen(false);
      setFormOpen(false);
      setDetailOpen(false);
      setDetailBudget(null);
      setEditingBudget(null);
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Failed to delete budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderBudgetItem = (budget: BudgetListItem) => {
    const status = getBudgetStatus(budget);

    return (
      <button
        key={budget.id}
        type="button"
        onClick={() => openBudgetDetail(budget)}
        className={cn(
          "group bg-card/80 relative flex flex-col gap-2 rounded-3xl px-4 py-4 text-left shadow-[0_14px_30px_color-mix(in_srgb,var(--background)_42%,transparent)] transition-[transform,box-shadow,background-color] active:scale-[0.99]",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          status.isOver
            ? "bg-destructive/5 hover:bg-destructive/10 shadow-[0_14px_30px_color-mix(in_srgb,var(--destructive)_16%,transparent)]"
            : "hover:bg-card"
        )}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-grow items-center gap-2">
            <BudgetBadge
              icon={budget.icon}
              color={budget.color}
              name={budget.name}
              className="max-w-[68%] px-2.5 py-1"
              nameClassName="text-sm font-semibold sm:text-base"
            />
            <ExpenseItemIcon
              category={budget.category}
              size="sm"
              className="shrink-0"
            />
          </div>
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
  ) => {
    const spentRatio =
      summary.totalBudget > 0
        ? Math.min(Math.max(summary.totalSpent / summary.totalBudget, 0), 1)
        : 0;
    const isOver = summary.totalRemaining < 0;

    return (
      <div className="bg-card/70 rounded-2xl px-4 py-3.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--background)_70%,transparent),0_12px_28px_color-mix(in_srgb,var(--background)_55%,transparent)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-foreground text-sm font-semibold">{title}</h3>
            <p className="text-muted-foreground text-[11px]">{subtitle}</p>
          </div>
          <span className="text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 text-[11px]">
            {summary.count} budgets
          </span>
        </div>

        <div className="mt-3">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Remaining
          </p>
          <p
            className={cn(
              "mt-0.5 text-2xl leading-none font-bold tabular-nums",
              isOver ? "text-destructive" : "text-success"
            )}
          >
            {formatVndSigned(summary.totalRemaining)}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
            {formatVnd(summary.totalSpent)} spent of{" "}
            {formatVnd(summary.totalBudget)}
          </p>
        </div>

        <div className="bg-muted/60 mt-2.5 h-1.5 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
              isOver ? "bg-destructive" : "bg-success"
            )}
            style={{ width: `${Math.round(spentRatio * 100)}%` }}
          />
        </div>
      </div>
    );
  };

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

  const renderCloneAction = ({
    disabled,
    label,
    onClick,
  }: {
    disabled: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className="bg-muted/45 hover:bg-muted/65 h-11 w-full rounded-2xl text-sm font-semibold"
    >
      {cloneBudgetMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CopyPlus className="h-4 w-4" />
      )}
      {label}
    </Button>
  );

  const errorMessage =
    error instanceof Error ? error.message : "Failed to load budgets.";
  const showErrorFallback = isError;

  return (
    <section className="relative flex flex-col">
      <div className="app-header-blur sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-foreground text-2xl leading-none font-bold">
            Budgets
          </h1>
          <Button
            onClick={openCreate}
            variant="ghost"
            size="icon"
            aria-label="Add budget"
            className="text-primary hover:text-primary size-12 rounded-full bg-white/10 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_18%,transparent),0_10px_24px_color-mix(in_srgb,#000000_45%,transparent)] active:scale-[0.97]"
          >
            <Wallet className="size-5" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Select
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as DashboardTab)}
          >
            <SelectTrigger
              aria-label="Budget dashboard view"
              className={VIEW_SELECT_TRIGGER_CLASS}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-2xl shadow-xl">
              {DASHBOARD_TABS.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab === "month" ? (
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger
                aria-label="Select month"
                className={VIEW_SELECT_TRIGGER_CLASS}
              >
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-2xl shadow-xl">
                {monthOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {activeTab === "week" && weeklyGroups.length ? (
            <Select
              value={activeWeekKey ?? undefined}
              onValueChange={setActiveWeekKey}
            >
              <SelectTrigger
                aria-label="Select week"
                className={VIEW_SELECT_TRIGGER_CLASS}
              >
                <SelectValue placeholder="Week" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-2xl shadow-xl">
                {weeklyGroups.map((group) => (
                  <SelectItem key={group.key} value={group.key}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <div className="standalone:pb-[calc(env(safe-area-inset-bottom))] space-y-4">
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

        {!showErrorFallback ? (
          <>
            {activeTab === "month" ? (
              <div className="space-y-2.5">
                <BudgetRemainingChart
                  budgets={filteredMonthlyBudgets}
                  onSelect={openBudgetDetail}
                />

                {renderSectionSummary(
                  monthSummary,
                  "Month summary",
                  activeMonthKey
                    ? formatMonthLabel(activeMonthKey, "MMMM YYYY")
                    : "All months"
                )}

                {activeMonthKey
                  ? renderCloneAction({
                      disabled:
                        cloneBudgetMutation.isPending ||
                        filteredMonthlyBudgets.length === 0,
                      label: "Clone to next month",
                      onClick: handleCloneMonthly,
                    })
                  : null}

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
                    <BudgetRemainingChart
                      budgets={activeWeekGroup?.budgets ?? []}
                      onSelect={openBudgetDetail}
                    />

                    {activeWeekGroup
                      ? renderSectionSummary(
                          activeWeekGroup.summary,
                          "Weekly summary",
                          activeWeekGroup.label
                        )
                      : null}

                    {activeWeekGroup
                      ? renderCloneAction({
                          disabled:
                            cloneBudgetMutation.isPending ||
                            activeWeekGroup.budgets.length === 0,
                          label: "Clone to next week",
                          onClick: handleCloneWeekly,
                        })
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
                <BudgetRemainingChart
                  budgets={sortedCustomBudgets}
                  onSelect={openBudgetDetail}
                />

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
            <DrawerTitle>
              {detailBudget ? (
                <BudgetBadge
                  icon={detailBudget.icon}
                  color={detailBudget.color}
                  name={detailBudget.name}
                  className="max-w-full"
                />
              ) : (
                "Budget detail"
              )}
            </DrawerTitle>
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
                                <PaidByIcon
                                  paidBy={transaction.paidBy}
                                  size="sm"
                                />
                                <span className="pr-1">
                                  {transaction.paidBy}
                                </span>
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
              className="bg-muted/40 h-11 rounded-2xl"
              onClick={() => {
                if (!detailBudget) {
                  return;
                }
                setDetailOpen(false);
                openTransfer(detailBudget);
              }}
            >
              <ArrowDown className="h-4 w-4" />
              Move funds
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive bg-destructive/12 h-11 rounded-2xl"
              onClick={() => {
                if (!detailBudget) {
                  return;
                }
                setEditingBudget(detailBudget);
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

      <BudgetFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editingBudget}
        weekStartDate={weekStartDate}
        onMoveFunds={(budget) => {
          setFormOpen(false);
          openTransfer(budget);
        }}
      />

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

      {transferDestination ? (
        <BudgetTransferDrawer
          open={transferOpen}
          onOpenChange={setTransferOpen}
          destination={transferDestination}
        />
      ) : null}
    </section>
  );
};

export default BudgetWeeklyBudgetsClient;
