import dayjs from "@/configs/date";
import { getWeekRange } from "@/lib/week";
import type { BudgetPeriod } from "@/types/budget-weekly";

export const PERIOD_OPTIONS: Array<{
  value: BudgetPeriod;
  label: string;
  hint: string;
}> = [
  { value: "week", label: "Weekly", hint: "Resets every week" },
  { value: "month", label: "Monthly", hint: "Best for fixed bills" },
  { value: "custom", label: "Custom", hint: "Flexible date range" },
];

export const resolvePeriodStart = (
  periodValue: BudgetPeriod,
  dateValue: string
) => {
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

export const formatDatePickerValue = (dateValue: string) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  return parsed.isValid()
    ? parsed.format("DD/MM/YYYY")
    : dayjs().format("DD/MM/YYYY");
};

export const parseDatePickerValue = (dateValue: string) => {
  const parsed = dayjs(dateValue, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : dateValue;
};

export const formatStartDateLabel = (dateValue: string) => {
  const parsed = dayjs(dateValue, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "Pick date";
};
