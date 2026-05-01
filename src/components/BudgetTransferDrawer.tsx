"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { transferBudgetAmount } from "@/app/actions/budget-weekly-actions";
import {
  budgetOverviewQueryKey,
  budgetTransactionsQueryKey,
} from "@/lib/queries/budgets";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: BudgetListItem;
  budgets: BudgetListItem[];
};

const formatPeriod = (b: BudgetListItem) => {
  if (b.period === "week") return "Weekly";
  if (b.period === "month") return "Monthly";
  return "Custom";
};

const BudgetTransferDrawer = ({
  open,
  onOpenChange,
  destination,
  budgets,
}: Props) => {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSourceId(null);
      setAmount(0);
      setPickerOpen(false);
      setIsSaving(false);
    }
  }, [open]);

  const candidateSources = useMemo(
    () => budgets.filter((b) => b.id !== destination.id),
    [budgets, destination.id]
  );

  const source = useMemo(
    () => candidateSources.find((b) => b.id === sourceId) ?? null,
    [candidateSources, sourceId]
  );

  const exceedsCap = source !== null && amount > source.amount;
  const goesOverSpent =
    source !== null &&
    amount > 0 &&
    !exceedsCap &&
    source.amount - amount < source.spent;

  const overBy = goesOverSpent && source ? source.spent - (source.amount - amount) : 0;

  const canSubmit =
    source !== null && amount > 0 && !exceedsCap && !isSaving;

  const submitLabel = goesOverSpent ? "Move funds anyway" : "Move funds";

  const handleSubmit = async () => {
    if (!canSubmit || !source) return;
    try {
      setIsSaving(true);
      const result = await transferBudgetAmount({
        fromBudgetId: source.id,
        toBudgetId: destination.id,
        amount,
      });

      if (result.ok) {
        toast.success("Funds moved.");
        await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
        await queryClient.invalidateQueries({
          queryKey: budgetTransactionsQueryKey(destination.id),
        });
        await queryClient.invalidateQueries({
          queryKey: budgetTransactionsQueryKey(source.id),
        });
        onOpenChange(false);
        return;
      }

      switch (result.code) {
        case "INSUFFICIENT_CAP":
          toast.error("That budget no longer has enough to move. Try a smaller amount.");
          break;
        case "NOT_FOUND":
          toast.error("Source budget no longer exists.");
          break;
        default: {
          const _exhaustive: never = result.code;
          void _exhaustive;
          toast.error("Failed to move funds.");
        }
      }
      await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
    } catch (error) {
      console.error(error);
      toast.error("Failed to move funds.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="rounded-t-3xl! border-t-0!">
        <DrawerHeader className="gap-1 pb-2">
          <DrawerTitle>Move funds to &quot;{destination.name}&quot;</DrawerTitle>
          <DrawerDescription>
            Pull cap from another budget into this one
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar flex max-h-[65svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
          {candidateSources.length === 0 ? (
            <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-semibold">
                No other budgets to pull from yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Create another budget first, then come back to move funds.
              </p>
            </div>
          ) : (
            <>
              <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Destination
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-foreground text-sm font-semibold">
                    {destination.name}
                  </p>
                  <p className="text-foreground text-sm font-semibold">
                    {formatVnd(destination.amount)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">
                  From
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Select source budget"
                  aria-expanded={pickerOpen}
                  aria-controls="source-budget-list"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="mt-2 h-11 w-full justify-between rounded-xl"
                >
                  <span className="truncate">
                    {source ? source.name : "Select source budget"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {source ? formatVnd(source.amount) : ""}
                  </span>
                </Button>

                {pickerOpen ? (
                  <ul
                    id="source-budget-list"
                    aria-label="Source budgets"
                    className="border-border/45 bg-card/40 mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border p-1"
                  >
                    {candidateSources.map((b) => {
                      const disabled = b.amount === 0;
                      const selected = b.id === sourceId;
                      return (
                        <li key={b.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => {
                              setSourceId(b.id);
                              setPickerOpen(false);
                            }}
                            className={cn(
                              "h-11 w-full justify-between rounded-lg px-3 text-left",
                              selected && "bg-muted/60"
                            )}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="text-foreground truncate text-sm font-medium">
                                {b.name}
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                {formatPeriod(b)} · {formatVnd(b.remaining)} left
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-foreground text-xs font-semibold">
                                {formatVnd(b.amount)}
                              </span>
                              {selected ? (
                                <Check className="text-success h-4 w-4" />
                              ) : null}
                            </span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="transfer-amount-input"
                  className="text-foreground text-sm font-medium"
                >
                  Amount
                </label>
                <div className="relative mt-2">
                  <Input
                    id="transfer-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={amount ? formatVnd(amount) : ""}
                    onChange={(e) => setAmount(parseVndInput(e.target.value))}
                    placeholder="0"
                    className="h-11 pr-14 text-right text-lg font-semibold"
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                    VND
                  </span>
                </div>
                {exceedsCap && source ? (
                  <p className="text-destructive mt-2 text-[11px]">
                    Cannot move more than {formatVnd(source.amount)} from {source.name}.
                  </p>
                ) : null}
              </div>

              {source && amount > 0 && !exceedsCap ? (
                <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    After transfer
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{source.name}</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold",
                          source.amount - amount < source.spent
                            ? "text-destructive"
                            : "text-foreground"
                        )}
                      >
                        {formatVnd(source.amount - amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{destination.name}</p>
                      <p className="text-foreground mt-1 text-sm font-semibold">
                        {formatVnd(destination.amount + amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {goesOverSpent && source ? (
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    {source.name} will go {formatVnd(overBy)} over budget.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {candidateSources.length > 0 ? (
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-2xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {isSaving ? "Moving..." : submitLabel}
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetTransferDrawer;
