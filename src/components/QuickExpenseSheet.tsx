"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAutoShrinkFont } from "@/hooks/useAutoShrinkFont";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
import { queries } from "@/lib/queries";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import {
  type TQuickExpenseDraft,
  type TQuickExpensePayload,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plus, UserRound, Wallet, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { useSettingsStore } from "@/components/providers/StoreProvider";

import BudgetPickerSheet from "./BudgetPickerSheet";
import CategoryChipRow from "./CategoryChipRow";
import DatePickerSheet from "./DatePickerSheet";
import PaidByPickerSheet from "./PaidByPickerSheet";
import VndSymbol from "./VndSymbol";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: TQuickExpenseSheetInitialExpense | null;
  recoveryDraft?: TQuickExpenseDraft | null;
  transactionId?: number;
  onSuccess?: () => void;
  showTrigger?: boolean;
};

export type TQuickExpenseSheetInitialExpense = {
  id?: number;
  date: string;
  amount: number;
  note?: string | null;
  category: Category | string;
  budgetId?: number | null;
  paidBy?: PaidBy | string;
};

export type TExpenseDraft = TQuickExpenseDraft;

const SUGGESTION_MULTIPLIERS = [10, 100, 1000];
const ALLOWED_CATEGORIES = Object.values(Category) as Category[];
const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const buildDefaultDraft = (paidBy: PaidBy): TExpenseDraft => ({
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
  budgetId: null,
  paidBy,
});

const normalizePaidBy = (
  value: string | undefined,
  fallback: PaidBy = PaidBy.OTHER
): PaidBy => {
  return (
    ALLOWED_PAID_BY.find((option) => option === value) ??
    ALLOWED_PAID_BY.find((option) => option === fallback) ??
    PaidBy.OTHER
  );
};

const normalizeCategory = (value: string | undefined): Category => {
  return ALLOWED_CATEGORIES.find((option) => option === value) ?? Category.FOOD;
};

const formatDraftDate = (value: string | undefined): string => {
  const displayDate = dayjs(value, "DD/MM/YYYY", true);
  if (displayDate.isValid()) {
    return displayDate.format("DD/MM/YYYY");
  }

  const isoDate = dayjs(value, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("DD/MM/YYYY");
  }

  return dayjs().format("DD/MM/YYYY");
};

const buildDraftFromExpense = (
  initialExpense: TQuickExpenseSheetInitialExpense | null | undefined,
  fallbackPaidBy: PaidBy
): TExpenseDraft => {
  if (!initialExpense) {
    return buildDefaultDraft(fallbackPaidBy);
  }

  const amount = Number(initialExpense.amount);
  return {
    date: formatDraftDate(initialExpense.date),
    amount: Number.isFinite(amount) ? amount : 0,
    note: initialExpense.note ?? "",
    category: normalizeCategory(initialExpense.category),
    budgetId: initialExpense.budgetId ?? null,
    paidBy: normalizePaidBy(initialExpense.paidBy, fallbackPaidBy),
  };
};

const cloneExpenseDraft = (draft: TExpenseDraft): TExpenseDraft => ({
  date: draft.date,
  amount: draft.amount,
  note: draft.note,
  category: draft.category,
  budgetId: draft.budgetId,
  paidBy: draft.paidBy,
});

const buildQuickExpensePayload = (
  draft: TExpenseDraft
): TQuickExpensePayload => ({
  date: draft.date,
  amount: draft.amount,
  note: draft.note,
  category: draft.category,
  paidBy: draft.paidBy,
  budgetId: draft.budgetId,
});

const createOperationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatDateLabel = (date: string) => {
  const parsed = dayjs(date, "DD/MM/YYYY", true);
  if (!parsed.isValid()) {
    return "Today";
  }
  const today = dayjs().startOf("day");
  if (parsed.isSame(today, "day")) {
    return "Today";
  }
  if (parsed.isSame(today.subtract(1, "day"), "day")) {
    return "Yesterday";
  }
  return parsed.format("DD/MM");
};

const QuickExpenseSheet = ({
  compact = false,
  mode = "create",
  open,
  onOpenChange,
  initialExpense = null,
  recoveryDraft = null,
  transactionId,
  showTrigger,
}: TQuickExpenseSheetProps) => {
  const isEditMode = mode === "edit";
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const enqueueRecovery = useQuickExpenseRecoveryStore((state) => state.enqueue);
  const fallbackPaidBy = normalizePaidBy(settingsPaidBy);
  const [internalOpen, setInternalOpen] = useState(false);
  const sheetOpen = open ?? internalOpen;
  const shouldShowTrigger = showTrigger ?? !isEditMode;
  const buildDraftForOpen = () =>
    recoveryDraft
      ? { ...recoveryDraft }
      : isEditMode
        ? buildDraftFromExpense(initialExpense, fallbackPaidBy)
        : buildDefaultDraft(fallbackPaidBy);
  const [draft, setDraft] = useState<TExpenseDraft>(() =>
    buildDraftForOpen()
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [paidByOpen, setPaidByOpen] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const keyboardOffset = useKeyboardOffset();

  const [queueing, setQueueing] = useState(false);

  const canSubmit = draft.amount > 0 && !queueing;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    if (isEditMode && !transactionId) {
      toast.error("Failed to update expense");
      return;
    }

    setQueueing(true);
    const submittedDraft = cloneExpenseDraft(draft);
    const payload = buildQuickExpensePayload(submittedDraft);

    enqueueRecovery({
      operationId: createOperationId(),
      mode,
      transactionId,
      draft: submittedDraft,
      payload,
      status: "queued",
      createdAt: Date.now(),
    });
    handleOpenChange(false);
    setQueueing(false);
  };

  const noteRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const keyboardPrimerRef = useRef<HTMLInputElement>(null);
  useAutoShrinkFont(noteRef, { max: 24, min: 14, step: 1 });

  const primeKeyboard = () => {
    keyboardPrimerRef.current?.focus();
  };

  const setField = <K extends keyof TExpenseDraft>(
    key: K,
    value: TExpenseDraft[K]
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  const handleOpenChange = (next: boolean) => {
    if (typeof open !== "boolean") {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      setAmountFocused(false);
      if (!isEditMode) {
        setDraft(buildDefaultDraft(fallbackPaidBy));
      }
      return;
    }
    setDraft(buildDraftForOpen());
  };

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    if (recoveryDraft) {
      setDraft({ ...recoveryDraft });
      return;
    }
    if (isEditMode) {
      setDraft(buildDraftFromExpense(initialExpense, fallbackPaidBy));
    }
  }, [fallbackPaidBy, initialExpense, isEditMode, recoveryDraft, sheetOpen]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) {
        return;
      }
      setDraft((prev) => ({
        ...prev,
        amount: detail.amount,
        note: detail.note,
        category: detail.category
          ? normalizeCategory(detail.category)
          : prev.category,
      }));
      if (typeof open !== "boolean") {
        setInternalOpen(true);
      }
      onOpenChange?.(true);
    };
    window.addEventListener(EXPENSE_PREFILL_EVENT, handle);
    return () => window.removeEventListener(EXPENSE_PREFILL_EVENT, handle);
  }, [isEditMode, onOpenChange, open]);

  const targetDate = useMemo(() => {
    const parsed = dayjs(draft.date, "DD/MM/YYYY", true);
    const resolved = parsed.isValid() ? parsed : dayjs();
    return resolved.format("YYYY-MM-DD");
  }, [draft.date]);

  const weekStart = useMemo(() => {
    const parsed = dayjs(targetDate, "YYYY-MM-DD", true);
    return getWeekRange(parsed).weekStartDate.format("YYYY-MM-DD");
  }, [targetDate]);

  const budgetOptionsQuery = useQuery({
    ...queries.budgetWeekly.options(weekStart, targetDate),
    enabled: sheetOpen && Boolean(weekStart),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  const selectedBudgetName = useMemo(() => {
    if (draft.budgetId === null) {
      return null;
    }
    return (
      budgetOptionsQuery.data?.find((b) => b.id === draft.budgetId)?.name ??
      "Budget"
    );
  }, [draft.budgetId, budgetOptionsQuery.data]);

  useEffect(() => {
    if (draft.budgetId === null || !budgetOptionsQuery.isSuccess) {
      return;
    }
    if (
      !budgetOptionsQuery.data.some((budget) => budget.id === draft.budgetId)
    ) {
      setDraft((prev) => ({ ...prev, budgetId: null }));
    }
  }, [draft.budgetId, budgetOptionsQuery.data, budgetOptionsQuery.isSuccess]);

  const suggestions = useMemo(() => {
    if (draft.amount <= 0) {
      return [];
    }
    return SUGGESTION_MULTIPLIERS.map((m) => draft.amount * m).filter(
      (v) => v > 0
    );
  }, [draft.amount]);
  const showSuggestions = amountFocused && suggestions.length > 0;
  const anchorSuggestionsToKeyboard = keyboardOffset > 0;

  return (
    <Sheet open={sheetOpen} onOpenChange={handleOpenChange} modal>
      <input
        ref={keyboardPrimerRef}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
      />
      {shouldShowTrigger ? (
        <SheetTrigger asChild>
          <Button
            size={compact ? "icon-lg" : "default"}
            aria-label={compact ? "Add expense" : undefined}
            onPointerDown={primeKeyboard}
            className={cn(
              "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
              compact && "size-12"
            )}
          >
            <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
            {compact ? null : "Add expense"}
          </Button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-full w-full gap-0 rounded-none p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (isEditMode) {
            return;
          }
          noteRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetClose className="ring-offset-background absolute top-4 right-4 z-60 rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-all duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{isEditMode ? "Edit expense" : "Add expense"}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Update expense details and save."
              : "Enter expense details and save."}
          </SheetDescription>
        </SheetHeader>
        <div className="my-auto flex flex-col gap-4 pt-12">
          <div className="grid grid-cols-3 gap-2 px-4">
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
              className={cn(
                "rounded-full",
                draft.budgetId === null &&
                  "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning"
              )}
              aria-label={`Budget: ${draft.budgetId === null ? "No budget" : "Selected"}`}
              onClick={() => setBudgetOpen(true)}
            >
              <Wallet className="h-4 w-4" />
              {selectedBudgetName !== null && (
                <span className="truncate">{selectedBudgetName}</span>
              )}
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

          <div className="flex flex-1 flex-col justify-center gap-4 px-4">
            <div className="flex flex-col gap-2">
              {" "}
              <input
                ref={noteRef}
                value={draft.note}
                onChange={(e) => setField("note", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    amountRef.current?.focus();
                  }
                }}
                placeholder="What did you spend on?"
                className="placeholder:text-muted-foreground w-full overflow-hidden border-0 bg-transparent px-0 py-2 text-2xl whitespace-nowrap focus-visible:ring-0 focus-visible:outline-none"
              />
              <div className="flex items-baseline gap-1">
                <VndSymbol className="text-muted-foreground text-4xl font-semibold tracking-tight" />
                <input
                  ref={amountRef}
                  inputMode="numeric"
                  value={draft.amount === 0 ? "" : formatVnd(draft.amount)}
                  onChange={(e) =>
                    setField("amount", parseVndInput(e.target.value))
                  }
                  placeholder="0"
                  className="flex-1 border-0 bg-transparent px-0 text-left text-4xl font-semibold tracking-tight focus-visible:ring-0 focus-visible:outline-none"
                  onFocus={() => {
                    setAmountFocused(true);
                    amountRef.current?.select();
                  }}
                  onBlur={() => setAmountFocused(false)}
                />
              </div>
            </div>

            {showSuggestions && (
              <div
                role="group"
                aria-label="Amount suggestions"
                className={cn(
                  "no-scrollbar flex gap-2 overflow-x-auto flex-nowrap",
                  anchorSuggestionsToKeyboard &&
                    "fixed inset-x-0 z-60 mx-auto w-full max-w-md justify-start px-4 pt-2 pb-2"
                )}
                style={
                  anchorSuggestionsToKeyboard
                    ? {
                        bottom: `calc(${keyboardOffset}px +  8px)`,
                      }
                    : undefined
                }
              >
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full tabular-nums"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setField("amount", s);
                      setAmountFocused(false);
                      amountRef.current?.blur();
                    }}
                  >
                    {formatVnd(s)}
                  </Button>
                ))}
              </div>
            )}

            <CategoryChipRow
              value={draft.category}
              onChange={(c) => setField("category", c)}
            />
          </div>
        </div>

        <SheetFooter className="standalone:pb-safe px-4">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            {isEditMode ? "Update expense" : "Save expense"}
          </Button>
        </SheetFooter>

        <DatePickerSheet
          open={dateOpen}
          onOpenChange={setDateOpen}
          value={draft.date}
          onChange={(next) => setField("date", next)}
        />

        <BudgetPickerSheet
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          value={draft.budgetId}
          onChange={(id) => setField("budgetId", id)}
          weekStart={weekStart}
          targetDate={targetDate}
          isParentOpen={sheetOpen}
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
