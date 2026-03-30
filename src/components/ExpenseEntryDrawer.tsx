"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/configs/date";
import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
import {
  normalizePrefillSource,
  resolveQuickAddMode,
  type QuickAddSource,
} from "@/lib/quick-add-mode";
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import ManualExpenseForm, {
  type ManualExpenseFormHandle,
  type ManualExpenseFormState,
} from "@/components/ManualExpenseForm";

type ExpenseEntryDrawerProps = {
  compact?: boolean;
};

const ExpenseEntryDrawer = ({ compact = false }: ExpenseEntryDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [prefillExpense, setPrefillExpense] = useState<Pick<
    TExpense,
    "amount" | "note" | "category"
  > | null>(null);
  const [prefillVersion, setPrefillVersion] = useState(0);
  const [prefillSource, setPrefillSource] =
    useState<QuickAddSource>("manual");
  const resolvedMode = resolveQuickAddMode({
    source: prefillSource,
    hasPrefill: Boolean(prefillExpense),
  });
  const [formState, setFormState] = useState<ManualExpenseFormState>(() => ({
    canSubmit: false,
    loading: false,
    mode: resolvedMode,
  }));
  const formRef = useRef<ManualExpenseFormHandle>(null);
  const submitLabel = formState.mode === "quick" ? "Save" : "Add Expense";
  const loadingLabel = formState.mode === "quick" ? "Saving..." : "Adding...";
  const prefillInitialExpense = useMemo(() => {
    if (!prefillExpense) {
      return undefined;
    }

    return {
      date: dayjs().format("DD/MM/YYYY"),
      amount: prefillExpense.amount,
      note: prefillExpense.note,
      category: prefillExpense.category,
    };
  }, [prefillExpense]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setPrefillSource("manual");
      setPrefillExpense(null);
      setFormState({
        canSubmit: false,
        loading: false,
        mode: "advanced",
      });
    }
  };

  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) {
        return;
      }
      const nextSource = normalizePrefillSource(detail.source);
      const nextMode = resolveQuickAddMode({
        source: nextSource,
        hasPrefill: true,
      });

      setPrefillExpense({
        amount: detail.amount,
        note: detail.note,
        category: detail.category,
      });
      setPrefillSource(nextSource);
      setPrefillVersion((value) => value + 1);
      setFormState({
        canSubmit: detail.amount > 0,
        loading: false,
        mode: nextMode,
      });
      setOpen(true);
    };

    window.addEventListener(EXPENSE_PREFILL_EVENT, handlePrefill);
    return () =>
      window.removeEventListener(EXPENSE_PREFILL_EVENT, handlePrefill);
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_color-mix(in_srgb,var(--background)_60%,transparent)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="h-full w-[90svw] gap-0"
        data-quick-add-mode={formState.mode}
      >
        <SheetHeader className="text-left">
          <SheetTitle>Add a new expense</SheetTitle>
          <SheetDescription>
            Use AI or the quick form to add a new entry.
          </SheetDescription>
        </SheetHeader>
        <div className="no-scrollbar overflow-y-auto px-2 pb-4">
          <ManualExpenseForm
            key={`expense-form-${prefillVersion}`}
            ref={formRef}
            initialExpense={prefillInitialExpense}
            showSubmitButton={false}
            onStateChange={setFormState}
            prefillExpense={prefillExpense}
            showBudgetSelect={formState.mode === "advanced"}
            isSheetOpen={open}
            initialMode={resolvedMode}
            onSuccess={() => handleOpenChange(false)}
          />
        </div>
        <SheetFooter className={cn("standalone:pb-safe border-t")}>
          <Button
            onClick={() => formRef.current?.submit()}
            disabled={!formState.canSubmit || formState.loading}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            {formState.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ExpenseEntryDrawer;
