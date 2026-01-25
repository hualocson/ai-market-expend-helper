"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  createWeeklyBudgetEntry,
  deleteWeeklyBudgetEntry,
  updateWeeklyBudgetEntry,
} from "@/app/actions/budget-weekly-actions";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import { WeeklyBudgetListItem } from "@/types/budget-weekly";
import { Plus, Trash2 } from "lucide-react";
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
      const isOver = budget.amount > 0 && budget.spent > budget.amount;
      return (
        <button
          key={budget.id}
          type="button"
          onClick={() => openEdit(budget)}
          className="flex w-full flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 active:scale-[0.99]"
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <p className="text-foreground text-sm font-semibold">
                {budget.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatVnd(budget.amount)} VND budgeted
              </p>
            </div>
            <div className="text-right">
              <p className="text-foreground text-sm font-semibold">
                {formatVnd(budget.spent)} VND spent
              </p>
              <p
                className={cn(
                  "text-xs font-semibold",
                  budget.remaining < 0 ? "text-rose-400" : "text-emerald-400"
                )}
              >
                {formatVndSigned(budget.remaining)} VND remaining
              </p>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full",
                isOver ? "bg-rose-500" : "bg-emerald-400"
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </button>
      );
    });
  }, [budgets]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Budgets</h2>
          <p className="text-muted-foreground text-sm">
            Track weekly spend per budget.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {budgets.length ? (
        <div className="flex flex-col gap-3">{budgetCards}</div>
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
        <DrawerContent className="border-t-none! rounded-t-3xl!">
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
            {activeBudget ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-10 rounded-xl text-base"
            >
              {submitLabel}
            </Button>
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
