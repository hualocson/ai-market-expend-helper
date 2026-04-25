"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import type {
  ParseExpenseFallbackResponse,
  ParseExpenseResponse,
} from "@/lib/ai/parse-expense-contract";
import { formatVnd } from "@/lib/utils";
import { ArrowUp, Loader2, PencilLine, RefreshCw } from "lucide-react";

import ExpenseItemIcon from "./ExpenseItemIcon";
import ManualExpenseForm from "./ManualExpenseForm";
import { Button } from "./ui/button";
import PixelLoader from "./ui/pixel-loader/PixelLoader";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Textarea } from "./ui/textarea";

const examplePrompts = [
  "Lunch with team 120k today",
  "Groceries 450k yesterday",
  "Coffee 45k this morning",
];

type ChatMessage = {
  id: string;
} & (
  | {
      role: "user";
      text: string;
    }
  | {
      role: "assistant";
      variant: "pending";
    }
  | {
      role: "assistant";
      variant: "success";
      expense: TExpense;
    }
  | {
      role: "assistant";
      variant: "fallback";
      prefill: ParseExpenseFallbackResponse["prefill"];
    }
  | {
      role: "assistant";
      variant: "error";
      retryInput: string;
    }
);

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIExpenseChat = () => {
  const composerId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
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

  const dismissMessage = (id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
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
        {
          id: createId(),
          role: "user",
          text: input,
        },
        pendingMessage,
      ];
    });

    try {
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error("Parse request failed");
      }

      const payload = (await response.json()) as ParseExpenseResponse;

      if (payload.status === "success") {
        replaceMessage(assistantId, {
          id: assistantId,
          role: "assistant",
          variant: "success",
          expense: payload.expense,
        });
        return;
      }

      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "fallback",
        prefill: payload.prefill,
      });
    } catch {
      replaceMessage(assistantId, {
        id: assistantId,
        role: "assistant",
        variant: "error",
        retryInput: input,
      });
    } finally {
      setLoading(false);
    }
  };

  const submitMessage = async () => {
    const input = composer.trim();

    await sendInput({
      input,
      assistantId: createId(),
      appendUserMessage: true,
    });
  };

  const retryMessage = async (input: string, assistantId: string) => {
    await sendInput({
      input,
      assistantId,
      appendUserMessage: false,
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
      case "success":
        return (
          <SuccessBubble
            expense={message.expense}
            onDismiss={() => dismissMessage(message.id)}
          />
        );
      case "fallback":
        return (
          <div className="space-y-3">
            <div>
              <p className="text-foreground text-[15px] font-medium tracking-tight">
                I need a little help with this one.
              </p>
              <p className="text-muted-foreground text-sm leading-6">
                I started a quick form with what I could confidently read.
              </p>
            </div>
            <ManualExpenseForm
              initialMode="quick"
              prefillExpense={message.prefill}
            />
          </div>
        );
      case "error":
        return (
          <div className="space-y-2">
            <p className="text-foreground text-[15px] font-medium tracking-tight">
              I could not parse that expense.
            </p>
            <p className="text-muted-foreground text-sm leading-6">
              Try the same message again or rephrase it below.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              className="gap-1.5 rounded-full"
              onClick={() => void retryMessage(message.retryInput, message.id)}
            >
              <RefreshCw className="size-3.5" />
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
            placeholder="Dinner pho 90k tonight"
            rows={1}
            className="text-foreground placeholder:text-muted-foreground/70 max-h-32 min-h-9 resize-none border-0 !bg-transparent p-0 py-2 text-[15px] leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:!bg-transparent"
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
    </section>
  );
};

const SuccessBubble = ({
  expense,
  onDismiss,
}: {
  expense: TExpense;
  onDismiss: () => void;
}) => {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-foreground text-[15px] font-semibold tracking-tight">
          I found an expense draft.
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          Tap the card to review or edit before saving.
        </p>
      </div>

      <p className="sr-only">Review AI suggestion</p>

      <button
        type="button"
        aria-label="Continue to form"
        onClick={() => setEditOpen(true)}
        className="ds-surface-2 border-border/70 hover:border-primary/50 hover:bg-surface-3 focus-visible:ring-ring/40 group relative w-full rounded-2xl border px-3 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <ExpenseItemIcon category={expense.category} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {expense.note}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] tracking-wide uppercase">
              {expense.category} · {expense.date}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <p className="text-foreground font-mono text-sm font-semibold tabular-nums">
              {formatVnd(expense.amount)}
              <span className="text-muted-foreground ml-1 text-[10px] font-medium">
                VND
              </span>
            </p>
            <span className="text-muted-foreground/80 group-hover:text-primary inline-flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase transition">
              <PencilLine className="size-3" />
              Tap to edit
            </span>
          </div>
        </div>
      </button>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground text-xs font-medium transition"
        >
          Dismiss
        </button>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen} modal>
        <SheetContent className="h-full w-[90svw] gap-0">
          <SheetHeader className="text-left">
            <SheetTitle>Edit expense</SheetTitle>
            <SheetDescription>
              Adjust the AI draft before saving it.
            </SheetDescription>
          </SheetHeader>
          <div className="no-scrollbar overflow-y-auto px-2 pb-4">
            <ManualExpenseForm
              initialExpense={expense}
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AIExpenseChat;
