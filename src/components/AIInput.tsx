"use client";

import { useEffect, useRef, useState } from "react";

import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { Loader2, Plus, Send, X } from "lucide-react";

import AIExpensePreviewCard from "./AIExpensePreviewCard";
import ManualExpenseForm from "./ManualExpenseForm";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const retryableErrorMessage =
  "Could not parse expense right now. Please try again.";

const AIInput = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewExpense, setPreviewExpense] = useState<TExpense | null>(null);
  const [prefillExpense, setPrefillExpense] = useState<
    Partial<Pick<TExpense, "amount" | "note" | "category">> | null
  >(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const examples = [
    "Lunch with team 120k today",
    "Paid 450k for groceries yesterday",
    "Shoes 1.2tr on 12/08",
  ];

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const maxHeight = 120;
      const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = "auto";
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  const resetResultState = () => {
    setPreviewExpense(null);
    setPrefillExpense(null);
    setShowManualForm(false);
    setError(null);
  };

  async function handleSubmit() {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    resetResultState();
    setLoading(true);

    try {
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: trimmedInput }),
      });

      if (!response.ok) {
        throw new Error(`Parse request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ParseExpenseResponse;

      if (data.status === "success") {
        setPreviewExpense(data.expense);
      } else {
        setPrefillExpense(data.prefill);
        setShowManualForm(true);
      }

      setInput("");
    } catch (requestError) {
      console.error(requestError);
      setError(retryableErrorMessage);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleContinueToForm = () => {
    if (!previewExpense) {
      return;
    }

    setShowManualForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Try plain language. We will extract date, amount, note, and category.
        </p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full border px-3 py-1 text-xs transition"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border/60 bg-card/80 relative rounded-[28px] border shadow-xl shadow-black/5 backdrop-blur">
        <div className="px-5 pt-2">
          <Textarea
            ref={textareaRef}
            aria-label="Expense input"
            placeholder="What did you spend money on?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="placeholder:text-muted-foreground max-h-[120px] min-h-[44px] resize-none overflow-hidden border-0 bg-transparent! px-0 text-base leading-relaxed shadow-none focus-visible:ring-0 sm:text-base"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
          <button
            type="button"
            className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 flex size-11 items-center justify-center rounded-2xl border transition"
            aria-label="Add attachment"
          >
            <Plus className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {input.trim() ? (
              <button
                type="button"
                onClick={() => setInput("")}
                className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 flex size-11 items-center justify-center rounded-full border transition"
                aria-label="Clear input"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
            <Button
              type="submit"
              onClick={() => void handleSubmit()}
              disabled={loading || input.trim() === ""}
              size="icon"
              aria-label="Parse expense"
              className="bg-primary text-primary-foreground hover:bg-primary/90 size-11 rounded-full shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span data-testid="ai-input-loading" aria-hidden="true">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-2xl border px-4 py-3 text-sm"
        >
          {error}
        </div>
      ) : null}

      {previewExpense && !showManualForm ? (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          <AIExpensePreviewCard
            expense={previewExpense}
            onContinue={handleContinueToForm}
            onDismiss={resetResultState}
          />
        </div>
      ) : null}

      {showManualForm ? (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          <ManualExpenseForm
            {...(previewExpense ? { initialExpense: previewExpense } : {})}
            {...(prefillExpense ? { prefillExpense } : {})}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AIInput;
