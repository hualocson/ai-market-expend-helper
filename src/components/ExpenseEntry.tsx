"use client";

import { useState } from "react";

import { PenSquare, Sparkles } from "lucide-react";

import AIInput from "./AIInput";
import ManualExpenseForm from "./ManualExpenseForm";

const modes = [
  {
    id: "ai",
    title: "AI Assistant",
    description: "Describe it naturally and confirm the details.",
    icon: Sparkles,
  },
  {
    id: "manual",
    title: "Manual Form",
    description: "Fill the fields yourself in seconds.",
    icon: PenSquare,
  },
] as const;

type Mode = (typeof modes)[number]["id"];

const ExpenseEntry = () => {
  const [mode, setMode] = useState<Mode>("ai");

  return (
    <div className="bg-card/70 border-border/60 rounded-3xl border p-4 shadow-xl backdrop-blur sm:p-6">
      <div className="grid grid-cols-2 gap-2">
        {modes.map((item) => {
          const isActive = mode === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={[
                "group rounded-xl px-3 py-2 text-left transition-all duration-200 sm:px-4 sm:py-3",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/70",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.title}
              </div>
              <p className="mt-1 hidden text-xs opacity-80 sm:block">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 sm:mt-6">
        {mode === "ai" ? <AIInput /> : <ManualExpenseForm />}
      </div>
    </div>
  );
};

export default ExpenseEntry;
