"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import dayjs from "@/configs/date";
import { PaidBy } from "@/enums";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { unwrapApiResponse } from "@/lib/api/api-response";
import {
  type TBudgetOption,
  isDateWithinBudgetPeriod,
  isExpenseDateSuspicious,
} from "@/lib/budget-options";
import { dispatchExpensePrefill } from "@/lib/expense-prefill";
import { useCreateExpenseMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { formatVnd } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSettingsStore } from "@/components/providers/StoreProvider";

import QuickExpenseDrawer from "./QuickExpenseDrawer";
import { Button } from "./ui/button";
import PixelLoader from "./ui/pixel-loader/PixelLoader";
import { Textarea } from "./ui/textarea";

const examplePrompts = [
  "Cà phê sữa đá 35k sáng nay",
  "Ăn trưa 90k hôm nay",
  "Đổ xăng 60k chiều qua",
];

const ALLOWED_PAID_BY = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const resolvePaidBy = (value: string | undefined): PaidBy =>
  ALLOWED_PAID_BY.find((option) => option === value) ?? PaidBy.OTHER;

const toIsoDate = (ddmmyyyy: string): string | null => {
  const parsed = dayjs(ddmmyyyy, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

type ChatMessage = {
  id: string;
} & (
  | { role: "user"; text: string }
  | { role: "assistant"; variant: "pending" }
  | { role: "assistant"; variant: "added"; summary: string }
  | { role: "assistant"; variant: "review" }
  | { role: "assistant"; variant: "error"; retryInput: string }
);

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIExpenseChat = () => {
  const composerId = useId();
  const queryClient = useQueryClient();
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
  const { mutateAsync: createExpense } = useCreateExpenseMutation();
  const haptics = useAppHaptics();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof el.scrollTo !== "function") {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const max = 128;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [composer]);

  const replaceMessage = (id: string, next: ChatMessage) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? next : message))
    );
  };

  const loadTodayBudgets = async (): Promise<TBudgetOption[]> => {
    const today = dayjs().format("YYYY-MM-DD");
    const weekStart = getWeekRange(dayjs()).weekStartDate.format("YYYY-MM-DD");
    return queryClient.ensureQueryData(
      queries.budgetWeekly.options(weekStart, today)
    );
  };

  const openForReview = (
    prefill: { amount: number; note: string; date?: string },
    budget: TBudgetOption | null
  ) => {
    dispatchExpensePrefill({
      amount: prefill.amount,
      note: prefill.note,
      date: prefill.date,
      budgetId: budget?.id ?? null,
      budgetName: budget?.name ?? null,
      budgetIcon: budget?.icon ?? null,
      budgetColor: budget?.color ?? null,
      source: "ai",
    });
  };

  const handleResult = async (
    result: ParseExpenseResponse,
    assistantId: string,
    budgetOptions: TBudgetOption[]
  ) => {
    if (result.status === "fallback") {
      openForReview(
        { amount: result.prefill.amount ?? 0, note: result.prefill.note ?? "" },
        null
      );
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "review",
      });
      haptics.warning();
      return;
    }

    const { expense } = result;
    const isoDate = toIsoDate(expense.date);
    const budget =
      expense.budgetId !== null
        ? (budgetOptions.find((option) => option.id === expense.budgetId) ??
          null)
        : null;

    const now = dayjs();
    if (
      isoDate !== null &&
      isExpenseDateSuspicious(isoDate, now.format("YYYY-MM-DD"))
    ) {
      openForReview(
        {
          amount: expense.amount,
          note: expense.note,
          date: now.format("DD/MM/YYYY"),
        },
        budget
      );
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "review",
      });
      haptics.warning();
      return;
    }

    const canAutoAdd =
      expense.confidence === "high" &&
      isoDate !== null &&
      expense.note.trim().length > 0 &&
      budget !== null &&
      isDateWithinBudgetPeriod(budget, isoDate);

    if (canAutoAdd && budget && isoDate) {
      await createExpense({
        date: isoDate,
        amount: expense.amount,
        note: expense.note,
        category: budget.category,
        paidBy: resolvePaidBy(settingsPaidBy),
        budgetId: budget.id,
        budgetName: budget.name,
        budgetIcon: budget.icon,
        budgetColor: budget.color,
      });
      const summary = `Added ${formatVnd(expense.amount)}₫ to ${budget.name}`;
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "added",
        summary,
      });
      toast.success(summary);
      haptics.success();
      return;
    }

    openForReview(
      { amount: expense.amount, note: expense.note, date: expense.date },
      budget
    );
    replaceMessage(assistantId, {
      id: assistantId,
      role: "assistant",
      variant: "review",
    });
    haptics.warning();
  };

  const sendInput = async ({
    input,
    assistantId,
    appendUserMessage,
  }: {
    input: string;
    assistantId: string;
    appendUserMessage: boolean;
  }) => {
    if (!input || loading) {
      return;
    }

    setLoading(true);
    setComposer("");
    setMessages((current) => {
      const pendingMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        variant: "pending",
      };
      if (!appendUserMessage) {
        return current.map((message) =>
          message.id === assistantId ? pendingMessage : message
        );
      }
      return [
        ...current,
        { id: createId(), role: "user", text: input },
        pendingMessage,
      ];
    });

    try {
      const budgetOptions = await loadTodayBudgets();
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          today: dayjs().format("DD/MM/YYYY"),
          budgets: budgetOptions.map((option) => ({
            id: option.id,
            name: option.name,
            category: option.category,
          })),
        }),
      });
      const payload = unwrapApiResponse<ParseExpenseResponse>(
        await response.json(),
        response.status
      );
      await handleResult(payload, assistantId, budgetOptions);
    } catch (requestError) {
      console.error(requestError);
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "error",
        retryInput: input,
      });
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const submitMessage = async () => {
    await sendInput({
      input: composer.trim(),
      assistantId: createId(),
      appendUserMessage: true,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const trimmedComposer = composer.trim();
  const showExamples = messages.length === 0;

  const renderAssistantContent = (
    message: Extract<ChatMessage, { role: "assistant" }>
  ) => {
    switch (message.variant) {
      case "pending":
        return (
          <span className="text-muted-foreground inline-flex items-center gap-2.5 text-sm">
            <PixelLoader size="sm" pattern="wave" label="Reading the expense" />
            Reading the expense...
          </span>
        );
      case "added":
        return (
          <p className="text-foreground text-[15px] font-medium tracking-tight">
            {message.summary}
          </p>
        );
      case "review":
        return (
          <p className="text-muted-foreground text-sm leading-6">
            I opened a draft for you to review and save.
          </p>
        );
      case "error":
        return (
          <div className="space-y-2">
            <p className="text-foreground text-[15px] font-medium tracking-tight">
              I could not parse that expense.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              className="gap-1.5 rounded-full"
              onClick={() =>
                void sendInput({
                  input: message.retryInput,
                  assistantId: message.id,
                  appendUserMessage: false,
                })
              }
            >
              Try again
            </Button>
          </div>
        );
    }
  };

  return (
    <section
      aria-label="AI expense conversation"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={logRef}
        role="log"
        aria-label="AI expense conversation"
        aria-live="polite"
        aria-relevant="additions text"
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-center text-sm leading-6">
              Tell me what you spent.
            </p>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <article key={message.id} className="flex justify-end">
              <div className="bg-primary text-primary-foreground max-w-[82%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 font-medium">
                {message.text}
              </div>
            </article>
          ) : (
            <article
              key={message.id}
              className="text-foreground max-w-full text-sm leading-6"
            >
              {renderAssistantContent(message)}
            </article>
          )
        )}
      </div>

      <div className="sticky bottom-0 z-50 shrink-0 space-y-2.5 pt-3">
        {showExamples ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="secondary"
                size="sm"
                className="border-border/70 bg-surface-2/80 text-muted-foreground hover:border-primary/40 hover:text-foreground h-8 shrink-0 rounded-full border px-3 text-xs"
                onClick={() => {
                  setComposer(prompt);
                  textareaRef.current?.focus();
                }}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="ds-glass border-border/80 relative flex items-end gap-2 rounded-[28px] border p-1.5 pl-4"
        >
          <label htmlFor={composerId} className="sr-only">
            Message Spendly AI
          </label>
          <Textarea
            id={composerId}
            ref={textareaRef}
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Cà phê 35k sáng nay"
            rows={1}
            className="text-foreground placeholder:text-muted-foreground/70 max-h-32 min-h-9 resize-none border-0 !bg-transparent p-0 py-2 text-base leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-[15px] dark:!bg-transparent"
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={loading || !trimmedComposer}
            className="size-10 shrink-0 rounded-full p-0"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>

      <QuickExpenseDrawer showTrigger={false} />
    </section>
  );
};

export default AIExpenseChat;
