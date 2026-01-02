"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { WheelPicker, WheelPickerWrapper } from "./wheel-picker";

type DatePickerProps = {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  startYear?: number;
  endYear?: number;
  className?: string;
};

type DateParts = {
  day?: number;
  month?: number;
  year?: number;
};

const getDateParts = (date?: Date): DateParts => {
  if (!date) {
    return {};
  }

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

const isCompleteDate = (parts: DateParts) => {
  return Boolean(parts.day && parts.month && parts.year);
};

const clampDay = (parts: DateParts): DateParts => {
  if (!parts.day || !parts.month || !parts.year) {
    return parts;
  }

  const maxDay = getDaysInMonth(parts.year, parts.month);
  if (parts.day <= maxDay) {
    return parts;
  }

  return {
    ...parts,
    day: maxDay,
  };
};

const formatNumber = (number: number) => String(number).padStart(2, "0");

function DatePicker({
  value,
  onChange,
  startYear,
  endYear,
  className,
}: DatePickerProps) {
  const updateSourceRef = React.useRef<"prop" | "user" | null>(null);
  const [parts, setParts] = React.useState<DateParts>(() =>
    getDateParts(value)
  );

  React.useEffect(() => {
    updateSourceRef.current = "prop";
    setParts(getDateParts(value));
  }, [value]);

  React.useEffect(() => {
    if (updateSourceRef.current !== "user") {
      updateSourceRef.current = null;
      return;
    }

    updateSourceRef.current = null;

    if (isCompleteDate(parts)) {
      const nextDate = new Date(
        parts.year as number,
        (parts.month as number) - 1,
        parts.day as number
      );
      onChange?.(nextDate);
    } else {
      onChange?.(undefined);
    }
  }, [onChange, parts]);

  const currentYear = new Date().getFullYear();
  const fromYear = startYear ?? currentYear - 10;
  const toYear = endYear ?? currentYear + 1;
  const [minYear, maxYear] =
    fromYear <= toYear ? [fromYear, toYear] : [toYear, fromYear];

  const monthOptions = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        label: formatNumber(index + 1),
      })),
    []
  );
  const yearOptions = React.useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      years.push({ value: String(year), label: String(year) });
    }
    return years;
  }, [minYear, maxYear]);
  const dayOptions = React.useMemo(() => {
    if (!parts.month || !parts.year) {
      return Array.from({ length: 31 }, (_, index) => ({
        value: String(index + 1),
        label: formatNumber(index + 1),
      }));
    }

    const daysInMonth = getDaysInMonth(parts.year, parts.month);
    return Array.from({ length: daysInMonth }, (_, index) => ({
      value: String(index + 1),
      label: formatNumber(index + 1),
    }));
  }, [parts.month, parts.year]);

  const handlePartsChange = (nextPatch: DateParts) => {
    updateSourceRef.current = "user";
    setParts((prev) => clampDay({ ...prev, ...nextPatch }));
  };

  return (
    <div className={cn("w-full", className)}>
      <WheelPickerWrapper className="w-full">
        <WheelPicker
          value={parts.day ? String(parts.day) : dayOptions[0]?.value}
          onValueChange={(value) => handlePartsChange({ day: Number(value) })}
          options={dayOptions}
          infinite
        />
        <WheelPicker
          infinite
          value={parts.month ? String(parts.month) : monthOptions[0]?.value}
          onValueChange={(value) => handlePartsChange({ month: Number(value) })}
          options={monthOptions}
        />
        <WheelPicker
          value={parts.year ? String(parts.year) : yearOptions[0]?.value}
          onValueChange={(value) => handlePartsChange({ year: Number(value) })}
          options={yearOptions}
        />
      </WheelPickerWrapper>
    </div>
  );
}

export default DatePicker;
