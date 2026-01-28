"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  createWeeklyBudgetEntry,
  deleteWeeklyBudgetEntry,
  updateWeeklyBudgetEntry,
} from "@/app/actions/budget-weekly-actions";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { WeeklyBudgetListItem } from "@/types/budget-weekly";
import { Plus, SaveIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

type BudgetWeeklyBudgetsClientProps = {
  weekStartDate: string;
  budgets: WeeklyBudgetListItem[];
};

const BudgetWeeklyBudgetsClient = ({
  weekStartDate,
  budgets,
}: BudgetWeeklyBudgetsClientProps) => {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeBudget, setActiveBudget] = useState<WeeklyBudgetListItem | null>(
    null
  );
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const formTitle = activeBudget ? "Edit budget" : "New budget";
  const submitLabel = activeBudget ? "Save changes" : "Create budget";
  const isValid = name.trim().length > 0 && amount > 0;
  const canSubmit = isValid && !isSaving;

  const handleOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setActiveBudget(null);
      setName("");
      setAmount(0);
    }
  };

  const openCreate = () => {
    setActiveBudget(null);
    setName("");
    setAmount(0);
    setSheetOpen(true);
  };

  const openEdit = (budget: WeeklyBudgetListItem) => {
    setActiveBudget(budget);
    setName(budget.name);
    setAmount(budget.amount);
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setIsSaving(true);
      if (activeBudget) {
        await updateWeeklyBudgetEntry(activeBudget.id, {
          name,
          amount,
        });
        toast.success("Budget updated.");
      } else {
        await createWeeklyBudgetEntry({
          weekStartDate,
          name,
          amount,
        });
        toast.success("Budget created.");
      }
      setSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeBudget) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteWeeklyBudgetEntry(activeBudget.id);
      toast.success("Budget deleted.");
      setConfirmOpen(false);
      setSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const budgetCards = useMemo(() => {
    return budgets.map((budget) => {
      const progress =
        budget.amount > 0 ? Math.min(budget.spent / budget.amount, 1) : 0;
      const percentSpent =
        budget.amount > 0
          ? Math.round((budget.spent / budget.amount) * 100)
          : 0;
      const isOver = budget.amount > 0 && budget.spent > budget.amount;
      const remainingValue =
        budget.remaining < 0
          ? formatVnd(Math.abs(budget.remaining))
          : formatVnd(budget.remaining);
      return (
        <button
          key={budget.id}
          type="button"
          onClick={() => openEdit(budget)}
          className={cn(
            "group relative flex min-w-[80svw] flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 active:scale-[0.99] sm:min-w-0",
            "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
          )}
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-foreground line-clamp-1 text-base font-semibold">
                {budget.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatVnd(budget.amount)} VND budgeted
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-base font-semibold",
                  budget.remaining < 0 ? "text-rose-300" : "text-emerald-300"
                )}
              >
                {remainingValue} VND
              </p>
              <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                {budget.remaining < 0 ? "Over" : "Remaining"}
              </p>
            </div>
          </div>
          <div className="text-muted-foreground mt-auto flex w-full items-center justify-between text-xs">
            <span>{formatVnd(budget.spent)} VND spent</span>
            <span>{percentSpent}% used</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                isOver ? "bg-rose-500" : "bg-emerald-400"
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex w-full items-center justify-between">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                isOver
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-emerald-500/20 text-emerald-200"
              )}
            >
              {isOver ? "Over budget" : "On track"}
            </span>
            <span className="text-muted-foreground text-[11px]">
              Tap to edit
            </span>
          </div>
        </button>
      );
    });
  }, [budgets]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Budgets</h2>
          <p className="text-muted-foreground text-sm">
            Track weekly spend per budget.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-11 w-full rounded-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add budget
        </Button>
      </div>
      {budgets.length ? (
        <div className="no-scrollbar flex gap-3 overflow-x-auto">
          {budgetCards}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm">
          No budgets yet. Add your first weekly budget to get started.
        </div>
      )}

      <Drawer
        open={sheetOpen}
        onOpenChange={handleOpenChange}
        repositionInputs={false}
      >
        <DrawerContent className="rounded-t-3xl! border-t-0!">
          <DrawerHeader>
            <DrawerTitle>{formTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-medium">
                Budget name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Weekly groceries"
                className="h-10"
                tabIndex={0}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-medium">
                Amount
              </label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={amount ? formatVnd(amount) : ""}
                  onChange={(event) =>
                    setAmount(parseVndInput(event.target.value))
                  }
                  placeholder="0"
                  className="h-10 pr-12 text-right text-lg font-semibold"
                />
                <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                  VND
                </span>
              </div>
            </div>
          </div>
          <DrawerFooter className="gap-2 border-t border-white/10">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-xl"
            >
              <SaveIcon />
              {submitLabel}
            </Button>
            {activeBudget ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmOpen(true)}
                disabled={isSaving}
                className="text-destructive bg-destructive/10 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this budget?</DialogTitle>
            <DialogDescription>
              Transactions will be unassigned if you delete this budget.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default BudgetWeeklyBudgetsClient;
