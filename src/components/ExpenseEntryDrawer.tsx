"use client";

import { useEffect, useRef, useState } from "react";

import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
} from "@/lib/expense-prefill";
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

import ExpenseEntry from "@/components/ExpenseEntry";
import { type ManualExpenseFormHandle } from "@/components/ManualExpenseForm";

type ExpenseEntryDrawerProps = {
  compact?: boolean;
};

const ExpenseEntryDrawer = ({ compact = false }: ExpenseEntryDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [prefillExpense, setPrefillExpense] = useState<Pick<
    TExpense,
    "amount" | "note" | "category"
  > | null>(null);
  const [formState, setFormState] = useState({
    canSubmit: false,
    loading: false,
  });
  const formRef = useRef<ManualExpenseFormHandle>(null);
  const submitLabel = "Add Expense";
  const loadingLabel = "Adding...";

  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent<ExpensePrefillPayload>).detail;
      if (!detail) {
        return;
      }

      setPrefillExpense({
        amount: detail.amount,
        note: detail.note,
        category: detail.category,
      });
      setOpen(true);
    };

    window.addEventListener(EXPENSE_PREFILL_EVENT, handlePrefill);
    return () =>
      window.removeEventListener(EXPENSE_PREFILL_EVENT, handlePrefill);
  }, []);

  useEffect(() => {
    if (!open) {
      setPrefillExpense(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen} modal>
      <SheetTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.45)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </SheetTrigger>
      <SheetContent className="h-svh w-[90svw]">
        <SheetHeader className="text-left">
          <SheetTitle>Add a new expense</SheetTitle>
          <SheetDescription>
            Use AI or the quick form to add a new entry.
          </SheetDescription>
        </SheetHeader>
        <div className="no-scrollbar scroll-fade-y flex-1 overflow-y-auto px-2 pb-4">
          <ExpenseEntry
            formRef={formRef}
            showSubmitButton={false}
            onStateChange={setFormState}
            prefillExpense={prefillExpense}
          />
        </div>
        <SheetFooter className="standalone:pb-safe border-t">
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
