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

import { usePathname } from "next/navigation";

import { Category, PaidBy } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { cn } from "@/lib/utils";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { ArrowUp, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import {
  QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS,
  QuickExpenseSuccessToast,
} from "@/components/QuickExpenseSuccessToast";
import AIQuickEntryPendingQueue from "@/components/ai-quick-entry/AIQuickEntryPendingQueue";
import AIQuickEntryPreview from "@/components/ai-quick-entry/AIQuickEntryPreview";
import AIQuickEntryStatusBar from "@/components/ai-quick-entry/AIQuickEntryStatusBar";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const HIDDEN_PATHS = ["/ai"];

const RESOLVE_DELAY_MS = 2500;

type AIQuickEntryMode = "entry" | "preview";

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newestFirst = (entries: QuickEntry[]) => [...entries].reverse();

const AIQuickEntry = () => {
  const pathname = usePathname();
  const open = useAIQuickEntryStore((state) => state.open);
  const setOpen = useAIQuickEntryStore((state) => state.setOpen);
  const paidBy = useSettingsStore((state) => state.paidBy);
  const keyboardOffset = useKeyboardOffset();
  const haptics = useAppHaptics();
  const inputId = useId();

  const [mode, setMode] = useState<AIQuickEntryMode>("entry");
  const [composer, setComposer] = useState("");
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hidden = HIDDEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();

    if (!open) {
      return;
    }

    setMode("entry");
    setEntries([]);
    setComposer("");
  }, [clearTimers, open]);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers]
  );

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.status === "pending"),
    [entries]
  );
  const completedEntries = useMemo(
    () => newestFirst(entries.filter((entry) => entry.status === "resolved")),
    [entries]
  );
  const failedEntries = useMemo(
    () => newestFirst(entries.filter((entry) => entry.status === "failed")),
    [entries]
  );
  const failedCount = failedEntries.length;
  const completedCount = completedEntries.length;

  if (hidden) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
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
    setMode("entry");
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const submit = () => {
    const input = composer.trim();
    if (!input) {
      return;
    }

    const id = createEntryId();
    setEntries((current) => [...current, { id, input, status: "pending" }]);
    setComposer("");
    haptics.impact("medium");

    const parseTimer = setTimeout(() => {
      const result = mockParseExpense(input, { paidBy });

      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "resolved",
                result,
              }
            : entry
        )
      );

      toast.success(
        <QuickExpenseSuccessToast
          draft={{
            date: result.date,
            amount: result.amount,
            note: result.note,
            category: result.category as Category,
            paidBy: result.paidBy as PaidBy,
            budgetId: result.budgetId,
            budgetName: result.budgetName,
            budgetIcon: result.budgetIcon,
            budgetColor: result.budgetColor,
          }}
        />,
        QUICK_EXPENSE_SUCCESS_TOAST_OPTIONS
      );
    }, RESOLVE_DELAY_MS);
    timersRef.current.push(parseTimer);
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
          <DrawerClose
            aria-label="Close AI quick entry"
            className="ring-offset-background absolute top-4 right-4 z-60 rounded-full p-3 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
          </DrawerClose>
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
                pendingCount={pendingEntries.length}
                completedCount={completedCount}
                failedCount={failedCount}
                onOpenPreview={openPreview}
              />
            ) : null}
          </DrawerHeader>

          {mode === "preview" ? (
            <AIQuickEntryPreview
              pendingEntries={newestFirst(pendingEntries)}
              completedEntries={completedEntries}
              failedEntries={failedEntries}
              onDone={returnToEntry}
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
                    pendingEntries={pendingEntries}
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
        </DrawerContent>
      ) : null}
    </Drawer>
  );
};

export default AIQuickEntry;
