"use client";

import { useId, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { cn } from "@/lib/utils";
import { Bot, Loader2, PenLine, Sparkles } from "lucide-react";

import AIExpensePreviewCard from "./AIExpensePreviewCard";
import ManualExpenseForm from "./ManualExpenseForm";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const examplePrompts = [
  "Lunch with team 120k today",
  "Groceries 450k yesterday",
  "Coffee 45k this morning",
];

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: ReactNode;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIExpenseChat = () => {
  const composerId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: (
        <div className="space-y-2">
          <p className="font-serif text-lg text-stone-950">
            Tell me what you spent.
          </p>
          <p className="text-sm leading-6 text-stone-600">
            I will turn a quick sentence into an expense draft you can review.
          </p>
        </div>
      ),
    },
  ]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);

  const replaceMessage = (id: string, next: ChatMessage) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? next : message))
    );
  };

  const submitMessage = async () => {
    const input = composer.trim();

    if (!input || loading) {
      return;
    }

    const pendingId = createId();

    setLoading(true);
    setComposer("");
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "user",
        content: input,
      },
      {
        id: pendingId,
        role: "assistant",
        content: (
          <span className="inline-flex items-center gap-2 text-sm text-stone-600">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
            Reading the receipt ink...
          </span>
        ),
      },
    ]);

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
        replaceMessage(pendingId, {
          id: pendingId,
          role: "assistant",
          content: <SuccessBubble expense={payload.expense} />,
        });
        return;
      }

      replaceMessage(pendingId, {
        id: pendingId,
        role: "assistant",
        content: (
          <div className="space-y-4">
            <div>
              <p className="font-serif text-lg text-stone-950">
                I need a little help with this one.
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                I started a quick form with anything I could confidently read.
              </p>
            </div>
            <ManualExpenseForm
              initialMode="quick"
              prefillExpense={payload.prefill}
            />
          </div>
        ),
      });
    } catch {
      replaceMessage(pendingId, {
        id: pendingId,
        role: "assistant",
        content: (
          <div className="space-y-2">
            <p className="font-serif text-lg text-stone-950">
              I could not parse that expense.
            </p>
            <p className="text-sm leading-6 text-stone-600">
              Try another phrasing, like "Coffee 45k this morning".
            </p>
          </div>
        ),
      });
    } finally {
      setLoading(false);
    }
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
  const showExamples = messages.length === 1;

  return (
    <section
      aria-label="AI expense conversation"
      className="relative isolate overflow-hidden rounded-[2rem] border border-amber-900/10 bg-[#f6eedf] p-3 text-stone-950 shadow-[0_24px_80px_rgba(82,62,31,0.16)] sm:p-5"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.9),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(96,153,102,0.24),transparent_28%),linear-gradient(135deg,rgba(255,247,224,0.98),rgba(234,220,196,0.9))]" />
      <div className="absolute inset-x-6 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent" />

      <div className="mb-4 flex items-center gap-3 px-1">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-800 text-[#fff8e7] shadow-lg shadow-emerald-900/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-serif text-xl font-semibold tracking-[-0.03em]">
            Spendly AI
          </p>
          <p className="text-sm text-stone-600">Paper notes, tidy numbers.</p>
        </div>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" ? (
              <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-950 text-[#fff8e7]">
                <Bot className="h-4 w-4" />
              </div>
            ) : null}
            <div
              className={cn(
                "max-w-[88%] rounded-[1.5rem] px-4 py-3 shadow-sm",
                message.role === "user"
                  ? "bg-emerald-800 text-[#fffdf3]"
                  : "border border-amber-900/10 bg-[#fffaf0]/90 text-stone-800"
              )}
            >
              {message.content}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-amber-950/10 bg-[#fffaf0]/70 p-3 shadow-inner shadow-amber-900/5">
        {showExamples ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-emerald-900/15 bg-[#fffdf6]/80 text-stone-700 hover:bg-emerald-50 hover:text-emerald-900"
                onClick={() => setComposer(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            htmlFor={composerId}
            className="flex items-center gap-2 text-sm font-medium text-stone-700"
          >
            <PenLine className="h-4 w-4 text-emerald-800" />
            Message Spendly AI
          </label>
          <Textarea
            id={composerId}
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Dinner pho 90k tonight"
            className="min-h-24 resize-none rounded-2xl border-amber-950/15 bg-[#fffdf6] text-stone-900 placeholder:text-stone-400 focus-visible:border-emerald-800 focus-visible:ring-emerald-800/20"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading || !trimmedComposer}
              className="rounded-full bg-emerald-800 px-5 text-[#fffdf3] hover:bg-emerald-900"
            >
              {loading ? "Sending..." : "Send message"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};

const SuccessBubble = ({ expense }: { expense: TExpense }) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-serif text-lg text-stone-950">
          I found an expense draft.
        </p>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Review the fields before moving it into the form.
        </p>
      </div>
      {showForm ? (
        <ManualExpenseForm initialExpense={expense} />
      ) : (
        <AIExpensePreviewCard
          expense={expense}
          onDismiss={() => setShowForm(false)}
          onContinue={() => setShowForm(true)}
        />
      )}
    </div>
  );
};

export default AIExpenseChat;
