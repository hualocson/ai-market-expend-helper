"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  getBudgetColorOption,
  normalizeBudgetColor,
} from "@/lib/budget-appearance";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import type {
  BudgetCloneNextPeriodInput,
  BudgetClonePeriod,
  BudgetListItem,
} from "@/types/budget-weekly";
import { CopyPlus, Loader2 } from "lucide-react";

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
import VndSymbol from "@/components/VndSymbol";

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
const emptyPreviewBudgets: BudgetListItem[] = [];
const emptyExistingBudgetNames = new Set<string>();

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
  const previewBudgets = preview?.budgets ?? emptyPreviewBudgets;
  const existingBudgetNames =
    preview?.existingBudgetNames ?? emptyExistingBudgetNames;
  const sourceLabel = preview?.sourceLabel ?? "No source period";
  const targetLabel = preview?.targetLabel ?? "No target period";
  const budgetScrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedBudgetButtonRef = useRef<HTMLButtonElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const scrollSelectTimeoutRef = useRef<number | null>(null);
  const programmaticScrollTimeoutRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});
  const [amountFocusRequest, setAmountFocusRequest] = useState(0);

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

  useEffect(() => {
    if (selectedBudgetId === null) {
      return;
    }

    const container = budgetScrollContainerRef.current;
    const selectedButton = selectedBudgetButtonRef.current;

    if (!container || !selectedButton) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const selectedRect = selectedButton.getBoundingClientRect();
    const containerPaddingLeft = Number.parseFloat(
      window.getComputedStyle(container).paddingLeft
    );
    const left =
      container.scrollLeft +
      selectedRect.left -
      containerRect.left -
      containerPaddingLeft;

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current !== null) {
      window.clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 400);

    if (typeof container.scrollTo === "function") {
      container.scrollTo({ left, behavior: "smooth" });
      return;
    }

    container.scrollLeft = left;
  }, [selectedBudgetId]);

  useEffect(
    () => () => {
      if (scrollSelectTimeoutRef.current !== null) {
        window.clearTimeout(scrollSelectTimeoutRef.current);
      }
      if (programmaticScrollTimeoutRef.current !== null) {
        window.clearTimeout(programmaticScrollTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (amountFocusRequest === 0) {
      return;
    }

    amountInputRef.current?.focus({ preventScroll: true });
  }, [amountFocusRequest, selectedBudgetId]);

  const selectedBudget =
    cloneableBudgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const selectedAmountValue =
    selectedBudgetId === null ? "" : (draftAmounts[selectedBudgetId] ?? "");
  const selectedAmountDisplayValue =
    selectedAmountValue === "" || Number(selectedAmountValue) === 0
      ? ""
      : formatVnd(Number(selectedAmountValue));
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
      [selectedBudgetId]:
        value.trim() === "" ? "" : String(parseVndInput(value)),
    }));
  };

  const handleBudgetSelect = (budgetId: number) => {
    setSelectedBudgetId(budgetId);
    setAmountFocusRequest((current) => current + 1);
  };

  const handleBudgetListScroll = () => {
    if (isProgrammaticScrollRef.current) {
      return;
    }

    if (scrollSelectTimeoutRef.current !== null) {
      window.clearTimeout(scrollSelectTimeoutRef.current);
    }

    scrollSelectTimeoutRef.current = window.setTimeout(() => {
      const container = budgetScrollContainerRef.current;

      if (!container) {
        return;
      }

      const budgetButtons = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          "button[data-cloneable='true']"
        )
      );

      if (budgetButtons.length === 0) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const containerPaddingLeft = Number.parseFloat(
        window.getComputedStyle(container).paddingLeft
      );
      const snapStartLeft =
        containerRect.left +
        (Number.isFinite(containerPaddingLeft) ? containerPaddingLeft : 0);
      const closestButton = budgetButtons.reduce((closest, button) => {
        const closestDistance = Math.abs(
          closest.getBoundingClientRect().left - snapStartLeft
        );
        const buttonDistance = Math.abs(
          button.getBoundingClientRect().left - snapStartLeft
        );

        return buttonDistance < closestDistance ? button : closest;
      });
      const nextBudgetId = Number(closestButton.dataset.budgetId);

      if (Number.isFinite(nextBudgetId) && nextBudgetId !== selectedBudgetId) {
        setSelectedBudgetId(nextBudgetId);
      }
    }, 120);
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
    <Drawer
      open={Boolean(preview)}
      onOpenChange={onOpenChange}
      modal
      direction="bottom"
      repositionInputs={false}
      autoFocus={false}
    >
      <DrawerContent
        hideIndicator
        overlayClassName="quick-expense-drawer-overlay"
        className="quick-expense-drawer-morph h-dvh w-full gap-0 rounded-none! p-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <div data-testid="clone-preview-header" className="px-4 pb-3">
            <DrawerHeader className="px-0 text-left">
              <div className="min-w-0">
                <DrawerTitle className="text-left text-xl">
                  Clone budgets
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  Edit budget amounts before cloning from {sourceLabel} to{" "}
                  {targetLabel}.
                </DrawerDescription>
              </div>
            </DrawerHeader>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  From
                </p>
                <p className="text-foreground mt-1 truncate text-sm font-semibold">
                  {sourceLabel}
                </p>
              </div>
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  To
                </p>
                <p className="text-foreground mt-1 truncate text-sm font-semibold">
                  {targetLabel}
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
            ref={budgetScrollContainerRef}
            data-testid="clone-budget-scroll-list"
            className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4"
            aria-label={`${cloneableBudgets.length} budgets to clone, ${skippedCount} already exists`}
            onScroll={handleBudgetListScroll}
          >
            {previewBudgets.map((budget) => {
              const alreadyExists = existingBudgetNames.has(
                normalizeClonePreviewName(budget.name)
              );
              const selected = budget.id === selectedBudgetId;
              const colorOption = getBudgetColorOption(
                normalizeBudgetColor(budget.color)
              );
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
                  ref={(node) => {
                    if (selected) {
                      selectedBudgetButtonRef.current = node;
                    }
                  }}
                  type="button"
                  onClick={() => handleBudgetSelect(budget.id)}
                  disabled={alreadyExists || isPending}
                  data-budget-id={budget.id}
                  data-cloneable={alreadyExists ? undefined : "true"}
                  className={cn(
                    "w-[65svw] min-w-[65svw] snap-start rounded-3xl border px-3 py-3 text-left transition-[background-color,border-color,color,box-shadow,transform] active:scale-[0.96]",
                    selected
                      ? cn(
                          "border-transparent shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_18%,transparent),0_12px_24px_color-mix(in_srgb,#000000_24%,transparent)]",
                          colorOption.chipClassName
                        )
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
                      className="max-w-[112px] px-2 py-1"
                      nameClassName="text-xs font-semibold"
                    />
                    <ExpenseItemIcon
                      category={budget.category}
                      size="sm"
                      className="shrink-0"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-baseline gap-1 text-sm font-bold tabular-nums">
                      {formatVnd(displayAmount)}
                      <VndSymbol className="text-[0.78em] opacity-80" />
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

          {selectedBudget ? (
            <>
              <div className="flex items-center gap-2 px-4 pt-1">
                <BudgetBadge
                  icon={selectedBudget.icon}
                  color={selectedBudget.color}
                  name={selectedBudget.name}
                  className="px-2 py-1"
                  nameClassName="text-sm font-semibold"
                />
                <ExpenseItemIcon category={selectedBudget.category} size="sm" />
              </div>
              <label htmlFor="clone-budget-amount-input" className="sr-only">
                Clone amount
              </label>
              <div className="mt-5 flex items-baseline gap-1 px-4">
                <VndSymbol className="text-muted-foreground text-4xl font-semibold tracking-tight" />
                <input
                  ref={amountInputRef}
                  id="clone-budget-amount-input"
                  aria-label="Clone amount"
                  inputMode="numeric"
                  value={selectedAmountDisplayValue}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  disabled={isPending}
                  aria-invalid={selectedAmountInvalid ? true : undefined}
                  aria-describedby={
                    selectedAmountInvalid ? cloneBudgetAmountErrorId : undefined
                  }
                  placeholder="0"
                  className="min-w-0 flex-1 border-0 bg-transparent px-0 text-left text-4xl font-semibold tracking-tight tabular-nums focus-visible:ring-0 focus-visible:outline-none"
                />
              </div>
              {selectedAmountInvalid ? (
                <p
                  id={cloneBudgetAmountErrorId}
                  className="text-destructive mt-3 px-4 text-sm"
                >
                  Enter a valid clone amount.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground px-4 text-sm">
              {preview
                ? `Every budget already exists in ${targetLabel}.`
                : "No clone preview is available."}
            </p>
          )}
        </div>

        <DrawerFooter className="flex-row gap-3 px-5 pt-3 pb-5">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
            className="min-w-0 flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || hasInvalidAmount}
            className="min-w-0 flex-1"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CopyPlus className="h-4 w-4" />
            )}
            Confirm clone
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetClonePreviewDrawer;
