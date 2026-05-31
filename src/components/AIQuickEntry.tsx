"use client";

import React, {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import dayjs from "@/configs/date";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import type { BudgetColorId } from "@/lib/budget-appearance";
import { useCreateExpenseMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import type { LocalExpense } from "@/lib/sync/expenses/types";
import { cn } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import type { TQuickExpenseDraft } from "@/stores/quick-expense-recovery-store";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, XIcon } from "lucide-react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import QuickExpenseDrawer, {
  type TQuickExpenseDrawerInitialExpense,
} from "@/components/QuickExpenseDrawer";
import {
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS,
  QuickExpenseSuccessToast,
} from "@/components/QuickExpenseSuccessToast";
import AIQuickEntryPendingQueue from "@/components/ai-quick-entry/AIQuickEntryPendingQueue";
import AIQuickEntryPreview from "@/components/ai-quick-entry/AIQuickEntryPreview";
import AIQuickEntryStatusBar from "@/components/ai-quick-entry/AIQuickEntryStatusBar";
import {
  type AIQuickEntryReviewReason,
  buildOriginalInputReviewDraft,
  evaluateAIQuickEntryParse,
  localExpenseToSavedExpense,
} from "@/components/ai-quick-entry/real-parse";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import { useSettingsStore } from "@/components/providers/StoreProvider";

type AIQuickEntryMode = "entry" | "preview";

type ActiveQuickEntryDrawerItem =
  | { kind: "review"; entryId: string }
  | { kind: "saved"; entryId: string }
  | null;

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newestFirst = (entries: QuickEntry[]) =>
  [...entries].sort((left, right) => right.createdAt - left.createdAt);

const buildToastDraftFromInitialExpense = (
  initialExpense: TQuickExpenseDrawerInitialExpense
): TQuickExpenseDraft => ({
  date: initialExpense.date,
  amount: initialExpense.amount,
  note: initialExpense.note ?? "",
  category: initialExpense.category as TQuickExpenseDraft["category"],
  paidBy: initialExpense.paidBy as TQuickExpenseDraft["paidBy"],
  budgetId: initialExpense.budgetId ?? null,
  budgetName: initialExpense.budgetName ?? null,
  budgetIcon: initialExpense.budgetIcon ?? null,
  budgetColor: (initialExpense.budgetColor ?? null) as BudgetColorId | null,
});

const parseQuickEntryExpense = async ({
  input,
  todayDisplay,
  budgets,
}: {
  input: string;
  todayDisplay: string;
  budgets: Array<{ id: number; name: string; category: string }>;
}): Promise<ParseExpenseResponse> => {
  const response = await fetch("/api/ai/parse-expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      today: todayDisplay,
      budgets,
    }),
  });

  return unwrapApiResponse<ParseExpenseResponse>(
    await response.json(),
    response.status
  );
};

const AIQuickEntry = () => {
  const open = useAIQuickEntryStore((state) => state.open);
  const setOpen = useAIQuickEntryStore((state) => state.setOpen);
  const paidBy = useSettingsStore((state) => state.paidBy);
  const keyboardOffset = useKeyboardOffset();
  const haptics = useAppHaptics();
  const queryClient = useQueryClient();
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const inputId = useId();

  const [mode, setMode] = useState<AIQuickEntryMode>("entry");
  const [composer, setComposer] = useState("");
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [activeDrawerItem, setActiveDrawerItem] =
    useState<ActiveQuickEntryDrawerItem>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDrawerItemRef = useRef<ActiveQuickEntryDrawerItem>(null);
  const openRef = useRef(open);
  const sessionRef = useRef(0);

  useEffect(() => {
    if (activeDrawerItem) {
      activeDrawerItemRef.current = activeDrawerItem;
    }
  }, [activeDrawerItem]);

  useEffect(() => {
    openRef.current = open;
    sessionRef.current += 1;

    if (!open) {
      setActiveDrawerItem(null);
      activeDrawerItemRef.current = null;
      return;
    }

    setMode("entry");
    setEntries([]);
    setComposer("");
    setActiveDrawerItem(null);
    activeDrawerItemRef.current = null;
  }, [open]);

  const isCurrentSession = useCallback(
    (sessionId: number) => openRef.current && sessionRef.current === sessionId,
    []
  );

  const activeEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.status === "parsing" || entry.status === "saving"
      ),
    [entries]
  );
  const savedEntries = useMemo(
    () => newestFirst(entries.filter((entry) => entry.status === "saved")),
    [entries]
  );
  const reviewEntries = useMemo(
    () =>
      newestFirst(entries.filter((entry) => entry.status === "needsReview")),
    [entries]
  );
  const activeCount = activeEntries.length;
  const savedCount = savedEntries.length;
  const reviewCount = reviewEntries.length;

  const activeDrawerEntry = useMemo(
    () =>
      activeDrawerItem
        ? (entries.find((entry) => entry.id === activeDrawerItem.entryId) ??
          null)
        : null,
    [activeDrawerItem, entries]
  );

  const activeDrawerInitialExpense: TQuickExpenseDrawerInitialExpense | null =
    useMemo(() => {
      if (!activeDrawerItem || !activeDrawerEntry) {
        return null;
      }

      return activeDrawerItem.kind === "saved"
        ? (activeDrawerEntry.savedExpense ?? null)
        : (activeDrawerEntry.reviewDraft ?? null);
    }, [activeDrawerEntry, activeDrawerItem]);

  const drawerOpen = Boolean(activeDrawerItem && activeDrawerInitialExpense);
  const drawerMode = activeDrawerItem?.kind === "saved" ? "edit" : "create";
  const drawerTransactionId =
    activeDrawerItem?.kind === "saved"
      ? activeDrawerEntry?.savedExpense?.id
      : undefined;

  const markEntryForReview = useCallback(
    ({
      entryId,
      reviewDraft,
      errorReason,
    }: {
      entryId: string;
      reviewDraft: TQuickExpenseDrawerInitialExpense;
      errorReason: AIQuickEntryReviewReason;
    }) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "needsReview",
                reviewDraft,
                savedExpense: undefined,
                errorReason,
              }
            : entry
        )
      );
    },
    []
  );

  const runEntry = useCallback(
    async (entryId: string, input: string, sessionId: number) => {
      const today = dayjs();
      const todayIso = today.format("YYYY-MM-DD");
      const todayDisplay = today.format("DD/MM/YYYY");
      const weekStart = getWeekRange(today).weekStartDate.format("YYYY-MM-DD");
      let reviewDraft: TQuickExpenseDrawerInitialExpense | undefined;
      let errorReason: AIQuickEntryReviewReason = "budget_load_error";

      try {
        const budgetOptions = await queryClient.ensureQueryData(
          queries.budgetWeekly.options(weekStart, todayIso)
        );
        if (!isCurrentSession(sessionId)) {
          return;
        }

        errorReason = "request_failed";
        const parseResult = await parseQuickEntryExpense({
          input,
          todayDisplay,
          budgets: budgetOptions.map((budget) => ({
            id: budget.id,
            name: budget.name,
            category: budget.category,
          })),
        });
        if (!isCurrentSession(sessionId)) {
          return;
        }

        const decision = evaluateAIQuickEntryParse({
          input,
          parseResult,
          budgetOptions,
          paidBy,
          todayIso,
        });

        reviewDraft = decision.initialExpense;

        if (decision.kind === "review") {
          if (!isCurrentSession(sessionId)) {
            return;
          }
          markEntryForReview({
            entryId,
            reviewDraft: decision.initialExpense,
            errorReason: decision.reason,
          });
          haptics.warning();
          return;
        }

        if (!isCurrentSession(sessionId)) {
          return;
        }
        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "saving",
                  reviewDraft: decision.initialExpense,
                }
              : entry
          )
        );

        errorReason = "create_error";
        if (!isCurrentSession(sessionId)) {
          return;
        }
        const localExpense = await createExpense(decision.payload);
        if (!isCurrentSession(sessionId)) {
          return;
        }
        const savedExpense = localExpenseToSavedExpense(localExpense);

        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "saved",
                  reviewDraft: undefined,
                  savedExpense,
                  errorReason: undefined,
                }
              : entry
          )
        );

        toast.success(
          <QuickExpenseSuccessToast
            draft={buildToastDraftFromInitialExpense(decision.initialExpense)}
          />,
          QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
        );
        haptics.success();
      } catch (error) {
        if (!isCurrentSession(sessionId)) {
          return;
        }
        console.error(error);
        markEntryForReview({
          entryId,
          reviewDraft:
            reviewDraft ??
            buildOriginalInputReviewDraft({
              input,
              paidBy,
              todayDisplay,
            }),
          errorReason,
        });
        haptics.error();
      }
    },
    [
      createExpense,
      haptics,
      isCurrentSession,
      markEntryForReview,
      paidBy,
      queryClient,
    ]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      openRef.current = false;
      sessionRef.current += 1;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      return;
    }
    inputRef.current?.blur();
  };

  const openPreview = () => {
    setMode("preview");
    inputRef.current?.blur();
  };

  const returnToEntry = () => {
    flushSync(() => {
      setMode("entry");
    });
    inputRef.current?.focus({ preventScroll: true });
  };

  const submit = () => {
    const input = composer.trim();
    if (!input) {
      return;
    }

    const id = createEntryId();
    const sessionId = sessionRef.current;
    setEntries((current) => [
      ...current,
      { id, input, status: "parsing", createdAt: Date.now() },
    ]);
    setComposer("");
    haptics.impact("medium");
    void runEntry(id, input, sessionId);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const openReviewEntry = (entry: QuickEntry) => {
    setActiveDrawerItem({ kind: "review", entryId: entry.id });
  };

  const openSavedEntry = (entry: QuickEntry) => {
    setActiveDrawerItem({ kind: "saved", entryId: entry.id });
  };

  const handleQuickExpenseDrawerOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    setActiveDrawerItem(null);
  };

  const handleQuickExpenseDrawerSuccess = (expense: LocalExpense) => {
    const drawerItem = activeDrawerItem ?? activeDrawerItemRef.current;
    if (!drawerItem) {
      return;
    }

    const savedExpense = localExpenseToSavedExpense(expense);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === drawerItem.entryId
          ? {
              ...entry,
              status: "saved",
              reviewDraft: undefined,
              savedExpense,
              errorReason: undefined,
            }
          : entry
      )
    );
    activeDrawerItemRef.current = null;
  };

  const canSend = composer.trim().length > 0;

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      modal
      direction="bottom"
      repositionInputs={false}
      autoFocus={false}
    >
      {open ? (
        <DrawerContent
          hideIndicator
          overlayClassName="ds-glass backdrop-blur-lg !rounded-none"
          className="quick-expense-drawer-morph h-dvh w-full gap-0 !rounded-none !bg-transparent p-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus({ preventScroll: true });
          }}
        >
          {mode === "entry" ? (
            <DrawerClose
              aria-label="Close AI quick entry"
              className="ring-offset-background absolute top-4 right-4 z-60 rounded-full p-3 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none"
            >
              <XIcon className="size-4" />
            </DrawerClose>
          ) : null}
          <DrawerHeader
            data-testid="ai-quick-entry-drawer-header"
            className="absolute inset-x-0 top-0 z-10 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-0"
          >
            <DrawerTitle className="sr-only">AI quick entry</DrawerTitle>
            <DrawerDescription className="sr-only">
              Describe expenses in natural language and review parsed entries.
            </DrawerDescription>
            {mode === "entry" ? (
              <AIQuickEntryStatusBar
                totalCount={entries.length}
                pendingCount={activeCount}
                completedCount={savedCount}
                failedCount={reviewCount}
                onOpenPreview={openPreview}
              />
            ) : null}
          </DrawerHeader>

          {mode === "preview" ? (
            <AIQuickEntryPreview
              activeEntries={newestFirst(activeEntries)}
              savedEntries={savedEntries}
              reviewEntries={reviewEntries}
              onDone={returnToEntry}
              onSelectSavedEntry={openSavedEntry}
              onSelectReviewEntry={openReviewEntry}
            />
          ) : (
            <div className="relative h-dvh overflow-hidden">
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col"
                style={{ paddingBottom: keyboardOffset } as CSSProperties}
              >
                <div
                  data-testid="ai-quick-entry-list"
                  className="no-scrollbar mx-auto flex w-full max-w-[390px] flex-col gap-2.5 overflow-hidden px-4 pb-2"
                >
                  <AIQuickEntryPendingQueue
                    activeEntries={activeEntries}
                    onOpenPreview={openPreview}
                  />
                </div>

                <div className="px-4 pb-2">
                  <form
                    onSubmit={handleSubmit}
                    className="mx-auto flex w-full max-w-[390px] items-center gap-2"
                  >
                    <label htmlFor={inputId} className="sr-only">
                      Describe your expense
                    </label>
                    <input
                      id={inputId}
                      ref={inputRef}
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Cà phê 35k sáng nay"
                      className="text-foreground placeholder:text-muted-foreground/70 ds-glass glass-border flex-1 rounded-[28px] border-0 bg-transparent px-4 py-3 text-base outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Send expense"
                      disabled={!canSend}
                      onPointerDown={(event) => event.preventDefault()}
                      className={cn(
                        "ds-glass glass-border text-primary-foreground grid size-12 shrink-0 place-items-center rounded-full !text-white transition-opacity",
                        !canSend && "opacity-40"
                      )}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          <QuickExpenseDrawer
            showTrigger={false}
            open={drawerOpen}
            onOpenChange={handleQuickExpenseDrawerOpenChange}
            mode={drawerMode}
            transactionId={drawerTransactionId}
            initialExpense={activeDrawerInitialExpense}
            initialExpenseKey={
              activeDrawerItem
                ? `${activeDrawerItem.kind}:${activeDrawerItem.entryId}`
                : undefined
            }
            onSuccess={handleQuickExpenseDrawerSuccess}
          />
        </DrawerContent>
      ) : null}
    </Drawer>
  );
};

export default AIQuickEntry;
