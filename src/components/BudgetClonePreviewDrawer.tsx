"use client";

import React, { useEffect, useMemo, useState } from "react";

import { cn, formatVnd } from "@/lib/utils";
import type {
  BudgetCloneNextPeriodInput,
  BudgetClonePeriod,
  BudgetListItem,
} from "@/types/budget-weekly";
import { ArrowLeft, CopyPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import BudgetBadge from "@/components/BudgetBadge";
import ExpenseItemIcon from "@/components/ExpenseItemIcon";

export type BudgetClonePreview = {
  period: BudgetClonePeriod;
  sourceStartDate: string;
  sourceLabel: string;
  targetLabel: string;
  targetNavigationKey: string;
  targetToastLabel: "next week" | "next month";
  budgets: BudgetListItem[];
  existingBudgetNames: Set<string>;
};

type BudgetClonePreviewDrawerProps = {
  preview: BudgetClonePreview | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: (input: BudgetCloneNextPeriodInput) => void;
};

export const normalizeClonePreviewName = (name: string) =>
  name.trim().toLowerCase();

const cloneBudgetAmountErrorId = "clone-budget-amount-error";

const isInvalidCloneAmount = (value: string | undefined) => {
  if (typeof value !== "string" || value.trim() === "") {
    return true;
  }

  const parsedValue = Number(value);

  return !Number.isFinite(parsedValue) || parsedValue < 0;
};

const BudgetClonePreviewDrawer = ({
  preview,
  isPending,
  onOpenChange,
  onCancel,
  onConfirm,
}: BudgetClonePreviewDrawerProps) => {
  const cloneableBudgets = useMemo(() => {
    if (!preview) {
      return [];
    }

    return preview.budgets.filter(
      (budget) =>
        !preview.existingBudgetNames.has(normalizeClonePreviewName(budget.name))
    );
  }, [preview]);
  const skippedCount = (preview?.budgets.length ?? 0) - cloneableBudgets.length;
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!preview) {
      setSelectedBudgetId(null);
      setDraftAmounts({});
      return;
    }

    const nextDraftAmounts = Object.fromEntries(
      cloneableBudgets.map((budget) => [budget.id, String(budget.amount)])
    );

    setDraftAmounts(nextDraftAmounts);
    setSelectedBudgetId(cloneableBudgets[0]?.id ?? null);
  }, [preview, cloneableBudgets]);

  const selectedBudget =
    cloneableBudgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const selectedAmountValue =
    selectedBudgetId === null ? "" : (draftAmounts[selectedBudgetId] ?? "");
  const selectedAmountInvalid = selectedBudget
    ? isInvalidCloneAmount(selectedAmountValue)
    : false;
  const hasInvalidAmount =
    cloneableBudgets.length === 0 ||
    cloneableBudgets.some((budget) =>
      isInvalidCloneAmount(draftAmounts[budget.id])
    );
  const totalDraftAmount = cloneableBudgets.reduce((sum, budget) => {
    const parsedAmount = Number(draftAmounts[budget.id]);

    return Number.isFinite(parsedAmount) && parsedAmount >= 0
      ? sum + parsedAmount
      : sum;
  }, 0);

  const handleAmountChange = (value: string) => {
    if (selectedBudgetId === null) {
      return;
    }

    setDraftAmounts((current) => ({
      ...current,
      [selectedBudgetId]: value,
    }));
  };

  const handleConfirm = () => {
    if (!preview || hasInvalidAmount) {
      return;
    }

    onConfirm({
      period: preview.period,
      sourceStartDate: preview.sourceStartDate,
      budgets: cloneableBudgets.map((budget) => ({
        sourceBudgetId: budget.id,
        amount: Number(draftAmounts[budget.id]),
      })),
    });
  };

  return (
    <Drawer open={Boolean(preview)} onOpenChange={onOpenChange}>
      {preview ? (
        <DrawerContent className="max-h-[90svh] rounded-t-3xl! border-t-0!">
          <div className="px-4 pt-1 pb-3">
            <DrawerHeader className="px-0 text-left">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={onCancel}
                  disabled={isPending}
                  aria-label="Cancel clone"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <DrawerTitle className="text-xl">Clone budgets</DrawerTitle>
                  <DrawerDescription className="sr-only">
                    Edit budget amounts before cloning from{" "}
                    {preview.sourceLabel} to {preview.targetLabel}.
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  From
                </p>
                <p className="text-foreground mt-1 truncate text-sm font-semibold">
                  {preview.sourceLabel}
                </p>
              </div>
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  To
                </p>
                <p className="text-foreground mt-1 truncate text-sm font-semibold">
                  {preview.targetLabel}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mt-3 text-sm">
              Total clone amount is{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {formatVnd(totalDraftAmount)}
              </span>
            </p>
          </div>

          <div
            className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4"
            aria-label={`${cloneableBudgets.length} budgets to clone, ${skippedCount} already exists`}
          >
            {preview.budgets.map((budget) => {
              const alreadyExists = preview.existingBudgetNames.has(
                normalizeClonePreviewName(budget.name)
              );
              const selected = budget.id === selectedBudgetId;
              const draftAmount =
                draftAmounts[budget.id] ?? String(budget.amount);
              const parsedDraftAmount = Number(draftAmount);
              const displayAmount =
                Number.isFinite(parsedDraftAmount) && parsedDraftAmount >= 0
                  ? parsedDraftAmount
                  : budget.amount;

              return (
                <button
                  key={budget.id}
                  type="button"
                  onClick={() => setSelectedBudgetId(budget.id)}
                  disabled={alreadyExists || isPending}
                  className={cn(
                    "min-w-[138px] rounded-3xl border px-3 py-3 text-left transition",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/45 bg-card/70 text-foreground",
                    alreadyExists && "opacity-45"
                  )}
                  aria-pressed={selected}
                >
                  <div className="flex items-center gap-2">
                    <BudgetBadge
                      icon={budget.icon}
                      color={budget.color}
                      name={budget.name}
                      className="max-w-[92px] px-2 py-1"
                      nameClassName="text-xs font-semibold"
                    />
                    <ExpenseItemIcon
                      category={budget.category}
                      size="sm"
                      className="shrink-0"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums">
                      {formatVnd(displayAmount)}
                    </span>
                    {alreadyExists ? (
                      <span className="bg-warning/15 text-warning rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        Exists
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-card/80 mx-4 rounded-t-[2rem] px-5 py-6">
            {selectedBudget ? (
              <>
                <div className="flex items-center gap-2">
                  <BudgetBadge
                    icon={selectedBudget.icon}
                    color={selectedBudget.color}
                    name={selectedBudget.name}
                    className="px-2 py-1"
                    nameClassName="text-sm font-semibold"
                  />
                  <ExpenseItemIcon
                    category={selectedBudget.category}
                    size="sm"
                  />
                </div>
                <label htmlFor="clone-budget-amount-input" className="sr-only">
                  Clone amount
                </label>
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-muted-foreground text-5xl font-light">
                    ₫
                  </span>
                  <input
                    id="clone-budget-amount-input"
                    aria-label="Clone amount"
                    inputMode="numeric"
                    value={selectedAmountValue}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    disabled={isPending}
                    aria-invalid={selectedAmountInvalid ? true : undefined}
                    aria-describedby={
                      selectedAmountInvalid
                        ? cloneBudgetAmountErrorId
                        : undefined
                    }
                    className="text-foreground min-w-0 flex-1 bg-transparent text-5xl font-bold tabular-nums outline-none"
                  />
                </div>
                {selectedAmountInvalid ? (
                  <p
                    id={cloneBudgetAmountErrorId}
                    className="text-destructive mt-3 text-sm"
                  >
                    Enter a valid clone amount.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Every budget already exists in {preview.targetLabel}.
              </p>
            )}
          </div>

          <DrawerFooter className="gap-2 px-5 py-4">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || hasInvalidAmount}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CopyPlus className="h-4 w-4" />
              )}
              Confirm clone
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
};

export default BudgetClonePreviewDrawer;
