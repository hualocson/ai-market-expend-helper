"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
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
  Check,
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";

import { useSettingsStore } from "@/components/providers/StoreProvider";

import BudgetBadge from "./BudgetBadge";
import BudgetChipRow from "./BudgetChipRow";
import CategoryChipRow from "./CategoryChipRow";
import DatePickerSheet from "./DatePickerSheet";
import ExpenseItemIcon from "./ExpenseItemIcon";
import PaidByPickerSheet from "./PaidByPickerSheet";
import VndSymbol from "./VndSymbol";

export type TQuickExpenseDrawerProps = {
  compact?: boolean;
  onTriggerClick?: () => void;
  mode?: "create" | "edit";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialExpense?: TQuickExpenseDrawerInitialExpense | null;
  recoveryDraft?: TQuickExpenseDraft | null;
  recoveryOperationId?: string;
  transactionId?: number;
  onSuccess?: () => void;
  onConfirmDelete?: () => void | Promise<void>;
  showTrigger?: boolean;
};

export type TQuickExpenseDrawerInitialExpense = {
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
type BudgetSelectionSource = "none" | "manual" | "ai" | "ai-prefill";

const QuickExpenseSuccessToast = ({ draft }: { draft: TExpenseDraft }) => {
  const note = draft.note?.trim() || "No note";
  const hasBudget = draft.budgetId !== null;

  return (
    <div className="flex w-[min(78vw,340px)] max-w-full items-center gap-2">
      {hasBudget ? (
        <BudgetBadge
          icon={draft.budgetIcon}
          color={draft.budgetColor}
          name={draft.budgetName}
          iconOnly
          className="size-6 shrink-0 justify-center gap-0 rounded-full px-0 py-0"
          iconClassName="size-auto text-sm"
        />
      ) : (
        <ExpenseItemIcon
          category={draft.category}
          size="sm"
          className="shrink-0"
        />
      )}
      <span className="text-foreground/90 min-w-0 flex-1 truncate">{note}</span>
      <span className="bg-destructive/15 text-destructive inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold tabular-nums">
        {formatVnd(draft.amount)}
        <VndSymbol className="ml-0.5" />
      </span>
    </div>
  );
};

const isBudgetSelectionLocked = (source: BudgetSelectionSource) =>
  source === "manual" || source === "ai-prefill";

const isAiBudgetSelectionSource = (source: BudgetSelectionSource) =>
  source === "ai" || source === "ai-prefill";

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
  initialExpense: TQuickExpenseDrawerInitialExpense | null | undefined,
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

const buildNextEntryDraft = (previous: TExpenseDraft): TExpenseDraft => ({
  ...buildDefaultDraft(normalizePaidBy(previous.paidBy)),
  date: previous.date,
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

const QuickExpenseDrawer = ({
  compact = false,
  onTriggerClick,
  mode = "create",
  open,
  onOpenChange,
  initialExpense = null,
  recoveryDraft = null,
  recoveryOperationId,
  transactionId,
  onConfirmDelete,
  showTrigger,
}: TQuickExpenseDrawerProps) => {
  const isEditMode = mode === "edit";
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const keepDrawerOpen = useSettingsStore((state) => state.keepDrawerOpen);
  const setKeepDrawerOpen = useSettingsStore(
    (state) => state.setKeepDrawerOpen
  );
  const clearRecovery = useQuickExpenseRecoveryStore((state) => state.clear);
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const { mutateAsync: updateExpense } = useUpdateExpenseMutation();
  const { mutateAsync: suggestBudgetMutateAsync } = useSuggestBudgetMutation();
  const haptics = useAppHaptics();
  const fallbackPaidBy = normalizePaidBy(settingsPaidBy);
  const [internalOpen, setInternalOpen] = useState(false);
  const drawerOpen = open ?? internalOpen;
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
  const [isSuggestingBudget, setIsSuggestingBudget] = useState(false);
  const keyboardOffset = useKeyboardOffset();

  const [queueing, setQueueing] = useState(false);

  const canSubmit = draft.amount > 0 && !queueing;
  const noteRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const drawerOpenRef = useRef(drawerOpen);
  const pendingDrawerFocusRestoreRef = useRef<TRestorableInputFocus>(null);
  const budgetSelectionSourceRef = useRef<BudgetSelectionSource>(
    recoveryDraft || isEditMode ? "manual" : "none"
  );
  const currentNoteRef = useRef(draft.note);
  const currentSuggestionCandidateKeyRef = useRef("");
  const lastSuggestionSnapshotRef = useRef<string | null>(null);
  const suggestionRequestIdRef = useRef(0);
  const categoryUserEditedRef = useRef(false);
  const previousControlledOpenRef = useRef(open);
  drawerOpenRef.current = drawerOpen;
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
    setIsSuggestingBudget(false);
    categoryUserEditedRef.current = false;
  };

  const shouldApplyBudgetCategory = () =>
    !isEditMode && !categoryUserEditedRef.current;

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
    enabled: drawerOpen && Boolean(weekStart),
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

    haptics.impact("medium");
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
      const keepOpen =
        !isEditMode && !recoveryOperationId && !recoveryDraft && keepDrawerOpen;
      if (keepOpen) {
        const nextDraft = buildNextEntryDraft(submittedDraft);
        setDraft(nextDraft);
        resetSuggestionTracking(nextDraft, "none");
        noteRef.current?.focus({ preventScroll: true });
      } else {
        handleOpenChange(false);
      }

      void localWrite
        .then(() => {
          if (isEditMode) {
            toast.success("Expense updated.");
            return;
          }
          toast.success(<QuickExpenseSuccessToast draft={submittedDraft} />, {
            icon: null,
            classNames: {
              title:
                "!min-w-0 !w-auto !max-w-[min(78vw,340px)] !overflow-visible !whitespace-normal !text-clip",
            },
          });
        })
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

    if (!drawerOpenRef.current) {
      return;
    }
    if (inputToRestore === "note") {
      noteRef.current?.focus({ preventScroll: true });
      return;
    }
    amountRef.current?.focus({ preventScroll: true });
  };

  const handlePickerCloseAutoFocus = (event: Event) => {
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
    if (!drawerOpen) {
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
  }, [fallbackPaidBy, initialExpense, isEditMode, recoveryDraft, drawerOpen]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) {
        return;
      }
      const hasBudget =
        detail.budgetId !== null && detail.budgetId !== undefined;
      setDraft((prev) => {
        const nextDraft: TExpenseDraft = {
          ...prev,
          amount: detail.amount,
          note: detail.note,
          date: detail.date ? formatDraftDate(detail.date) : prev.date,
          budgetId: hasBudget ? (detail.budgetId ?? null) : null,
          budgetName: hasBudget ? (detail.budgetName ?? null) : null,
          budgetIcon: hasBudget ? (detail.budgetIcon ?? null) : null,
          budgetColor: hasBudget ? (detail.budgetColor ?? null) : null,
        };
        resetSuggestionTracking(nextDraft, hasBudget ? "ai-prefill" : "none");
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
    const option = budgetOptions.find((budget) => budget.id === draft.budgetId);
    if (!option) {
      setDraft((prev) => ({
        ...prev,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
      }));
      if (isAiBudgetSelectionSource(budgetSelectionSourceRef.current)) {
        budgetSelectionSourceRef.current = "none";
      }
      return;
    }
    if (isAiBudgetSelectionSource(budgetSelectionSourceRef.current)) {
      setDraft((prev) => ({
        ...prev,
        budgetName: option.name,
        budgetIcon: option.icon,
        budgetColor: option.color,
        category: shouldApplyBudgetCategory() ? option.category : prev.category,
      }));
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
      category: shouldApplyBudgetCategory() ? selected.category : prev.category,
    }));
    budgetSelectionSourceRef.current = "ai";
  };

  const handleNoteBlur = async () => {
    if (!drawerOpen || !budgetOptionsQuery.isSuccess) {
      return;
    }

    const note = draft.note.trim();
    if (note.length < 3) {
      return;
    }
    if (!suggestionCandidates.length) {
      return;
    }
    if (isBudgetSelectionLocked(budgetSelectionSourceRef.current)) {
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
    setIsSuggestingBudget(true);

    try {
      const result = await suggestBudgetMutateAsync({
        note,
        budgets: suggestionCandidates,
      });

      if (requestId !== suggestionRequestIdRef.current) {
        return;
      }
      if (!drawerOpenRef.current) {
        return;
      }
      if (currentNoteRef.current.trim() !== note) {
        return;
      }
      if (currentSuggestionCandidateKeyRef.current !== requestCandidateKey) {
        return;
      }
      if (isBudgetSelectionLocked(budgetSelectionSourceRef.current)) {
        return;
      }
      if (result.status === "no_match") {
        haptics.error();
        return;
      }
      if (result.status !== "success" || result.confidence === "low") {
        haptics.error();
        return;
      }

      applySuggestedBudget(result.budgetId);
      haptics.success();
    } catch (error) {
      console.error("Failed to suggest budget", error);
    } finally {
      if (requestId === suggestionRequestIdRef.current) {
        setIsSuggestingBudget(false);
      }
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
  const keyboardOpen = keyboardOffset > 0;
  const submitText = isEditMode ? "Update" : "Save expense";
  const submitLabel = isEditMode ? "Update expense" : "Save expense";
  const showKeepOpenToggle =
    !isEditMode && !recoveryOperationId && !recoveryDraft;
  const renderSubmitButton = (placement: "footer" | "keyboard") => {
    const isKeyboardPlacement = placement === "keyboard";

    return (
      <Button
        type="button"
        size={isKeyboardPlacement ? "icon-sm" : "default"}
        aria-label={isKeyboardPlacement ? submitLabel : undefined}
        onPointerDown={
          isKeyboardPlacement ? (event) => event.preventDefault() : undefined
        }
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          isKeyboardPlacement
            ? "h-12 w-12 shrink-0 rounded-full"
            : "h-12 flex-1 rounded-xl text-base font-medium"
        )}
      >
        {isKeyboardPlacement ? <Check className="h-4 w-4" /> : submitText}
      </Button>
    );
  };

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={handleOpenChange}
      modal
      direction="bottom"
      repositionInputs={false}
      autoFocus={false}
    >
      {shouldShowTrigger ? (
        <DrawerTrigger asChild>
          <Button
            size={compact ? "icon-lg" : "default"}
            aria-label={compact ? "Add expense" : undefined}
            onClick={onTriggerClick}
            className={cn(
              "text-muted rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
              compact && "size-12"
            )}
          >
            <Plus className={compact ? "size-5" : "size-4"} />
            {compact ? null : "Add expense"}
          </Button>
        </DrawerTrigger>
      ) : null}
      {drawerOpen ? (
        <DrawerContent
          hideIndicator
          overlayClassName="quick-expense-drawer-overlay"
          className="quick-expense-drawer-morph h-dvh w-full gap-0 rounded-none p-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (isEditMode) {
              return;
            }
            noteRef.current?.focus({ preventScroll: true });
          }}
        >
          <div className="quick-expense-enter-group quick-expense-enter-delay-1 absolute top-4 right-4 z-60 flex items-center gap-2">
            {showKeepOpenToggle ? (
              <label
                className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-xs font-medium opacity-70"
                onPointerDown={(event) => event.preventDefault()}
              >
                <span>Create more</span>
                <Switch
                  checked={keepDrawerOpen}
                  onCheckedChange={setKeepDrawerOpen}
                  onPointerDown={(event) => event.preventDefault()}
                  aria-label="Create more"
                />
              </label>
            ) : null}
            <DrawerClose className="ring-offset-background rounded-full p-3 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>
          <DrawerHeader className="sr-only">
            <DrawerTitle>
              {isEditMode ? "Edit expense" : "Add expense"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditMode
                ? "Update expense details and save."
                : "Enter expense details and save."}
            </DrawerDescription>
          </DrawerHeader>
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
                  handleDrawerTriggerPointerDown(event, () =>
                    setPaidByOpen(true)
                  )
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

              {showSuggestions && !keyboardOpen ? (
                <div
                  role="group"
                  aria-label="Amount suggestions"
                  className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto"
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
              ) : null}

              {keyboardOpen ? (
                <div
                  role="group"
                  aria-label="Amount suggestions"
                  className="fixed inset-x-0 z-60 mx-auto flex w-full max-w-md items-center gap-2 px-4 pt-2 pb-2"
                  style={{
                    bottom: `calc(${keyboardOffset}px + 8px)`,
                  }}
                >
                  <div
                    data-testid="amount-suggestion-scroll"
                    className="no-scrollbar flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto"
                  >
                    {showSuggestions
                      ? suggestions.map((s) => (
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
                        ))
                      : null}
                  </div>
                  {renderSubmitButton("keyboard")}
                </div>
              ) : null}

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
                  suggesting={isSuggestingBudget}
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
                      budgetColor:
                        id === null ? null : (selected?.color ?? null),
                      category:
                        id !== null && selected && shouldApplyBudgetCategory()
                          ? selected.category
                          : prev.category,
                    }));
                  }}
                />
                <CategoryChipRow
                  value={draft.category}
                  onChange={(c) => {
                    categoryUserEditedRef.current = true;
                    setField("category", c);
                  }}
                />
              </div>
            </div>
          </div>

          {!keyboardOpen || isEditMode ? (
            <DrawerFooter
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
              {!keyboardOpen ? renderSubmitButton("footer") : null}
            </DrawerFooter>
          ) : null}

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
                    <p className="text-muted-foreground text-sm">
                      {draft.date}
                    </p>
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
        </DrawerContent>
      ) : null}
    </Drawer>
  );
};

export default QuickExpenseDrawer;
