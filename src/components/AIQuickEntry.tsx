"use client";

import React, {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { usePathname } from "next/navigation";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { cn } from "@/lib/utils";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { ArrowUp } from "lucide-react";

import AIEntrySkeleton from "@/components/AIEntrySkeleton";
import ExpenseListItem, {
  type ExpenseListItemData,
} from "@/components/ExpenseListItem";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const HIDDEN_PATHS = ["/ai"];

const RESOLVE_DELAY_MS = 1200;

type QuickEntry = {
  id: string;
  input: string;
  status: "pending" | "resolved";
  result?: ExpenseListItemData;
};

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIQuickEntry = () => {
  const pathname = usePathname();
  const open = useAIQuickEntryStore((state) => state.open);
  const setOpen = useAIQuickEntryStore((state) => state.setOpen);
  const paidBy = useSettingsStore((state) => state.paidBy);
  const keyboardOffset = useKeyboardOffset();
  const haptics = useAppHaptics();
  const inputId = useId();

  const [composer, setComposer] = useState("");
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hidden = HIDDEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (open) {
      setEntries([]);
      setComposer("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || hidden) {
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [hidden, open]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    },
    []
  );

  if (hidden || !open) {
    return null;
  }

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
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

    const timer = setTimeout(() => {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "resolved",
                result: mockParseExpense(input, { paidBy }),
              }
            : entry
        )
      );
    }, RESOLVE_DELAY_MS);
    timersRef.current.push(timer);
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
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-label="AI quick entry"
    >
      <button
        type="button"
        aria-label="Dismiss AI quick entry"
        onClick={close}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{ paddingBottom: keyboardOffset } as CSSProperties}
      >
        <div className="no-scrollbar mx-auto flex max-h-[50vh] w-full max-w-[390px] flex-col gap-2.5 overflow-y-auto px-4 pb-2">
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-2.5">
              <div className="flex justify-end">
                <span className="bg-primary text-primary-foreground max-w-[82%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium">
                  {entry.input}
                </span>
              </div>
              {entry.status === "resolved" && entry.result ? (
                <ExpenseListItem
                  expense={entry.result}
                  onEditExpense={() => {}}
                  className="bg-surface-2/95"
                />
              ) : (
                <AIEntrySkeleton />
              )}
            </div>
          ))}
        </div>

        <div className="px-4">
          <form
            onSubmit={handleSubmit}
            className="ds-glass mx-auto mb-2 flex w-full max-w-[390px] items-center gap-2 rounded-[28px] p-1.5 pl-4"
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
              className="text-foreground placeholder:text-muted-foreground/70 flex-1 border-0 bg-transparent text-base outline-none"
            />
            <button
              type="submit"
              aria-label="Send expense"
              disabled={!canSend}
              onPointerDown={(event) => event.preventDefault()}
              className={cn(
                "bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full transition-opacity",
                !canSend && "opacity-40"
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIQuickEntry;
