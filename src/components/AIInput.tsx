"use client";

import { useEffect, useRef, useState } from "react";

import { processInput } from "@/app/actions/ai-actionts";
import { Loader2, Plus, Send, X } from "lucide-react";

import ReceiveCard from "./ReceiveCard";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const AIInput = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TExpense | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const examples = [
    "Lunch with team 120k today",
    "Paid 450k for groceries yesterday",
    "Shoes 1.2tr on 12/08",
  ];

  // Auto-resize effect
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  async function handleSubmit() {
    if (!input.trim()) {
      return;
    }

    try {
      setResult(null);
      setLoading(true);
      const result = await processInput(input);
      setResult(result ?? null);
      setInput(""); // Clear input after successful processing
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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
      {/* Input Section */}
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
              onClick={handleSubmit}
              disabled={loading || input.trim() === ""}
              size="icon"
              className="bg-primary text-primary-foreground hover:bg-primary/90 size-11 rounded-full shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Result Section */}
      {result && (
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          <ReceiveCard expense={result} />
        </div>
      )}
    </div>
  );
};

export default AIInput;
