import { useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import {
  type BudgetColorId,
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import {
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
} from "@/lib/mutations";
import { getWeekRange } from "@/lib/week";
import type { BudgetListItem, BudgetPeriod } from "@/types/budget-weekly";
import { toast } from "sonner";

import { resolvePeriodStart } from "./budget-form.helpers";

type UseBudgetFormArgs = {
  budget: BudgetListItem | null;
  weekStartDate: string;
  open: boolean;
};

export const useBudgetForm = ({
  budget,
  weekStartDate,
  open,
}: UseBudgetFormArgs) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState<BudgetPeriod>("week");
  const [periodStartDate, setPeriodStartDate] = useState(weekStartDate);
  const [periodEndDate, setPeriodEndDate] = useState<string | null>(null);
  const [icon, setIcon] = useState(DEFAULT_BUDGET_ICON);
  const [color, setColor] = useState<BudgetColorId>(DEFAULT_BUDGET_COLOR);
  const [isSaving, setIsSaving] = useState(false);

  const createBudgetMutation = useCreateBudgetMutation();
  const updateBudgetMutation = useUpdateBudgetMutation();

  const isEdit = budget !== null;

  // Resync fields each time the drawer opens. Matches the reset-on-open
  // convention used by BudgetTransferDrawer; the parent sets `budget` and
  // `open` together, so depending on these is safe.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (budget) {
      setName(budget.name);
      setAmount(budget.amount);
      setPeriod(budget.period);
      setPeriodStartDate(budget.periodStartDate);
      setPeriodEndDate(budget.periodEndDate ?? null);
      setIcon(normalizeBudgetIcon(budget.icon));
      setColor(normalizeBudgetColor(budget.color));
    } else {
      setName("");
      setAmount(0);
      setPeriod("week");
      setPeriodStartDate(weekStartDate);
      setPeriodEndDate(null);
      setIcon(DEFAULT_BUDGET_ICON);
      setColor(DEFAULT_BUDGET_COLOR);
    }
    setIsSaving(false);
  }, [open, budget, weekStartDate]);

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

  const trimmedName = name.trim();
  const parsedStart = dayjs(periodStartDate, "YYYY-MM-DD", true);
  const parsedEnd = periodEndDate
    ? dayjs(periodEndDate, "YYYY-MM-DD", true)
    : null;
  const hasValidPeriod =
    parsedStart.isValid() &&
    (period !== "custom" ||
      (parsedEnd !== null &&
        parsedEnd.isValid() &&
        !parsedEnd.isBefore(parsedStart, "day")));
  const isValid = trimmedName.length > 0 && amount > 0 && hasValidPeriod;
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
    const { weekStartDate: startDate, weekEndDate } = getWeekRange(start);
    return `${startDate.format("DD MMM YYYY")} - ${weekEndDate.format("DD MMM YYYY")}`;
  }, [period, periodEndDate, periodStartDate]);

  const submit = async (): Promise<boolean> => {
    if (!canSubmit) {
      return false;
    }
    try {
      setIsSaving(true);
      const input = {
        name,
        amount,
        period,
        periodStartDate,
        periodEndDate: period === "custom" ? periodEndDate : null,
        icon,
        color,
      };
      if (budget) {
        await updateBudgetMutation.mutateAsync({ id: budget.id, input });
        toast.success("Budget updated.");
      } else {
        await createBudgetMutation.mutateAsync(input);
        toast.success("Budget created.");
      }
      return true;
    } catch (submitError) {
      console.error(submitError);
      toast.error("Failed to save budget.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    name,
    amount,
    period,
    periodStartDate,
    periodEndDate,
    icon,
    color,
    isSaving,
    isEdit,
    setName,
    setAmount,
    setIcon,
    setColor,
    handlePeriodChange,
    handleStartDateChange,
    handleEndDateChange,
    trimmedName,
    hasValidPeriod,
    isValid,
    canSubmit,
    periodRangeLabel,
    submit,
  };
};
