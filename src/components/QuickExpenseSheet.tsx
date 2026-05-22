"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import { createExpenseEntry } from "@/app/actions/expense-actions";
import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAutoShrinkFont } from "@/hooks/useAutoShrinkFont";
import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { Calendar, Loader2, Plus, UserRound, Wallet } from "lucide-react";

import { useSettingsStore } from "@/components/providers/StoreProvider";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import BudgetPickerSheet from "./BudgetPickerSheet";
import ExpenseItemIcon from "./ExpenseItemIcon";
import PaidByPickerSheet from "./PaidByPickerSheet";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
};

type TExpenseDraft = {
  date: string;
  amount: number;
  note: string;
  category: Category;
  budgetId: number | null;
  paidBy: PaidBy;
};

const SUGGESTION_MULTIPLIERS = [10, 100, 1000];

const buildDefaultDraft = (paidBy: PaidBy): TExpenseDraft => ({
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
  budgetId: null,
  paidBy,
});

const normalizePaidBy = (value: string | undefined): PaidBy => {
  const allowed: PaidBy[] = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];
  return allowed.find((option) => option === value) ?? PaidBy.OTHER;
};

const formatDateLabel = (date: string) => {
  const parsed = dayjs(date, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("DD MMM") : "Today";
};

const QuickExpenseSheet = ({ compact = false }: TQuickExpenseSheetProps) => {
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TExpenseDraft>(() =>
    buildDefaultDraft(normalizePaidBy(settingsPaidBy))
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [paidByOpen, setPaidByOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) return;
      setDraft((prev) => ({
        ...prev,
        amount: detail.amount,
        note: detail.note,
        category: (detail.category as Category) || prev.category,
      }));
      setOpen(true);
    };
    window.addEventListener(EXPENSE_PREFILL_EVENT, handle);
    return () => window.removeEventListener(EXPENSE_PREFILL_EVENT, handle);
  }, []);

  const canSubmit = draft.amount > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      await createExpenseEntry({
        date: draft.date,
        amount: draft.amount,
        note: draft.note,
        category: draft.category,
        paidBy: draft.paidBy,
        budgetId: draft.budgetId,
      });
      toast.success("Expense added");
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  const noteRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  useAutoShrinkFont(noteRef);

  const setField = <K extends keyof TExpenseDraft>(key: K, value: TExpenseDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setDraft(buildDefaultDraft(normalizePaidBy(settingsPaidBy)));
    }
  };

  const targetDate = useMemo(() => {
    const parsed = dayjs(draft.date, "DD/MM/YYYY", true);
    const resolved = parsed.isValid() ? parsed : dayjs();
    return resolved.format("YYYY-MM-DD");
  }, [draft.date]);

  const weekStart = useMemo(() => {
    const parsed = dayjs(targetDate, "YYYY-MM-DD", true);
    return getWeekRange(parsed).weekStartDate.format("YYYY-MM-DD");
  }, [targetDate]);

  const suggestions = useMemo(() => {
    if (draft.amount <= 0) {
      return [];
    }
    return SUGGESTION_MULTIPLIERS.map((m) => draft.amount * m).filter((v) => v > 0);
  }, [draft.amount]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-full w-full gap-0 rounded-none p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Add expense</SheetTitle>
          <SheetDescription>Enter expense details and save.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Date: ${formatDateLabel(draft.date)}`}
              onClick={() => setDateOpen(true)}
            >
              <Calendar className="h-4 w-4" />
              <span>{formatDateLabel(draft.date)}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Budget: ${draft.budgetId === null ? "No budget" : "Selected"}`}
              onClick={() => setBudgetOpen(true)}
            >
              <Wallet className="h-4 w-4" />
              <span>{draft.budgetId === null ? "No budget" : "Budget"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-label={`Paid by: ${draft.paidBy}`}
              onClick={() => setPaidByOpen(true)}
            >
              <UserRound className="h-4 w-4" />
              <span>{draft.paidBy}</span>
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
            <input
              ref={noteRef}
              autoFocus
              value={draft.note}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="What did you spend on?"
              className="w-full whitespace-nowrap overflow-hidden border-0 bg-transparent px-0 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
            />

            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground text-2xl font-medium">đ</span>
              <input
                ref={amountRef}
                inputMode="numeric"
                value={draft.amount === 0 ? "" : formatVnd(draft.amount)}
                onChange={(e) => setField("amount", parseVndInput(e.target.value))}
                placeholder="0"
                className="flex-1 border-0 bg-transparent px-0 text-left text-4xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-0"
                onFocus={() => amountRef.current?.select()}
              />
            </div>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setField("amount", s)}
                  >
                    {formatVnd(s)}
                  </Button>
                ))}
              </div>
            )}

            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pt-1">
              {Object.values(Category).map((category) => {
                const isActive = draft.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setField("category", category as Category)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
                      isActive
                        ? "border-foreground/20 bg-muted -translate-y-1"
                        : "bg-muted/50 hover:bg-muted border-transparent"
                    )}
                  >
                    <ExpenseItemIcon category={category as Category} size="sm" />
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="standalone:pb-safe border-t px-4">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save expense"
            )}
          </Button>
        </SheetFooter>

        <Sheet open={dateOpen} onOpenChange={setDateOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
            <SheetHeader className="text-left">
              <SheetTitle>Date</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 sm:px-6">
              <DatePicker
                value={dayjs(draft.date, "DD/MM/YYYY", true).toDate()}
                onChange={(d) => {
                  if (d) {
                    setField("date", dayjs(d).format("DD/MM/YYYY"));
                  }
                  setDateOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <BudgetPickerSheet
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          value={draft.budgetId}
          onChange={(id) => setField("budgetId", id)}
          weekStart={weekStart}
          targetDate={targetDate}
          isParentOpen={open}
        />

        <PaidByPickerSheet
          open={paidByOpen}
          onOpenChange={setPaidByOpen}
          value={draft.paidBy}
          onChange={(next) => setField("paidBy", next)}
        />
      </SheetContent>
    </Sheet>
  );
};

export default QuickExpenseSheet;
