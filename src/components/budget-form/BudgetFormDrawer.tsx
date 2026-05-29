"use client";

import React, { useRef, useState } from "react";

import { normalizeBudgetIcon } from "@/lib/budget-appearance";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";
import { Calendar, Loader2, SaveIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import BudgetBadge from "@/components/BudgetBadge";
import BudgetColorList from "@/components/BudgetColorList";
import BudgetEmojiPickerSheet from "@/components/BudgetEmojiPickerSheet";
import CategoryChipRow from "@/components/CategoryChipRow";
import DatePickerSheet from "@/components/DatePickerSheet";
import VndSymbol from "@/components/VndSymbol";

import {
  PERIOD_OPTIONS,
  formatDatePickerValue,
  formatStartDateLabel,
  parseDatePickerValue,
} from "./budget-form.helpers";
import { useBudgetForm } from "./useBudgetForm";

type BudgetFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetListItem | null;
  weekStartDate: string;
  onMoveFunds: (budget: BudgetListItem) => void;
};

const BudgetFormDrawer = ({
  open,
  onOpenChange,
  budget,
  weekStartDate,
  onMoveFunds,
}: BudgetFormDrawerProps) => {
  const amountRef = useRef<HTMLInputElement>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const form = useBudgetForm({ budget, weekStartDate, open });

  const title = form.isEdit ? "Edit budget" : "New budget";
  const submitLabel = form.isEdit ? "Save changes" : "Create budget";
  const description = form.isEdit
    ? "Adjust the limit and schedule for this budget."
    : "Set a spending cap and period to track this category.";

  const handleSubmit = async () => {
    const saved = await form.submit();
    if (saved) {
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent hideIndicator className="rounded-t-3xl! border-t-0!">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-2xl">{title}</DrawerTitle>
            <DrawerClose className="quick-expense-enter-group quick-expense-enter-delay-1 ring-offset-background absolute top-4 right-4 z-60 rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="no-scrollbar flex max-h-[98svh] flex-col gap-4 overflow-x-hidden overflow-y-auto pb-4">
          <div className="flex items-center justify-between gap-2 px-4">
            <input
              id="budget-name-input"
              aria-label="Budget name"
              value={form.name}
              onChange={(event) => form.setName(event.target.value)}
              placeholder="Budget name"
              maxLength={36}
              className="placeholder:text-muted-foreground inline-flex min-h-12 w-full overflow-hidden border-none bg-transparent px-0 py-2 text-xl font-semibold whitespace-nowrap focus-visible:ring-0 focus-visible:outline-none"
              tabIndex={0}
            />
            <BudgetEmojiPickerSheet
              value={form.icon}
              color={form.color}
              onSelect={(nextIcon) =>
                form.setIcon(normalizeBudgetIcon(nextIcon))
              }
            />
            <BudgetBadge
              icon={form.icon}
              color={form.color}
              name={form.trimmedName || "Budget"}
              className="h-8 shrink-0"
            />
          </div>

          <div>
            <BudgetColorList value={form.color} onChange={form.setColor} />
          </div>

          <CategoryChipRow value={form.category} onChange={form.setCategory} />

          <div className="px-4">
            <label htmlFor="budget-amount-input" className="sr-only">
              Amount
            </label>
            <div className="flex items-baseline gap-1 py-1">
              <VndSymbol className="text-muted-foreground text-4xl font-semibold tracking-tight" />
              <input
                ref={amountRef}
                id="budget-amount-input"
                inputMode="numeric"
                value={form.amount ? formatVnd(form.amount) : ""}
                onChange={(event) =>
                  form.setAmount(parseVndInput(event.target.value))
                }
                placeholder="0"
                className="flex-1 border-0 bg-transparent px-0 text-left text-4xl font-semibold tracking-tight focus-visible:ring-0 focus-visible:outline-none"
                onFocus={() => {
                  amountRef.current?.select();
                }}
              />
            </div>
            {budget ? (
              <button
                type="button"
                className="text-primary mt-2 text-[11px] font-medium underline-offset-2 hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  onMoveFunds(budget);
                }}
              >
                Move from another budget →
              </button>
            ) : null}
          </div>

          <div className="px-4">
            <label className="text-foreground text-sm font-medium">
              Period
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => form.handlePeriodChange(option.value)}
                  aria-pressed={form.period === option.value}
                  className={cn(
                    "h-9 w-full rounded-full px-3 text-xs font-medium",
                    form.period === option.value
                      ? "bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
                      : "text-muted-foreground bg-muted/35 hover:bg-muted/55"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="px-4">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="flex w-full flex-col gap-2">
                <span className="text-foreground text-sm font-medium">
                  Start date
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start rounded-xl px-3 text-sm font-medium"
                  aria-label={`Start date: ${formatStartDateLabel(form.periodStartDate)}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setStartDateOpen(true);
                  }}
                  onClick={() => setStartDateOpen(true)}
                >
                  <Calendar className="h-4 w-4" />
                  <span>{formatStartDateLabel(form.periodStartDate)}</span>
                </Button>
              </div>
              {form.period === "custom" ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-foreground text-sm font-medium">
                    End date
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 justify-start rounded-xl px-3 text-sm font-medium"
                    aria-label={`End date: ${formatStartDateLabel(form.periodEndDate ?? form.periodStartDate)}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setEndDateOpen(true);
                    }}
                    onClick={() => setEndDateOpen(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatStartDateLabel(
                        form.periodEndDate ?? form.periodStartDate
                      )}
                    </span>
                  </Button>
                </div>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-3 text-xs",
                form.hasValidPeriod
                  ? "text-muted-foreground"
                  : "text-destructive"
              )}
            >
              {form.periodRangeLabel}
            </p>
          </div>
        </div>
        <DrawerFooter className="border-border/45 gap-2 border-t">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!form.canSubmit}
            className="h-11 rounded-2xl"
          >
            {form.isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon />
            )}
            {form.isSaving ? "Saving..." : submitLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
      <DatePickerSheet
        open={startDateOpen}
        onOpenChange={setStartDateOpen}
        value={formatDatePickerValue(form.periodStartDate)}
        onChange={(nextDate) =>
          form.handleStartDateChange(parseDatePickerValue(nextDate))
        }
        title="Start date"
        description="Pick the budget start date."
      />
      <DatePickerSheet
        open={endDateOpen}
        onOpenChange={setEndDateOpen}
        value={formatDatePickerValue(
          form.periodEndDate ?? form.periodStartDate
        )}
        onChange={(nextDate) =>
          form.handleEndDateChange(parseDatePickerValue(nextDate))
        }
        title="End date"
        description="Pick the budget end date."
      />
    </Drawer>
  );
};

export default BudgetFormDrawer;
