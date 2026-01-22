"use client";

import { PaidBy } from "@/enums";
import { cn } from "@/lib/utils";

import { useSettingsStore } from "@/components/providers/StoreProvider";

const paidByOptions: string[] = [PaidBy.CUBI, PaidBy.EMBE];

const SettingsMain = () => {
  const { paidBy, setPaidBy } = useSettingsStore((state) => state);

  return (
    <div className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom)-12px)] max-w-lg flex-col gap-3 px-4 pt-6 sm:px-6">
      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 duration-700">
        <h1 className="text-foreground text-2xl font-semibold sm:text-3xl">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Personalize how new expenses are created and prefilled.
        </p>
      </header>

      <section className="animate-in fade-in slide-in-from-bottom-2 space-y-3 delay-200 duration-700">
        <div
          role="radiogroup"
          aria-label="Paid by"
          className="grid grid-cols-2 gap-3"
        >
          {paidByOptions.map((option) => {
            const isSelected = paidBy === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setPaidBy(option)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-accent"
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SettingsMain;
