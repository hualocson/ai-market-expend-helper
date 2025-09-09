"use client";

import { useEffect, useRef, useState } from "react";

import { processInput } from "@/app/actions/ai-actionts";
import { Loader2, Send } from "lucide-react";

import ReceiveCard from "./ReceiveCard";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const AIInput = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TExpense | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="space-y-6">
      {/* Input Section */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          aria-label="Expense input"
          placeholder="Tell me about your expense..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="max-h-[120px] min-h-[44px] resize-none overflow-hidden rounded-xl px-4 pr-12 text-base leading-normal transition-all duration-200 focus:ring-2 sm:text-base"
        />
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={loading || input.trim() === ""}
          size="icon"
          className="bg-primary text-primary-foreground hover:bg-primary/90 absolute top-1/2 right-2 size-8 -translate-y-1/2 rounded-full shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
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
