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

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { mockParseExpense } from "@/lib/ai/mock-parse-expense";
import { cn } from "@/lib/utils";
import { useAIQuickEntryStore } from "@/stores/ai-quick-entry-store";
import { ArrowUp } from "lucide-react";

import AIQuickEntryPendingStack from "@/components/ai-quick-entry/AIQuickEntryPendingStack";
import AIQuickEntryRow from "@/components/ai-quick-entry/AIQuickEntryRow";
import AIQuickEntryStatusBar from "@/components/ai-quick-entry/AIQuickEntryStatusBar";
import type { QuickEntry } from "@/components/ai-quick-entry/types";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const HIDDEN_PATHS = ["/ai"];

const RESOLVE_DELAY_MS = 2500;
const RESOLVED_VISIBLE_MS = 3000;

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

  const [composer, setComposer] = useState("");
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [pendingStackExpanded, setPendingStackExpanded] = useState(false);
  const [visibleResolvedIds, setVisibleResolvedIds] = useState<Set<string>>(
    () => new Set()
  );
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

    setEntries([]);
    setComposer("");
    setCompletedOpen(false);
    setPendingStackExpanded(false);
    setVisibleResolvedIds(new Set());
  }, [clearTimers, open]);

  useEffect(() => {
    if (!open || hidden) {
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [hidden, open]);

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
  const activeResolvedEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status === "resolved" && visibleResolvedIds.has(entry.id)
      ),
    [entries, visibleResolvedIds]
  );
  const completedEntries = useMemo(
    () =>
      newestFirst(
        entries.filter(
          (entry) =>
            entry.status === "failed" ||
            (entry.status === "resolved" && !visibleResolvedIds.has(entry.id))
        )
      ),
    [entries, visibleResolvedIds]
  );
  const failedCount = entries.filter(
    (entry) => entry.status === "failed"
  ).length;
  const completedCount = entries.filter(
    (entry) => entry.status === "resolved"
  ).length;

  useEffect(() => {
    if (pendingEntries.length === 0) {
      setPendingStackExpanded(false);
    }
  }, [pendingEntries.length]);

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

    const parseTimer = setTimeout(() => {
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
      setVisibleResolvedIds((current) => new Set(current).add(id));

      const hideTimer = setTimeout(() => {
        setVisibleResolvedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, RESOLVED_VISIBLE_MS);
      timersRef.current.push(hideTimer);
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
  const hasEntries = entries.length > 0;

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

      {hasEntries ? (
        <div
          data-testid="ai-quick-entry-status-top"
          className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-10 px-4"
        >
          <AIQuickEntryStatusBar
            pendingCount={pendingEntries.length}
            completedCount={completedCount}
            failedCount={failedCount}
            completedOpen={completedOpen}
            onToggleCompleted={() => setCompletedOpen((current) => !current)}
          />
        </div>
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{ paddingBottom: keyboardOffset } as CSSProperties}
      >
        <div
          data-testid="ai-quick-entry-list"
          className={cn(
            "no-scrollbar mx-auto flex w-full max-w-[390px] flex-col gap-2.5 overflow-y-auto px-4 pb-2 transition-[max-height] duration-200 ease-out",
            completedOpen ? "max-h-[50svh]" : "max-h-[36svh]"
          )}
        >
          {completedOpen && completedEntries.length > 0 ? (
            <div className="space-y-2">
              {completedEntries.map((entry) => (
                <AIQuickEntryRow
                  key={entry.id}
                  entry={entry}
                  variant={entry.status === "failed" ? "failed" : "resolved"}
                />
              ))}
            </div>
          ) : null}

          {activeResolvedEntries.map((entry) => (
            <AIQuickEntryRow key={entry.id} entry={entry} variant="resolved" />
          ))}

          <AIQuickEntryPendingStack
            pendingEntries={pendingEntries}
            expanded={pendingStackExpanded}
            onToggleExpanded={() =>
              setPendingStackExpanded((current) => !current)
            }
          />
        </div>

        <div className="px-4 pb-2">
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-[390px] items-center gap-2"
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
              onPointerDown={(e) => {
                e.preventDefault();
                inputRef.current?.focus({
                  preventScroll: false,
                });
              }}
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
  );
};

export default AIQuickEntry;
