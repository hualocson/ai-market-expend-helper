"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAutoShrinkFont } from "@/hooks/useAutoShrinkFont";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import type { SuggestBudgetCandidate } from "@/lib/ai/suggest-budget-contract";
import type { BudgetColorId } from "@/lib/budget-appearance";
import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
import {
  useCreateExpenseMutation,
  useSuggestBudgetMutation,
  useUpdateExpenseMutation,
} from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import {
  type TQuickExpenseDraft,
  type TQuickExpensePayload,
  useQuickExpenseRecoveryStore,
} from "@/stores/quick-expense-recovery-store";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  NotebookIcon,
  Plus,
  Trash2,
  UserRound,
  XIcon,
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

import BudgetChipRow from "./BudgetChipRow";
import CategoryChipRow from "./CategoryChipRow";
import DatePickerSheet from "./DatePickerSheet";
import ExpenseItemIcon from "./ExpenseItemIcon";
import PaidByPickerSheet from "./PaidByPickerSheet";
import VndSymbol from "./VndSymbol";

export type TQuickExpenseSheetProps = {
  compact?: boolean;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: TQuickExpenseSheetInitialExpense | null;
  recoveryDraft?: TQuickExpenseDraft | null;
  recoveryOperationId?: string;
  transactionId?: number;
  onSuccess?: () => void;
  onConfirmDelete?: () => void | Promise<void>;
  showTrigger?: boolean;
};

export type TQuickExpenseSheetInitialExpense = {
  id?: number;
  clientId?: string;
  date: string;
  amount: number;
  note?: string | null;
  category: Category | string;
  budgetId?: number | null;
  budgetName?: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
  paidBy?: PaidBy | string;
};

export type TExpenseDraft = TQuickExpenseDraft;
type TRestorableInputFocus = "note" | "amount" | null;
type BudgetSelectionSource = "none" | "manual" | "ai";

const SUGGESTION_MULTIPLIERS = [10, 100, 1000];
const ALLOWED_CATEGORIES = Object.values(Category) as Category[];
const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const buildDefaultDraft = (paidBy: PaidBy): TExpenseDraft => ({
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
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
    clientId: initialExpense.clientId,
    date: formatDraftDate(initialExpense.date),
    amount: Number.isFinite(amount) ? amount : 0,
    note: initialExpense.note ?? "",
    category: normalizeCategory(initialExpense.category),
    budgetId: initialExpense.budgetId ?? null,
    budgetName: initialExpense.budgetName ?? null,
    budgetIcon: initialExpense.budgetIcon ?? null,
    budgetColor: initialExpense.budgetColor ?? null,
    paidBy: normalizePaidBy(initialExpense.paidBy, fallbackPaidBy),
  };
};

const cloneExpenseDraft = (draft: TExpenseDraft): TExpenseDraft => ({
  clientId: draft.clientId,
  date: draft.date,
  amount: draft.amount,
  note: draft.note,
  category: draft.category,
  budgetId: draft.budgetId,
  budgetName: draft.budgetName,
  budgetIcon: draft.budgetIcon ?? null,
  budgetColor: draft.budgetColor ?? null,
  paidBy: draft.paidBy,
});

const buildQuickExpensePayload = (
  draft: TExpenseDraft
): TQuickExpensePayload => ({
  clientId: draft.clientId,
  date: normalizeSubmittedDate(draft.date),
  amount: draft.amount,
  note: draft.note,
  category: draft.category,
  paidBy: draft.paidBy,
  budgetId: draft.budgetId,
  budgetName: draft.budgetName,
  budgetIcon: draft.budgetIcon ?? null,
  budgetColor: draft.budgetColor ?? null,
});

const normalizeSubmittedDate = (value: string): string => {
  const displayDate = dayjs(value, "DD/MM/YYYY", true);
  if (displayDate.isValid()) {
    return displayDate.format("YYYY-MM-DD");
  }

  const isoDate = dayjs(value, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("YYYY-MM-DD");
  }

  return dayjs().format("YYYY-MM-DD");
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
  recoveryOperationId,
  transactionId,
  onConfirmDelete,
  showTrigger,
}: TQuickExpenseSheetProps) => {
  const isEditMode = mode === "edit";
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const clearRecovery = useQuickExpenseRecoveryStore((state) => state.clear);
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const { mutateAsync: updateExpense } = useUpdateExpenseMutation();
  const { mutateAsync: suggestBudgetMutateAsync } = useSuggestBudgetMutation();
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
  const [draft, setDraft] = useState<TExpenseDraft>(() => buildDraftForOpen());
  const [dateOpen, setDateOpen] = useState(false);
  const [paidByOpen, setPaidByOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const keyboardOffset = useKeyboardOffset();

  const [queueing, setQueueing] = useState(false);

  const canSubmit = draft.amount > 0 && !queueing;
  const noteRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const sheetOpenRef = useRef(sheetOpen);
  const pendingDrawerFocusRestoreRef = useRef<TRestorableInputFocus>(null);
  const budgetSelectionSourceRef = useRef<BudgetSelectionSource>(
    recoveryDraft || isEditMode ? "manual" : "none"
  );
  const currentNoteRef = useRef(draft.note);
  const currentSuggestionCandidateKeyRef = useRef("");
  const lastSuggestionSnapshotRef = useRef<string | null>(null);
  const suggestionRequestIdRef = useRef(0);
  const previousControlledOpenRef = useRef(open);
  sheetOpenRef.current = sheetOpen;
  currentNoteRef.current = draft.note;
  useAutoShrinkFont(noteRef, { max: 24, min: 14, step: 1 });

  const getOpenBudgetSelectionSource = (): BudgetSelectionSource =>
    recoveryDraft || isEditMode ? "manual" : "none";

  const resetSuggestionTracking = (
    nextDraft: TExpenseDraft,
    source: BudgetSelectionSource
  ) => {
    budgetSelectionSourceRef.current = source;
    currentNoteRef.current = nextDraft.note;
    lastSuggestionSnapshotRef.current = null;
    suggestionRequestIdRef.current += 1;
  };

  const handleOpenChange = (next: boolean) => {
    if (typeof open !== "boolean") {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      pendingDrawerFocusRestoreRef.current = null;
      setAmountFocused(false);
      setDeleteConfirmOpen(false);
      if (!isEditMode) {
        const nextDraft = buildDefaultDraft(fallbackPaidBy);
        setDraft(nextDraft);
        resetSuggestionTracking(nextDraft, "none");
      }
      return;
    }
    const nextDraft = buildDraftForOpen();
    setDraft(nextDraft);
    resetSuggestionTracking(nextDraft, getOpenBudgetSelectionSource());
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

  const budgetOptionsQuery = useQuery({
    ...queries.budgetWeekly.options(weekStart, targetDate),
    enabled: sheetOpen && Boolean(weekStart),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  const budgetOptions = budgetOptionsQuery.data ?? [];
  const suggestionCandidates = useMemo<SuggestBudgetCandidate[]>(
    () =>
      budgetOptions.map((budget) => ({
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent: budget.spent,
        remaining: budget.remaining,
        period: budget.period,
        periodStartDate: budget.periodStartDate ?? undefined,
        periodEndDate: budget.periodEndDate,
      })),
    [budgetOptions]
  );
  const suggestionCandidateKey = useMemo(
    () =>
      JSON.stringify(
        suggestionCandidates.map((budget) => ({
          id: budget.id,
          name: budget.name,
          amount: budget.amount,
          spent: budget.spent,
          remaining: budget.remaining,
          period: budget.period,
          periodStartDate: budget.periodStartDate ?? null,
          periodEndDate: budget.periodEndDate ?? null,
        }))
      ),
    [suggestionCandidates]
  );
  currentSuggestionCandidateKeyRef.current = suggestionCandidateKey;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    if (isEditMode && !transactionId) {
      toast.error("Failed to update expense");
      return;
    }

    setQueueing(true);
    const selectedBudget =
      draft.budgetId === null
        ? null
        : (budgetOptions.find((budget) => budget.id === draft.budgetId) ??
          null);
    const submittedDraft = cloneExpenseDraft({
      ...draft,
      budgetName:
        draft.budgetId === null
          ? null
          : (selectedBudget?.name ?? draft.budgetName ?? null),
      budgetIcon:
        draft.budgetId === null
          ? null
          : (selectedBudget?.icon ?? draft.budgetIcon ?? null),
      budgetColor:
        draft.budgetId === null
          ? null
          : (selectedBudget?.color ?? draft.budgetColor ?? null),
    });
    const payload = buildQuickExpensePayload(submittedDraft);
    const submittedTransactionId = transactionId;

    try {
      const localWrite = isEditMode
        ? typeof submittedTransactionId === "number"
          ? updateExpense({
              id: submittedTransactionId,
              input: payload,
            })
          : Promise.reject(new Error("Failed to update expense"))
        : createExpense(payload);

      if (recoveryOperationId) {
        clearRecovery(recoveryOperationId);
      }
      handleOpenChange(false);

      void localWrite
        .catch(() => {
          toast.error(
            isEditMode ? "Failed to update expense" : "Failed to add expense"
          );
        })
        .finally(() => {
          setQueueing(false);
        });
    } catch {
      toast.error(
        isEditMode ? "Failed to update expense" : "Failed to add expense"
      );
      setQueueing(false);
    }
  };

  const setField = <K extends keyof TExpenseDraft>(
    key: K,
    value: TExpenseDraft[K]
  ) => {
    if (key === "note") {
      currentNoteRef.current = String(value);
    }
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleDrawerTriggerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    openDrawer: () => void
  ) => {
    event.preventDefault();
    const activeElement = document.activeElement;
    const inputToRestore =
      activeElement === noteRef.current
        ? "note"
        : activeElement === amountRef.current
          ? "amount"
          : null;
    pendingDrawerFocusRestoreRef.current = inputToRestore;
    if (inputToRestore !== null && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    openDrawer();
  };

  const restoreDrawerInputFocus = () => {
    const inputToRestore = pendingDrawerFocusRestoreRef.current;
    pendingDrawerFocusRestoreRef.current = null;
    if (inputToRestore === null) {
      return;
    }

    if (!sheetOpenRef.current) {
      return;
    }
    if (inputToRestore === "note") {
      noteRef.current?.focus({ preventScroll: true });
      return;
    }
    amountRef.current?.focus({ preventScroll: true });
  };

  const handlePickerCloseAutoFocus: React.ComponentProps<
    typeof SheetContent
  >["onCloseAutoFocus"] = (event) => {
    if (pendingDrawerFocusRestoreRef.current === null) {
      return;
    }
    event.preventDefault();
    restoreDrawerInputFocus();
  };

  const handleDateOpenChange = (next: boolean) => {
    setDateOpen(next);
  };

  const handlePaidByOpenChange = (next: boolean) => {
    setPaidByOpen(next);
  };

  const handleConfirmDelete = () => {
    if (!onConfirmDelete) {
      return;
    }

    void onConfirmDelete();
    setDeleteConfirmOpen(false);
    handleOpenChange(false);
  };

  useEffect(() => {
    const previousControlledOpen = previousControlledOpenRef.current;
    previousControlledOpenRef.current = open;
    if (
      typeof open !== "boolean" ||
      !open ||
      previousControlledOpen === open ||
      recoveryDraft ||
      isEditMode
    ) {
      return;
    }

    const nextDraft = buildDefaultDraft(fallbackPaidBy);
    setDraft(nextDraft);
    resetSuggestionTracking(nextDraft, "none");
  }, [fallbackPaidBy, isEditMode, open, recoveryDraft]);

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    if (recoveryDraft) {
      const nextDraft = { ...recoveryDraft };
      setDraft(nextDraft);
      resetSuggestionTracking(nextDraft, "manual");
      return;
    }
    if (isEditMode) {
      const nextDraft = buildDraftFromExpense(initialExpense, fallbackPaidBy);
      setDraft(nextDraft);
      resetSuggestionTracking(nextDraft, "manual");
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
      setDraft((prev) => {
        const nextDraft = {
          ...prev,
          amount: detail.amount,
          note: detail.note,
          category: detail.category
            ? normalizeCategory(detail.category)
            : prev.category,
        };
        resetSuggestionTracking(nextDraft, "none");
        return nextDraft;
      });
      if (typeof open !== "boolean") {
        setInternalOpen(true);
      }
      onOpenChange?.(true);
    };
    window.addEventListener(EXPENSE_PREFILL_EVENT, handle);
    return () => window.removeEventListener(EXPENSE_PREFILL_EVENT, handle);
  }, [isEditMode, onOpenChange, open]);

  useEffect(() => {
    if (draft.budgetId === null || !budgetOptionsQuery.isSuccess) {
      return;
    }
    if (!budgetOptions.some((budget) => budget.id === draft.budgetId)) {
      setDraft((prev) => ({
        ...prev,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      }));
      if (budgetSelectionSourceRef.current === "ai") {
        budgetSelectionSourceRef.current = "none";
      }
    }
  }, [draft.budgetId, budgetOptions, budgetOptionsQuery.isSuccess]);

  const applySuggestedBudget = (suggestedBudgetId: number) => {
    const selected = budgetOptions.find(
      (budget) => budget.id === suggestedBudgetId
    );
    if (!selected) {
      return;
    }

    setDraft((prev) => ({
      ...prev,
      budgetId: selected.id,
      budgetName: selected.name ?? null,
      budgetIcon: selected.icon ?? null,
      budgetColor: selected.color ?? null,
    }));
    budgetSelectionSourceRef.current = "ai";
  };

  const handleNoteBlur = async () => {
    if (!sheetOpen || !budgetOptionsQuery.isSuccess) {
      return;
    }

    const note = draft.note.trim();
    if (note.length < 3) {
      return;
    }
    if (!suggestionCandidates.length) {
      return;
    }

    const requestCandidateKey = suggestionCandidateKey;
    const requestSnapshotKey = `${note}\n${requestCandidateKey}`;
    if (lastSuggestionSnapshotRef.current === requestSnapshotKey) {
      return;
    }

    lastSuggestionSnapshotRef.current = requestSnapshotKey;
    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;

    try {
      const result = await suggestBudgetMutateAsync({
        note,
        budgets: suggestionCandidates,
      });

      if (requestId !== suggestionRequestIdRef.current) {
        return;
      }
      if (!sheetOpenRef.current) {
        return;
      }
      if (currentNoteRef.current.trim() !== note) {
        return;
      }
      if (currentSuggestionCandidateKeyRef.current !== requestCandidateKey) {
        return;
      }
      if (budgetSelectionSourceRef.current === "manual") {
        return;
      }
      if (result.status !== "success" || result.confidence === "low") {
        return;
      }

      applySuggestedBudget(result.budgetId);
    } catch (error) {
      console.error("Failed to suggest budget", error);
    }
  };

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
      {shouldShowTrigger ? (
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
      ) : null}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName="quick-expense-sheet-overlay"
        className="quick-expense-sheet-morph h-full w-full gap-0 rounded-none p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (isEditMode) {
            return;
          }
          noteRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetClose className="quick-expense-enter-group quick-expense-enter-delay-1 ring-offset-background absolute top-4 right-4 z-60 rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
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
        <div className="mt-20 flex flex-col gap-4">
          <div className="quick-expense-enter-group quick-expense-enter-delay-1 grid grid-cols-2 gap-2 px-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-none"
              aria-label={`Date: ${formatDateLabel(draft.date)}`}
              onPointerDown={(event) =>
                handleDrawerTriggerPointerDown(event, () => setDateOpen(true))
              }
              onClick={() => setDateOpen(true)}
            >
              <Calendar className="h-4 w-4" />
              <span>{formatDateLabel(draft.date)}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-none"
              aria-label={`Paid by: ${draft.paidBy}`}
              onPointerDown={(event) =>
                handleDrawerTriggerPointerDown(event, () => setPaidByOpen(true))
              }
              onClick={() => setPaidByOpen(true)}
            >
              <UserRound className="h-4 w-4" />
              <span>{draft.paidBy}</span>
            </Button>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="quick-expense-enter-group quick-expense-enter-delay-2 flex flex-col gap-2 px-4">
              <input
                ref={noteRef}
                value={draft.note}
                onChange={(e) => setField("note", e.target.value)}
                onBlur={handleNoteBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    amountRef.current?.focus({
                      preventScroll: true,
                    });
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
                  "no-scrollbar flex flex-nowrap gap-2 overflow-x-auto",
                  anchorSuggestionsToKeyboard &&
                    "fixed inset-x-0 z-60 mx-auto w-full max-w-md justify-start px-4 pt-2 pb-2"
                )}
                style={
                  anchorSuggestionsToKeyboard
                    ? {
                        bottom: `calc(${keyboardOffset}px + 8px)`,
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
                    }}
                  >
                    {formatVnd(s)}
                  </Button>
                ))}
              </div>
            )}

            <div className="quick-expense-enter-group quick-expense-enter-delay-3 flex flex-col gap-2">
              <BudgetChipRow
                value={draft.budgetId}
                options={budgetOptions}
                selectedBudget={
                  draft.budgetId === null
                    ? null
                    : {
                        id: draft.budgetId,
                        name: draft.budgetName,
                        icon: draft.budgetIcon,
                        color: draft.budgetColor,
                      }
                }
                loading={budgetOptionsQuery.isPending}
                onChange={(id) => {
                  const selected = budgetOptions.find(
                    (budget) => budget.id === id
                  );
                  budgetSelectionSourceRef.current = "manual";
                  setDraft((prev) => ({
                    ...prev,
                    budgetId: id,
                    budgetName: id === null ? null : (selected?.name ?? null),
                    budgetIcon: id === null ? null : (selected?.icon ?? null),
                    budgetColor: id === null ? null : (selected?.color ?? null),
                  }));
                }}
              />
              <CategoryChipRow
                value={draft.category}
                onChange={(c) => setField("category", c)}
              />
            </div>
          </div>
        </div>

        <SheetFooter
          className={cn(
            "quick-expense-enter-group quick-expense-enter-delay-4 standalone:pb-safe px-4",
            isEditMode && "flex-row gap-2"
          )}
        >
          {isEditMode ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Delete expense"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={!onConfirmDelete || queueing}
              className="rounded-xl border-none"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-10 flex-1 rounded-xl text-base font-medium"
          >
            {isEditMode ? "Update" : "Save expense"}
          </Button>
        </SheetFooter>

        <DatePickerSheet
          open={dateOpen}
          onOpenChange={handleDateOpenChange}
          value={draft.date}
          onChange={(next) => setField("date", next)}
          onCloseAutoFocus={handlePickerCloseAutoFocus}
          onRestoreFocusRequest={restoreDrawerInputFocus}
        />

        <PaidByPickerSheet
          open={paidByOpen}
          onOpenChange={handlePaidByOpenChange}
          value={draft.paidBy}
          onChange={(next) => setField("paidBy", next)}
          onCloseAutoFocus={handlePickerCloseAutoFocus}
          onRestoreFocusRequest={restoreDrawerInputFocus}
        />

        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="p-0 sm:max-w-md">
            <div className="bg-muted/40 flex items-start gap-4 border-b px-6 py-5">
              <div className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full">
                <Trash2 className="h-5 w-5" />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle>Delete this expense?</DialogTitle>
                <DialogDescription>
                  We will remove it from your list. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="bg-card/80 border-border mx-2 space-y-4 rounded-xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">{draft.date}</p>
                  <div className="flex items-center gap-2">
                    <ExpenseItemIcon category={draft.category} size="sm" />
                    <span className="text-sm font-medium">
                      {draft.category}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Amount
                  </p>
                  <p className="text-destructive text-lg font-semibold">
                    -{formatVnd(draft.amount)} <VndSymbol />
                  </p>
                </div>
              </div>
              {draft.note ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <NotebookIcon className="size-4" />
                  <span className="text-sm font-medium">{draft.note}</span>
                </div>
              ) : null}
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={!onConfirmDelete}
              >
                Delete expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};

export default QuickExpenseSheet;
