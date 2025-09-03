"use client";

import { useState } from "react";

import { processInput } from "@/app/actions/ai-actionts";
import { cn } from "@/lib/utils";
import { Loader2, SendIcon } from "lucide-react";

import ReceiveCard from "./ReceiveCard";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const AIInput = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TExpense | null>(null);
  async function handleSubmit() {
    try {
      setLoading(true);
      const result = await processInput(input);
      setResult(result ?? null);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex w-full max-w-md flex-col gap-3 *:w-full">
      <div className="relative">
        <Textarea
          placeholder="Enter your expense"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-10 resize-none px-4 py-2 pr-12"
          onKeyDown={handleKeyDown}
          rows={1}
          style={{
            height: "auto",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />
        <div className="absolute right-2 bottom-1">
          <Button
            type="submit"
            variant={"outline"}
            onClick={handleSubmit}
            size={"icon"}
            disabled={loading || input.trim() === ""}
            className="size-8 transition-all duration-300"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SendIcon
                className={cn(
                  input.trim() === "" ? "-translate-x-0.5 rotate-45" : ""
                )}
              />
            )}
          </Button>
        </div>
      </div>
      {result && <ReceiveCard expense={result} />}
    </div>
  );
};

export default AIInput;
