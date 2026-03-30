"use client";

import { PaidBy } from "@/enums";
import { cn } from "@/lib/utils";

import PageEnterAnimation, {
  PageEnterSection,
} from "@/components/PageEnterAnimation";
import { useSettingsStore } from "@/components/providers/StoreProvider";

const paidByOptions: string[] = Object.values(PaidBy);

const SettingsMain = () => {
  const { paidBy, setPaidBy } = useSettingsStore((state) => state);

  return (
    <PageEnterAnimation className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom)-12px)] max-w-lg flex-col gap-3 px-4 pt-6 sm:px-6">
      <PageEnterSection>
        <header className="flex flex-col gap-3">
          <h1 className="text-foreground text-2xl font-semibold sm:text-3xl">
            Settings
          </h1>
          <p className="text-muted-foreground text-sm">
            Personalize how new expenses are created and prefilled.
          </p>
        </header>
      </PageEnterSection>

      <PageEnterSection>
        <section className="space-y-3">
          <div
            role="radiogroup"
            aria-label="Paid by"
            className="grid grid-cols-3 gap-3"
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
      </PageEnterSection>
    </PageEnterAnimation>
  );
};

export default SettingsMain;
